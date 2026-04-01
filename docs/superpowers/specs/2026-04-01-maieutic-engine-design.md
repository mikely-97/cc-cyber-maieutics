# Maieutic Engine — Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Authors:** Mike L, Claude

## Overview

The Maieutic Engine is a Claude Code skill + MCP plugin that enables Claude to recursively question itself using Socratic methodology (maieutics) before, during, and after task execution. It addresses the core problem that LLMs have **broad knowledge but narrow recall** — they retrieve what's contextually adjacent rather than what's strategically relevant. Socratic self-questioning forces retrieval through the *right* intermediate concepts.

Inspired by Socrates' concept of **anamnesis** (knowledge as remembering), Elder & Paul's taxonomy of Socratic questions, and modern prompt engineering techniques (Chain of Thought, ReAct, Reflexion, Branch-Solve-Merge).

## Architecture

Two components:

1. **MCP Plugin (`maieutic-engine`)** — TypeScript MCP server that owns persistence and exposes 7 tools. Uses better-sqlite3 with FTS5 and WAL mode.
2. **Skill (`maieutic.md`)** — Markdown prompt that teaches Claude the Socratic questioning methodology, loop structure, and when/how to invoke the MCP tools.

The skill teaches *how to think*. The plugin provides *where to store what was thought*.

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Session                    │
│                                                           │
│  ┌──────────────┐    invokes     ┌──────────────────┐    │
│  │  /maieutic   │──────────────→│  Maieutic Skill   │    │
│  │  (user cmd)  │               │  (methodology)    │    │
│  └──────────────┘               └────────┬─────────┘    │
│                                          │               │
│                          instructs Claude to use          │
│                                          │               │
│  ┌───────────────────────────────────────▼────────────┐  │
│  │              MCP Plugin: maieutic-engine            │  │
│  │                                                     │  │
│  │  Tools:                                             │  │
│  │  ├─ maieutic_begin    (start inquiry for a task)    │  │
│  │  ├─ maieutic_ask      (pose question, get branch)   │  │
│  │  ├─ maieutic_answer   (record answer + confidence)  │  │
│  │  ├─ maieutic_recall   (FTS5 search past reasoning)  │  │
│  │  ├─ maieutic_synthesize (merge round insights)      │  │
│  │  ├─ maieutic_reflect  (post-task retrospective)     │  │
│  │  └─ maieutic_config   (get/set depth, visibility)   │  │
│  │                                                     │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │  SQLite + FTS5 (WAL mode)                   │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Subagent A  │  │ Subagent B  │  │ Subagent C  │      │
│  │ (Purpose)   │  │ (Assumpts)  │  │ (PointOfView│      │
│  │ reads/writes│  │ reads/writes│  │ reads/writes)│      │
│  │ shared DB   │  │ shared DB   │  │ shared DB   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Invocation Methods

- **Explicit:** `/maieutic`, `/socratic`
- **Natural language:** "use Socratic method", "use maieutics", "think socratically", "question yourself first"
- **Automatic:** Configurable triggers during before/during/after loop
- **On demand:** User says "question yourself" mid-task to trigger a check-in

## Data Model

### Schema

```sql
CREATE TABLE inquiries (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    task        TEXT NOT NULL,
    profile     TEXT DEFAULT 'auto',
    depth       TEXT DEFAULT 'medium',
    visibility  TEXT DEFAULT 'summary',
    status      TEXT DEFAULT 'active',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE questions (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    round       INTEGER NOT NULL,
    element     TEXT NOT NULL,
    question    TEXT NOT NULL,
    status      TEXT DEFAULT 'open',
    spawned_by  TEXT REFERENCES questions(id),
    agent_id    TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE answers (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id),
    answer      TEXT NOT NULL,
    confidence  REAL DEFAULT 0.5,
    source      TEXT DEFAULT 'self',
    created_at  TEXT NOT NULL
);

CREATE TABLE question_links (
    from_id     TEXT NOT NULL REFERENCES questions(id),
    to_id       TEXT NOT NULL REFERENCES questions(id),
    relation    TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id)
);

CREATE TABLE syntheses (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    round       INTEGER NOT NULL,
    summary     TEXT NOT NULL,
    open_threads TEXT,
    next_questions TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE reflections (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    what_worked TEXT,
    what_missed TEXT,
    key_insight TEXT,
    created_at  TEXT NOT NULL
);

CREATE VIRTUAL TABLE qa_fts USING fts5(
    question_text,
    answer_text,
    element,
    project,
    content='',
    tokenize='porter unicode61'
);

CREATE TABLE config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    scope       TEXT DEFAULT 'project'
);
```

### Key Design Decisions

- **`questions.round`** — Enables round-based synthesis checkpoints. Round 0 = root questions, round N = follow-ups after N syntheses.
- **`questions.spawned_by`** — Primary DAG edge (parent→child). `question_links` handles cross-branch connections.
- **`answers.confidence`** — 0.0 to 1.0. Low-confidence answers can trigger deeper questioning or be surfaced as unresolved.
- **`answers.source`** — Tracks provenance: `self` (self-reasoning), `user` (user provided), `recall` (from past inquiry), `tool` (from tool output).
- **`qa_fts`** — Contentless FTS5 with Porter stemming for `maieutic_recall` searches.
- **`question_links.relation`** — `informs`, `contradicts`, `refines`, `duplicates`. Created during synthesis.

## MCP Tool Definitions

### `maieutic_begin`

Starts a new inquiry. Auto-detects or accepts a profile to determine which Elements of Thought to activate as root questions.

```typescript
Input: {
  task: string,
  profile?: "auto" | "feature" | "bugfix" | "refactor" | "custom",
  depth?: "shallow" | "medium" | "deep" | "custom",
  visibility?: "silent" | "summary" | "verbose",
  elements?: string[]  // override default element selection
}
Output: { inquiry_id: string, root_questions: [{id, element, question}] }
```

### `maieutic_ask`

Poses a new question within an inquiry.

```typescript
Input: {
  inquiry_id: string,
  element: string,
  question: string,
  spawned_by?: string,
  round?: number
}
Output: { question_id: string }
```

### `maieutic_answer`

Records an answer. Can spawn follow-up questions atomically.

```typescript
Input: {
  question_id: string,
  answer: string,
  confidence?: number,
  source?: "self" | "user" | "recall" | "tool",
  spawn?: [{ element: string, question: string }]
}
Output: { answer_id: string, spawned_question_ids?: string[] }
```

### `maieutic_recall`

FTS5 search across all past reasoning. The core "anamnesis" tool.

```typescript
Input: {
  query: string,
  project?: string,
  element?: string,
  limit?: number,
  min_confidence?: number
}
Output: { results: [{inquiry_id, question, answer, confidence, element, created_at}] }
```

### `maieutic_synthesize`

Records synthesis after a round of questioning. Identifies cross-branch connections.

```typescript
Input: {
  inquiry_id: string,
  round: number,
  summary: string,
  open_threads?: string[],
  next_questions?: [{ element: string, question: string, spawned_by?: string }]
}
Output: { synthesis_id: string, next_round: number }
```

### `maieutic_reflect`

Post-task retrospective. Key insights are indexed into FTS for future recall.

```typescript
Input: {
  inquiry_id: string,
  what_worked: string,
  what_missed: string,
  key_insight: string
}
Output: { reflection_id: string }
```

### `maieutic_config`

Get or set configuration values.

```typescript
Input: {
  action: "get" | "set",
  key?: string,
  value?: string,
  scope?: "project" | "global"
}
Output: { config: Record<string, string> }
```

## The Maieutic Loop

### Socratic Elements of Thought (Engineering Mapping)

| Element | Engineering Translation | Example |
|---------|------------------------|---------|
| Purpose | What are we optimizing for? Business goal? | "Mobile game — engagement → revenue" |
| Question at Issue | What specifically are we solving? | "Onboarding has 60% drop-off" |
| Assumptions | What are we taking for granted? | "Users have accounts already" |
| Point of View | Whose perspective are we missing? | "What does the end user experience?" |
| Information | What data/context do we have or need? | "Do we have drop-off analytics?" |
| Concepts | What domain principles apply? | "Retention hooks, loss aversion" |
| Inferences | What are we concluding, is it justified? | "We infer tutorial is too long — is it?" |
| Implications | What follows from our choices? | "Shorter tutorial → users miss core loop?" |

### Task-Type Profiles

| Profile | Default Elements | Typical Tasks |
|---------|-----------------|---------------|
| feature | Purpose, Point of View, Implications, Concepts | New features, UI changes |
| bugfix | Assumptions, Information, Inferences, Question at Issue | Bug fixes, debugging |
| refactor | Purpose, Concepts, Implications, Assumptions | Refactoring, architecture changes |
| auto | Detected from task description | Default — skill auto-selects |
| custom | User-specified via `elements` param | Special cases |

### Phase 1: Before Action (Inquiry)

1. `maieutic_begin(task)` — creates inquiry, generates root questions per profile
2. Dispatch root questions to **parallel subagents** (one per element)
3. Each subagent: calls `maieutic_recall` for past reasoning, formulates answer, calls `maieutic_answer` with optional follow-up spawns
4. Coordinator waits for all subagents, calls `maieutic_synthesize(round=0)`
5. If depth allows and open threads remain → dispatch round 1 subagents
6. Present briefing to user (per visibility config)
7. Proceed with task

### Phase 2: During Action (Check-in)

Triggered periodically or when drift is detected:
- Scope creep: "Am I adding things the user didn't ask for?"
- Means-end inversion: "Am I optimizing for elegance when the goal is engagement?"
- Assumption violation: "Did I discover something that contradicts my starting assumptions?"

Process: `maieutic_recall` original purpose → `maieutic_ask` alignment question → course-correct or continue.

### Phase 3: After Action (Reflection)

`maieutic_reflect` records what worked, what was missed, and the key insight. Key insight is indexed into FTS5 for future `maieutic_recall` searches.

### Depth Profiles

| Setting | Root Questions | Max Rounds | Subagents | Typical Use |
|---------|--------------|------------|-----------|-------------|
| shallow | 2-3 | 1 | 1-2 | Quick tasks, bug fixes |
| medium | 4-5 | 2 | 3-4 | Features, refactors |
| deep | 6-8 | 3+ | 4-6 | Architecture, unfamiliar domains |
| custom | user-defined | user-defined | user-defined | Special cases |

### Visibility Modes

| Mode | Before | During | After |
|------|--------|--------|-------|
| silent | Only unresolved questions | Only drift alerts | Key insight only |
| summary | Briefing + unresolved | Drift alerts + reasoning | Full reflection |
| verbose | Every Q&A in real-time | Every check-in shown | Full reflection + Q&A log |

## Subagent Coordination Protocol

### Round-Based Dispatch

1. Coordinator dispatches subagents with `{inquiry_id, question_id, db_path}`
2. Each subagent reads its question, calls `maieutic_recall` for past + sibling answers
3. Subagent records answer via `maieutic_answer`, optionally spawns follow-ups
4. Coordinator waits for all, reads round answers, calls `maieutic_synthesize`
5. Synthesis creates `question_links` for cross-branch connections
6. If depth allows → dispatch next round with spawned questions
7. If done → compile briefing

### Concurrency Model

- **WAL mode** ensures readers don't block writers
- Subagents **write** their own answers independently (no write conflicts — different questions)
- Subagents **read** shared DB for sibling answers (eventual consistency is fine)
- **Coordinator only** writes to `syntheses` and `question_links`

### Subagent Prompt Template

```
You are investigating a specific aspect of a task using Socratic questioning.

TASK: {task_description}
YOUR ELEMENT: {element}
YOUR QUESTION: {question_text}
INQUIRY CONTEXT: {synthesis_from_previous_rounds}

You have access to maieutic_recall and maieutic_answer tools.

Process:
1. Search for relevant past reasoning: maieutic_recall("{query}")
2. Check what sibling agents found: maieutic_recall with inquiry filter
3. Reason about your question, incorporating what you found
4. Record your answer: maieutic_answer({answer, confidence, spawn})
5. If your answer reveals sub-questions, include them in spawn[]

Be honest about confidence. Guessing = 0.3. Solid evidence = 0.8+.
```

## Project Structure

```
cc-cyber-maieutics/
├── plugin/                          # MCP Plugin (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # MCP server entry point
│   │   ├── tools/
│   │   │   ├── begin.ts
│   │   │   ├── ask.ts
│   │   │   ├── answer.ts
│   │   │   ├── recall.ts
│   │   │   ├── synthesize.ts
│   │   │   ├── reflect.ts
│   │   │   └── config.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── connection.ts
│   │   │   └── fts.ts
│   │   └── types.ts
│   └── tests/
│       ├── tools/
│       └── db/
│
├── skill/
│   └── maieutic.md
│
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-01-maieutic-engine-design.md
│
└── .maieutic/                       # Per-project runtime (gitignored)
    └── maieutic.db
```

## Technology Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| MCP server | `@modelcontextprotocol/sdk` | Standard MCP TypeScript SDK |
| SQLite | `better-sqlite3` | Synchronous, proven in context-mode, WAL support |
| FTS | SQLite FTS5 + Porter stemmer | Built-in, no external deps |
| UUID | `crypto.randomUUID()` | Node built-in |
| Build | `tsup` or `tsc` | Minimal bundling |
| Tests | `vitest` | Fast, TypeScript-native |

## DB Location Strategy

- **Default:** `.maieutic/maieutic.db` in project root (project-scoped)
- **Global:** `~/.claude/maieutic/maieutic.db` for cross-project recall
- **Configurable:** `MAIEUTIC_DB_DIR` environment variable
- `.maieutic/` added to `.gitignore`

## Installation

MCP config in `.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "maieutic-engine": {
      "command": "node",
      "args": ["<path>/cc-cyber-maieutics/plugin/dist/index.js"],
      "env": {
        "MAIEUTIC_DB_DIR": ".maieutic"
      }
    }
  }
}
```

Skill installed to project or user skill directory, triggerable by `/maieutic`, `/socratic`, or natural language.

## Acknowledgements

- **Elder, Linda & Paul, Richard.** *The Thinker's Guide to The Art of Socratic Questioning.* Foundation for Critical Thinking, 2006. — Provided the taxonomy of Socratic questions based on the 8 Elements of Thought and Universal Intellectual Standards that form the questioning engine's theoretical foundation.
- **Berryman, John & Ziegler, Albert.** *Prompt Engineering for LLMs: The Art and Science of Building Large Language Model-Based Applications.* O'Reilly Media, 2024. — Informed the technical architecture through Chain of Thought, ReAct, Reflexion, Branch-Solve-Merge, and context management patterns for LLM-based agents.
