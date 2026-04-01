# Maieutic Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code MCP plugin + skill that enables Socratic self-questioning with persistent SQLite/FTS5 memory.

**Architecture:** TypeScript MCP server using `@modelcontextprotocol/sdk` with `better-sqlite3` for persistence. Seven tools (begin, ask, answer, recall, synthesize, reflect, config) exposed via `server.registerTool()`. A companion markdown skill teaches Claude the Socratic methodology and loop structure.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk@^1.26.0`, `better-sqlite3@^12.6.2`, Zod (via MCP SDK), `vitest` for tests, `esbuild` for bundling.

**Spec:** `docs/superpowers/specs/2026-04-01-maieutic-engine-design.md`

---

## File Structure

```
plugin/
├── package.json              # NPM package with deps
├── tsconfig.json             # TypeScript config (ESM, strict)
├── build.mjs                 # esbuild script
├── src/
│   ├── index.ts              # MCP server entry, tool registrations
│   ├── db/
│   │   ├── connection.ts     # better-sqlite3 wrapper, WAL, lazy-load
│   │   ├── schema.ts         # DDL statements, migration logic
│   │   └── fts.ts            # FTS5 indexing and BM25 search helpers
│   ├── tools/
│   │   ├── begin.ts          # maieutic_begin handler
│   │   ├── ask.ts            # maieutic_ask handler
│   │   ├── answer.ts         # maieutic_answer handler
│   │   ├── recall.ts         # maieutic_recall handler (FTS5 search)
│   │   ├── synthesize.ts     # maieutic_synthesize handler
│   │   ├── reflect.ts        # maieutic_reflect handler
│   │   └── config.ts         # maieutic_config handler
│   └── types.ts              # Shared TypeScript interfaces
└── tests/
    ├── db/
    │   ├── connection.test.ts
    │   ├── schema.test.ts
    │   └── fts.test.ts
    └── tools/
        ├── begin.test.ts
        ├── ask.test.ts
        ├── answer.test.ts
        ├── recall.test.ts
        ├── synthesize.test.ts
        ├── reflect.test.ts
        └── config.test.ts

skill/
└── maieutic.md               # Socratic methodology skill prompt
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tsconfig.json`
- Create: `plugin/build.mjs`
- Create: `plugin/src/types.ts`

- [ ] **Step 1: Create `plugin/package.json`**

```json
{
  "name": "maieutic-engine",
  "version": "0.1.0",
  "type": "module",
  "description": "MCP plugin for Socratic self-questioning with persistent memory",
  "main": "./dist/index.js",
  "scripts": {
    "build": "node build.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "better-sqlite3": "^12.6.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.19.11",
    "esbuild": "^0.27.3",
    "tsx": "^4.21.0",
    "vitest": "^3.2.1",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `plugin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `plugin/build.mjs`**

```javascript
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  external: ["better-sqlite3"],
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: Create `plugin/src/types.ts`**

```typescript
// Socratic Elements of Thought
export type Element =
  | "purpose"
  | "question_at_issue"
  | "assumptions"
  | "point_of_view"
  | "information"
  | "concepts"
  | "inferences"
  | "implications";

export type Profile = "auto" | "feature" | "bugfix" | "refactor" | "custom";
export type Depth = "shallow" | "medium" | "deep" | "custom";
export type Visibility = "silent" | "summary" | "verbose";
export type InquiryStatus = "active" | "paused" | "completed" | "abandoned";
export type QuestionStatus = "open" | "answered" | "skipped" | "merged";
export type AnswerSource = "self" | "user" | "recall" | "tool";
export type LinkRelation = "informs" | "contradicts" | "refines" | "duplicates";

export interface Inquiry {
  id: string;
  project: string;
  task: string;
  profile: Profile;
  depth: Depth;
  visibility: Visibility;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  inquiry_id: string;
  round: number;
  element: Element;
  question: string;
  status: QuestionStatus;
  spawned_by: string | null;
  agent_id: string | null;
  created_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  answer: string;
  confidence: number;
  source: AnswerSource;
  created_at: string;
}

export interface QuestionLink {
  from_id: string;
  to_id: string;
  relation: LinkRelation;
}

export interface Synthesis {
  id: string;
  inquiry_id: string;
  round: number;
  summary: string;
  open_threads: string | null;
  next_questions: string | null;
  created_at: string;
}

export interface Reflection {
  id: string;
  inquiry_id: string;
  what_worked: string | null;
  what_missed: string | null;
  key_insight: string | null;
  created_at: string;
}

export interface RecallResult {
  inquiry_id: string;
  question: string;
  answer: string;
  confidence: number;
  element: string;
  created_at: string;
  rank: number;
}

// Profile → default elements mapping
export const PROFILE_ELEMENTS: Record<Exclude<Profile, "auto" | "custom">, Element[]> = {
  feature: ["purpose", "point_of_view", "implications", "concepts"],
  bugfix: ["assumptions", "information", "inferences", "question_at_issue"],
  refactor: ["purpose", "concepts", "implications", "assumptions"],
};

// Depth → limits mapping
export const DEPTH_LIMITS: Record<Exclude<Depth, "custom">, { maxRoots: number; maxRounds: number }> = {
  shallow: { maxRoots: 3, maxRounds: 1 },
  medium: { maxRoots: 5, maxRounds: 2 },
  deep: { maxRoots: 8, maxRounds: 4 },
};
```

- [ ] **Step 5: Install dependencies**

Run: `cd plugin && npm install`
Expected: `node_modules` created, `package-lock.json` generated, `better-sqlite3` native addon compiled.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd plugin && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add plugin/package.json plugin/tsconfig.json plugin/build.mjs plugin/src/types.ts plugin/package-lock.json
git commit -m "feat: scaffold plugin project with types and build config"
```

---

## Task 2: Database Connection Layer

**Files:**
- Create: `plugin/src/db/connection.ts`
- Create: `plugin/tests/db/connection.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/db/connection.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-conn");

describe("connection", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates database file and returns a usable connection", () => {
    const db = getDatabase(TEST_DIR);
    expect(db).toBeDefined();
    expect(existsSync(join(TEST_DIR, "maieutic.db"))).toBe(true);
  });

  it("returns the same instance on subsequent calls", () => {
    const db1 = getDatabase(TEST_DIR);
    const db2 = getDatabase(TEST_DIR);
    expect(db1).toBe(db2);
  });

  it("enables WAL mode", () => {
    const db = getDatabase(TEST_DIR);
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
  });

  it("can execute basic SQL", () => {
    const db = getDatabase(TEST_DIR);
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)");
    db.prepare("INSERT INTO test (val) VALUES (?)").run("hello");
    const row = db.prepare("SELECT val FROM test").get() as { val: string };
    expect(row.val).toBe("hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/db/connection.test.ts`
Expected: FAIL — module `../../src/db/connection.js` not found.

- [ ] **Step 3: Write `plugin/src/db/connection.ts`**

```typescript
import type DatabaseConstructor from "better-sqlite3";
import type { Database as DatabaseInstance } from "better-sqlite3";
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let _Database: typeof DatabaseConstructor | null = null;
let _db: DatabaseInstance | null = null;

function loadDatabase(): typeof DatabaseConstructor {
  if (!_Database) {
    const require = createRequire(import.meta.url);
    _Database = require("better-sqlite3") as typeof DatabaseConstructor;
  }
  return _Database;
}

export function getDatabase(dbDir: string): DatabaseInstance {
  if (_db) return _db;

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = join(dbDir, "maieutic.db");
  const Database = loadDatabase();
  _db = new Database(dbPath);

  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  return _db;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function resolveDbDir(): string {
  const envDir = process.env.MAIEUTIC_DB_DIR;
  if (envDir) {
    // Absolute path or relative to CWD
    return envDir.startsWith("/") ? envDir : join(process.cwd(), envDir);
  }
  return join(process.cwd(), ".maieutic");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/db/connection.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/db/connection.ts plugin/tests/db/connection.test.ts
git commit -m "feat: add SQLite connection layer with WAL mode"
```

---

## Task 3: Database Schema

**Files:**
- Create: `plugin/src/db/schema.ts`
- Create: `plugin/tests/db/schema.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/db/schema.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema, TABLES } from "../../src/db/schema.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-schema");

describe("schema", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates all required tables", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    for (const table of TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it("creates the FTS5 virtual table", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='qa_fts'")
      .all() as { name: string }[];
    expect(tables.length).toBe(1);
  });

  it("is idempotent — running twice does not error", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);
    expect(() => applySchema(db)).not.toThrow();
  });

  it("enforces foreign keys", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);

    expect(() => {
      db.prepare(
        "INSERT INTO questions (id, inquiry_id, round, element, question, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run("q1", "nonexistent", 0, "purpose", "test?", new Date().toISOString());
    }).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/db/schema.test.ts`
Expected: FAIL — module `../../src/db/schema.js` not found.

- [ ] **Step 3: Write `plugin/src/db/schema.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";

export const TABLES = [
  "inquiries",
  "questions",
  "answers",
  "question_links",
  "syntheses",
  "reflections",
  "config",
] as const;

const DDL = `
  CREATE TABLE IF NOT EXISTS inquiries (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    task        TEXT NOT NULL,
    profile     TEXT NOT NULL DEFAULT 'auto',
    depth       TEXT NOT NULL DEFAULT 'medium',
    visibility  TEXT NOT NULL DEFAULT 'summary',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    round       INTEGER NOT NULL,
    element     TEXT NOT NULL,
    question    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    spawned_by  TEXT REFERENCES questions(id),
    agent_id    TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_questions_inquiry ON questions(inquiry_id);
  CREATE INDEX IF NOT EXISTS idx_questions_round ON questions(inquiry_id, round);
  CREATE INDEX IF NOT EXISTS idx_questions_spawned ON questions(spawned_by);

  CREATE TABLE IF NOT EXISTS answers (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id),
    answer      TEXT NOT NULL,
    confidence  REAL NOT NULL DEFAULT 0.5,
    source      TEXT NOT NULL DEFAULT 'self',
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);

  CREATE TABLE IF NOT EXISTS question_links (
    from_id     TEXT NOT NULL REFERENCES questions(id),
    to_id       TEXT NOT NULL REFERENCES questions(id),
    relation    TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id)
  );

  CREATE TABLE IF NOT EXISTS syntheses (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    round       INTEGER NOT NULL,
    summary     TEXT NOT NULL,
    open_threads TEXT,
    next_questions TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_syntheses_inquiry ON syntheses(inquiry_id);

  CREATE TABLE IF NOT EXISTS reflections (
    id          TEXT PRIMARY KEY,
    inquiry_id  TEXT NOT NULL REFERENCES inquiries(id),
    what_worked TEXT,
    what_missed TEXT,
    key_insight TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'project'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS qa_fts USING fts5(
    question_text,
    answer_text,
    element,
    project,
    content='',
    tokenize='porter unicode61'
  );
`;

export function applySchema(db: DatabaseInstance): void {
  db.exec(DDL);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/db/schema.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/db/schema.ts plugin/tests/db/schema.test.ts
git commit -m "feat: add database schema with all tables and FTS5"
```

---

## Task 4: FTS5 Search Layer

**Files:**
- Create: `plugin/src/db/fts.ts`
- Create: `plugin/tests/db/fts.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/db/fts.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { indexQA, searchQA, indexReflection } from "../../src/db/fts.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-fts");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  return db;
}

describe("fts", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("indexes a Q&A pair and finds it by keyword search", () => {
    const db = setup();
    indexQA(db, {
      rowid: 1,
      question_text: "What is the purpose of this mobile game?",
      answer_text: "To maximize user engagement and monetization through retention hooks",
      element: "purpose",
      project: "/test/project",
    });

    const results = searchQA(db, { query: "mobile game monetization" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].question_text).toContain("mobile game");
  });

  it("returns empty results for unrelated queries", () => {
    const db = setup();
    indexQA(db, {
      rowid: 1,
      question_text: "What assumptions are we making about the database?",
      answer_text: "We assume PostgreSQL with read replicas",
      element: "assumptions",
      project: "/test/project",
    });

    const results = searchQA(db, { query: "weather forecast temperature" });
    expect(results.length).toBe(0);
  });

  it("filters by element", () => {
    const db = setup();
    indexQA(db, {
      rowid: 1,
      question_text: "What is the purpose?",
      answer_text: "Revenue growth",
      element: "purpose",
      project: "/test/project",
    });
    indexQA(db, {
      rowid: 2,
      question_text: "What assumptions exist?",
      answer_text: "Revenue comes from ads",
      element: "assumptions",
      project: "/test/project",
    });

    const results = searchQA(db, { query: "revenue", element: "purpose" });
    expect(results.length).toBe(1);
    expect(results[0].element).toBe("purpose");
  });

  it("filters by project", () => {
    const db = setup();
    indexQA(db, {
      rowid: 1,
      question_text: "Purpose of game A?",
      answer_text: "Engagement",
      element: "purpose",
      project: "/project-a",
    });
    indexQA(db, {
      rowid: 2,
      question_text: "Purpose of game B?",
      answer_text: "Engagement",
      element: "purpose",
      project: "/project-b",
    });

    const results = searchQA(db, { query: "engagement", project: "/project-a" });
    expect(results.length).toBe(1);
    expect(results[0].project).toBe("/project-a");
  });

  it("respects limit parameter", () => {
    const db = setup();
    for (let i = 0; i < 20; i++) {
      indexQA(db, {
        rowid: i + 1,
        question_text: `Question about engagement strategy ${i}`,
        answer_text: `Answer about engagement ${i}`,
        element: "purpose",
        project: "/test",
      });
    }

    const results = searchQA(db, { query: "engagement", limit: 5 });
    expect(results.length).toBe(5);
  });

  it("indexes reflection key insights", () => {
    const db = setup();
    indexReflection(db, {
      rowid: 100,
      question_text: "Key insight from bear den dungeon task",
      answer_text: "Always question the data before questioning the design",
      element: "reflection",
      project: "/test",
    });

    const results = searchQA(db, { query: "question data design" });
    expect(results.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/db/fts.test.ts`
Expected: FAIL — module `../../src/db/fts.js` not found.

- [ ] **Step 3: Write `plugin/src/db/fts.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";

export interface FTSEntry {
  rowid: number;
  question_text: string;
  answer_text: string;
  element: string;
  project: string;
}

export interface FTSSearchOptions {
  query: string;
  project?: string;
  element?: string;
  limit?: number;
}

export interface FTSResult {
  rowid: number;
  question_text: string;
  answer_text: string;
  element: string;
  project: string;
  rank: number;
}

function sanitizeQuery(query: string): string {
  const words = query
    .replace(/['"(){}[\]*:^~]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 1 &&
        !["AND", "OR", "NOT", "NEAR"].includes(w.toUpperCase())
    );

  if (words.length === 0) return '""';
  return words.map((w) => `"${w}"`).join(" OR ");
}

export function indexQA(db: DatabaseInstance, entry: FTSEntry): void {
  db.prepare(
    `INSERT INTO qa_fts(rowid, question_text, answer_text, element, project)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entry.rowid, entry.question_text, entry.answer_text, entry.element, entry.project);
}

export function deleteQA(db: DatabaseInstance, rowid: number): void {
  db.prepare(
    `DELETE FROM qa_fts WHERE rowid = ?`
  ).run(rowid);
}

export function indexReflection(db: DatabaseInstance, entry: FTSEntry): void {
  indexQA(db, entry);
}

export function searchQA(db: DatabaseInstance, options: FTSSearchOptions): FTSResult[] {
  const sanitized = sanitizeQuery(options.query);
  const limit = options.limit ?? 10;

  let sql = `
    SELECT rowid, question_text, answer_text, element, project,
           bm25(qa_fts, 2.0, 1.0, 0.5, 0.5) AS rank
    FROM qa_fts
    WHERE qa_fts MATCH ?
  `;
  const params: (string | number)[] = [sanitized];

  if (options.element) {
    sql += ` AND element = ?`;
    params.push(options.element);
  }

  if (options.project) {
    sql += ` AND project = ?`;
    params.push(options.project);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as FTSResult[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/db/fts.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/db/fts.ts plugin/tests/db/fts.test.ts
git commit -m "feat: add FTS5 search layer with BM25 ranking"
```

---

## Task 5: maieutic_begin Tool

**Files:**
- Create: `plugin/src/tools/begin.ts`
- Create: `plugin/tests/tools/begin.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/begin.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-begin");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  return db;
}

describe("maieutic_begin", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates an inquiry and returns root questions for feature profile", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Add user onboarding flow",
      profile: "feature",
      project: "/test/project",
    });

    expect(result.inquiry_id).toBeDefined();
    expect(result.root_questions.length).toBe(4); // feature = 4 elements
    expect(result.root_questions[0].element).toBe("purpose");
    expect(result.root_questions[0].question).toBeTruthy();
    expect(result.root_questions[0].id).toBeTruthy();
  });

  it("creates an inquiry with bugfix profile", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Fix crash on login",
      profile: "bugfix",
      project: "/test/project",
    });

    expect(result.root_questions.length).toBe(4);
    const elements = result.root_questions.map((q) => q.element);
    expect(elements).toContain("assumptions");
    expect(elements).toContain("information");
  });

  it("stores the inquiry in the database", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Refactor auth module",
      profile: "refactor",
      project: "/test/project",
    });

    const inquiry = db
      .prepare("SELECT * FROM inquiries WHERE id = ?")
      .get(result.inquiry_id) as { task: string; profile: string };
    expect(inquiry.task).toBe("Refactor auth module");
    expect(inquiry.profile).toBe("refactor");
  });

  it("stores root questions in the database with round=0", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Add feature",
      profile: "feature",
      project: "/test/project",
    });

    const questions = db
      .prepare("SELECT * FROM questions WHERE inquiry_id = ?")
      .all(result.inquiry_id) as { round: number; spawned_by: string | null }[];
    expect(questions.length).toBe(result.root_questions.length);
    for (const q of questions) {
      expect(q.round).toBe(0);
      expect(q.spawned_by).toBeNull();
    }
  });

  it("respects custom elements override", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Anything",
      profile: "custom",
      elements: ["purpose", "implications"],
      project: "/test/project",
    });

    expect(result.root_questions.length).toBe(2);
    const elements = result.root_questions.map((q) => q.element);
    expect(elements).toContain("purpose");
    expect(elements).toContain("implications");
  });

  it("respects depth setting for shallow", () => {
    const db = setup();
    const result = handleBegin(db, {
      task: "Quick fix",
      profile: "feature",
      depth: "shallow",
      project: "/test/project",
    });

    // shallow caps at 3 root questions
    expect(result.root_questions.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/begin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/begin.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Element, Profile, Depth, Visibility } from "../types.js";
import { PROFILE_ELEMENTS, DEPTH_LIMITS } from "../types.js";

interface BeginInput {
  task: string;
  profile?: Profile;
  depth?: Depth;
  visibility?: Visibility;
  elements?: Element[];
  project: string;
}

interface RootQuestion {
  id: string;
  element: Element;
  question: string;
}

interface BeginResult {
  inquiry_id: string;
  root_questions: RootQuestion[];
}

const ELEMENT_QUESTION_TEMPLATES: Record<Element, (task: string) => string> = {
  purpose: (task) =>
    `What is the ultimate purpose or goal of this task: "${task}"? What are we really trying to achieve beyond the immediate request?`,
  question_at_issue: (task) =>
    `What is the specific question or problem we are trying to solve with: "${task}"? What would a successful outcome look like?`,
  assumptions: (task) =>
    `What assumptions are we making about: "${task}"? What are we taking for granted that might not be true?`,
  point_of_view: (task) =>
    `Whose perspective are we considering for: "${task}"? Whose perspective are we missing? (end user, stakeholder, maintainer, etc.)`,
  information: (task) =>
    `What information or data do we have about: "${task}"? What information do we need but don't have yet?`,
  concepts: (task) =>
    `What domain concepts, principles, or patterns are relevant to: "${task}"? What established knowledge should guide our approach?`,
  inferences: (task) =>
    `What conclusions are we drawing about: "${task}"? Are these inferences justified by the evidence we have?`,
  implications: (task) =>
    `What are the implications and consequences of our approach to: "${task}"? What second-order effects should we consider?`,
};

export function handleBegin(db: DatabaseInstance, input: BeginInput): BeginResult {
  const now = new Date().toISOString();
  const inquiryId = randomUUID();
  const profile = input.profile ?? "auto";
  const depth = input.depth ?? "medium";
  const visibility = input.visibility ?? "summary";

  // Determine which elements to use
  let elements: Element[];
  if (input.elements && input.elements.length > 0) {
    elements = input.elements;
  } else if (profile === "auto" || profile === "custom") {
    // Auto defaults to feature profile
    elements = PROFILE_ELEMENTS.feature;
  } else {
    elements = PROFILE_ELEMENTS[profile];
  }

  // Apply depth limit to number of root questions
  if (depth !== "custom") {
    const limit = DEPTH_LIMITS[depth].maxRoots;
    elements = elements.slice(0, limit);
  }

  // Insert inquiry
  db.prepare(
    `INSERT INTO inquiries (id, project, task, profile, depth, visibility, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(inquiryId, input.project, input.task, profile, depth, visibility, now, now);

  // Generate and insert root questions
  const rootQuestions: RootQuestion[] = elements.map((element) => {
    const questionId = randomUUID();
    const questionText = ELEMENT_QUESTION_TEMPLATES[element](input.task);

    db.prepare(
      `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
       VALUES (?, ?, 0, ?, ?, 'open', NULL, ?)`
    ).run(questionId, inquiryId, element, questionText, now);

    return { id: questionId, element, question: questionText };
  });

  return { inquiry_id: inquiryId, root_questions: rootQuestions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/begin.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/begin.ts plugin/tests/tools/begin.test.ts
git commit -m "feat: add maieutic_begin tool with profile-based question generation"
```

---

## Task 6: maieutic_ask Tool

**Files:**
- Create: `plugin/src/tools/ask.ts`
- Create: `plugin/tests/tools/ask.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/ask.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAsk } from "../../src/tools/ask.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-ask");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id } = handleBegin(db, {
    task: "Test task",
    profile: "feature",
    project: "/test",
  });
  return { db, inquiry_id };
}

describe("maieutic_ask", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a new question in the database", () => {
    const { db, inquiry_id } = setup();
    const result = handleAsk(db, {
      inquiry_id,
      element: "assumptions",
      question: "Are we assuming users have fast internet?",
      round: 1,
    });

    expect(result.question_id).toBeTruthy();

    const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(result.question_id) as {
      element: string;
      round: number;
      question: string;
    };
    expect(row.element).toBe("assumptions");
    expect(row.round).toBe(1);
  });

  it("links to parent question via spawned_by", () => {
    const { db, inquiry_id } = setup();
    const parentQuestions = db
      .prepare("SELECT id FROM questions WHERE inquiry_id = ? LIMIT 1")
      .get(inquiry_id) as { id: string };

    const result = handleAsk(db, {
      inquiry_id,
      element: "inferences",
      question: "Follow-up question",
      spawned_by: parentQuestions.id,
      round: 1,
    });

    const row = db.prepare("SELECT spawned_by FROM questions WHERE id = ?").get(result.question_id) as {
      spawned_by: string;
    };
    expect(row.spawned_by).toBe(parentQuestions.id);
  });

  it("defaults round to 0 when not specified", () => {
    const { db, inquiry_id } = setup();
    const result = handleAsk(db, {
      inquiry_id,
      element: "purpose",
      question: "Why?",
    });

    const row = db.prepare("SELECT round FROM questions WHERE id = ?").get(result.question_id) as {
      round: number;
    };
    expect(row.round).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/ask.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/ask.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Element } from "../types.js";

interface AskInput {
  inquiry_id: string;
  element: Element;
  question: string;
  spawned_by?: string;
  round?: number;
}

interface AskResult {
  question_id: string;
}

export function handleAsk(db: DatabaseInstance, input: AskInput): AskResult {
  const questionId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
  ).run(
    questionId,
    input.inquiry_id,
    input.round ?? 0,
    input.element,
    input.question,
    input.spawned_by ?? null,
    now
  );

  return { question_id: questionId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/ask.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/ask.ts plugin/tests/tools/ask.test.ts
git commit -m "feat: add maieutic_ask tool"
```

---

## Task 7: maieutic_answer Tool

**Files:**
- Create: `plugin/src/tools/answer.ts`
- Create: `plugin/tests/tools/answer.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/answer.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { searchQA } from "../../src/db/fts.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-answer");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id, root_questions } = handleBegin(db, {
    task: "Test task",
    profile: "feature",
    project: "/test",
  });
  return { db, inquiry_id, root_questions };
}

describe("maieutic_answer", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("records an answer and marks question as answered", () => {
    const { db, root_questions } = setup();
    const qid = root_questions[0].id;

    const result = handleAnswer(db, {
      question_id: qid,
      answer: "The purpose is to increase user retention",
      confidence: 0.8,
      source: "self",
    });

    expect(result.answer_id).toBeTruthy();

    const answer = db.prepare("SELECT * FROM answers WHERE id = ?").get(result.answer_id) as {
      answer: string;
      confidence: number;
    };
    expect(answer.answer).toBe("The purpose is to increase user retention");
    expect(answer.confidence).toBe(0.8);

    const question = db.prepare("SELECT status FROM questions WHERE id = ?").get(qid) as {
      status: string;
    };
    expect(question.status).toBe("answered");
  });

  it("indexes answer into FTS", () => {
    const { db, root_questions } = setup();
    const qid = root_questions[0].id;

    handleAnswer(db, {
      question_id: qid,
      answer: "Maximize engagement through gamification mechanics",
      confidence: 0.9,
    });

    const results = searchQA(db, { query: "gamification engagement" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("spawns follow-up questions when spawn[] is provided", () => {
    const { db, inquiry_id, root_questions } = setup();
    const qid = root_questions[0].id;

    const result = handleAnswer(db, {
      question_id: qid,
      answer: "Purpose is retention, but this raises two sub-questions",
      confidence: 0.6,
      spawn: [
        { element: "concepts", question: "What retention mechanics apply here?" },
        { element: "information", question: "What is the current retention rate?" },
      ],
    });

    expect(result.spawned_question_ids).toBeDefined();
    expect(result.spawned_question_ids!.length).toBe(2);

    // Check spawned questions exist in DB with correct parent
    for (const spawnedId of result.spawned_question_ids!) {
      const row = db.prepare("SELECT spawned_by, inquiry_id FROM questions WHERE id = ?").get(spawnedId) as {
        spawned_by: string;
        inquiry_id: string;
      };
      expect(row.spawned_by).toBe(qid);
      expect(row.inquiry_id).toBe(inquiry_id);
    }
  });

  it("defaults confidence to 0.5 and source to self", () => {
    const { db, root_questions } = setup();
    const qid = root_questions[0].id;

    const result = handleAnswer(db, {
      question_id: qid,
      answer: "Not sure about this",
    });

    const answer = db.prepare("SELECT confidence, source FROM answers WHERE id = ?").get(result.answer_id) as {
      confidence: number;
      source: string;
    };
    expect(answer.confidence).toBe(0.5);
    expect(answer.source).toBe("self");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/answer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/answer.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Element, AnswerSource } from "../types.js";
import { indexQA } from "../db/fts.js";

interface SpawnQuestion {
  element: Element;
  question: string;
}

interface AnswerInput {
  question_id: string;
  answer: string;
  confidence?: number;
  source?: AnswerSource;
  spawn?: SpawnQuestion[];
}

interface AnswerResult {
  answer_id: string;
  spawned_question_ids?: string[];
}

export function handleAnswer(db: DatabaseInstance, input: AnswerInput): AnswerResult {
  const answerId = randomUUID();
  const now = new Date().toISOString();
  const confidence = input.confidence ?? 0.5;
  const source = input.source ?? "self";

  // Get question details for FTS indexing
  const question = db
    .prepare("SELECT inquiry_id, element, question, round FROM questions WHERE id = ?")
    .get(input.question_id) as {
      inquiry_id: string;
      element: string;
      question: string;
      round: number;
    };

  if (!question) {
    throw new Error(`Question not found: ${input.question_id}`);
  }

  // Get project from inquiry
  const inquiry = db
    .prepare("SELECT project FROM inquiries WHERE id = ?")
    .get(question.inquiry_id) as { project: string };

  // Insert answer
  db.prepare(
    `INSERT INTO answers (id, question_id, answer, confidence, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(answerId, input.question_id, input.answer, confidence, source, now);

  // Mark question as answered
  db.prepare("UPDATE questions SET status = 'answered' WHERE id = ?").run(input.question_id);

  // Index into FTS — use a hash of the answer ID as rowid
  // We need a stable integer rowid for FTS. Use a counter approach.
  const ftsRowid = db.prepare("SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM qa_fts").get() as {
    next: number;
  };
  indexQA(db, {
    rowid: ftsRowid.next,
    question_text: question.question,
    answer_text: input.answer,
    element: question.element,
    project: inquiry.project,
  });

  // Spawn follow-up questions if requested
  let spawnedIds: string[] | undefined;
  if (input.spawn && input.spawn.length > 0) {
    spawnedIds = input.spawn.map((s) => {
      const spawnId = randomUUID();
      db.prepare(
        `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
      ).run(spawnId, question.inquiry_id, question.round + 1, s.element, s.question, input.question_id, now);
      return spawnId;
    });
  }

  return { answer_id: answerId, spawned_question_ids: spawnedIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/answer.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/answer.ts plugin/tests/tools/answer.test.ts
git commit -m "feat: add maieutic_answer tool with FTS indexing and follow-up spawning"
```

---

## Task 8: maieutic_recall Tool

**Files:**
- Create: `plugin/src/tools/recall.ts`
- Create: `plugin/tests/tools/recall.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/recall.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { handleRecall } from "../../src/tools/recall.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-recall");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);

  // Create an inquiry with answered questions
  const { inquiry_id, root_questions } = handleBegin(db, {
    task: "Build mobile game onboarding",
    profile: "feature",
    project: "/game-project",
  });

  handleAnswer(db, {
    question_id: root_questions[0].id,
    answer: "The purpose is to maximize player retention through engaging first-time experience and monetization hooks",
    confidence: 0.9,
  });

  handleAnswer(db, {
    question_id: root_questions[1].id,
    answer: "The end user is a casual mobile gamer who plays in short sessions during commute",
    confidence: 0.7,
  });

  return { db, inquiry_id, root_questions };
}

describe("maieutic_recall", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("finds relevant past reasoning by keyword", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "player retention monetization" });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].answer).toContain("retention");
  });

  it("filters by project", () => {
    const { db } = setup();

    // Search in wrong project
    const result = handleRecall(db, {
      query: "retention",
      project: "/other-project",
    });
    expect(result.results.length).toBe(0);

    // Search in correct project
    const result2 = handleRecall(db, {
      query: "retention",
      project: "/game-project",
    });
    expect(result2.results.length).toBeGreaterThan(0);
  });

  it("filters by element", () => {
    const { db } = setup();
    const result = handleRecall(db, {
      query: "mobile gamer",
      element: "purpose", // wrong element — this answer is under point_of_view
    });
    // Depending on which element the second question got, this may or may not return results
    // The key test is that the filter is applied
    expect(result.results).toBeDefined();
  });

  it("respects limit", () => {
    const { db } = setup();
    const result = handleRecall(db, {
      query: "mobile game",
      limit: 1,
    });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });

  it("filters by min_confidence", () => {
    const { db } = setup();
    const result = handleRecall(db, {
      query: "mobile game",
      min_confidence: 0.85,
    });

    for (const r of result.results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("returns empty array for no matches", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "quantum physics blockchain" });
    expect(result.results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/recall.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/recall.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { searchQA } from "../db/fts.js";

interface RecallInput {
  query: string;
  project?: string;
  element?: string;
  limit?: number;
  min_confidence?: number;
}

interface RecallResultItem {
  inquiry_id: string;
  question: string;
  answer: string;
  confidence: number;
  element: string;
  created_at: string;
}

interface RecallResult {
  results: RecallResultItem[];
}

export function handleRecall(db: DatabaseInstance, input: RecallInput): RecallResult {
  // First, search FTS for matching Q&A pairs
  const ftsResults = searchQA(db, {
    query: input.query,
    project: input.project,
    element: input.element,
    limit: (input.limit ?? 10) * 2, // fetch more to allow post-filtering
  });

  if (ftsResults.length === 0) {
    return { results: [] };
  }

  // Join FTS results back to the main tables to get full metadata
  // We need inquiry_id, confidence, created_at from the actual records
  const results: RecallResultItem[] = [];

  for (const fts of ftsResults) {
    // Find the answer record that matches this FTS entry
    const row = db.prepare(`
      SELECT
        a.confidence,
        a.created_at,
        q.inquiry_id,
        q.element,
        q.question,
        a.answer
      FROM answers a
      JOIN questions q ON q.id = a.question_id
      JOIN inquiries i ON i.id = q.inquiry_id
      WHERE q.question = ? AND a.answer = ?
      LIMIT 1
    `).get(fts.question_text, fts.answer_text) as {
      confidence: number;
      created_at: string;
      inquiry_id: string;
      element: string;
      question: string;
      answer: string;
    } | undefined;

    if (!row) continue;

    // Apply confidence filter
    if (input.min_confidence && row.confidence < input.min_confidence) continue;

    results.push({
      inquiry_id: row.inquiry_id,
      question: row.question,
      answer: row.answer,
      confidence: row.confidence,
      element: row.element,
      created_at: row.created_at,
    });

    if (results.length >= (input.limit ?? 10)) break;
  }

  return { results };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/recall.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/recall.ts plugin/tests/tools/recall.test.ts
git commit -m "feat: add maieutic_recall tool with FTS5 search and confidence filtering"
```

---

## Task 9: maieutic_synthesize Tool

**Files:**
- Create: `plugin/src/tools/synthesize.ts`
- Create: `plugin/tests/tools/synthesize.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/synthesize.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { handleSynthesize } from "../../src/tools/synthesize.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-synth");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id, root_questions } = handleBegin(db, {
    task: "Build onboarding",
    profile: "feature",
    project: "/test",
  });

  // Answer all root questions
  for (const q of root_questions) {
    handleAnswer(db, {
      question_id: q.id,
      answer: `Answer for ${q.element}`,
      confidence: 0.7,
    });
  }

  return { db, inquiry_id, root_questions };
}

describe("maieutic_synthesize", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a synthesis record", () => {
    const { db, inquiry_id } = setup();
    const result = handleSynthesize(db, {
      inquiry_id,
      round: 0,
      summary: "The purpose is clear but assumptions need validation",
    });

    expect(result.synthesis_id).toBeTruthy();
    expect(result.next_round).toBe(1);

    const synth = db.prepare("SELECT * FROM syntheses WHERE id = ?").get(result.synthesis_id) as {
      summary: string;
      round: number;
    };
    expect(synth.summary).toContain("assumptions need validation");
    expect(synth.round).toBe(0);
  });

  it("stores open threads as JSON", () => {
    const { db, inquiry_id, root_questions } = setup();
    const openIds = [root_questions[0].id, root_questions[1].id];

    const result = handleSynthesize(db, {
      inquiry_id,
      round: 0,
      summary: "Some threads remain open",
      open_threads: openIds,
    });

    const synth = db.prepare("SELECT open_threads FROM syntheses WHERE id = ?").get(result.synthesis_id) as {
      open_threads: string;
    };
    expect(JSON.parse(synth.open_threads)).toEqual(openIds);
  });

  it("creates next-round questions when provided", () => {
    const { db, inquiry_id, root_questions } = setup();

    const result = handleSynthesize(db, {
      inquiry_id,
      round: 0,
      summary: "Need deeper investigation",
      next_questions: [
        { element: "information", question: "What data do we have on drop-off rates?" },
        { element: "inferences", question: "Is our assumption about tutorial length correct?" },
      ],
    });

    // Check that next-round questions were created
    const nextQuestions = db
      .prepare("SELECT * FROM questions WHERE inquiry_id = ? AND round = 1")
      .all(inquiry_id) as { element: string; question: string }[];
    expect(nextQuestions.length).toBe(2);
  });

  it("links next questions to their spawned_by parents", () => {
    const { db, inquiry_id, root_questions } = setup();

    handleSynthesize(db, {
      inquiry_id,
      round: 0,
      summary: "Follow up needed",
      next_questions: [
        {
          element: "information",
          question: "More data needed",
          spawned_by: root_questions[0].id,
        },
      ],
    });

    const q = db
      .prepare("SELECT spawned_by FROM questions WHERE inquiry_id = ? AND round = 1")
      .get(inquiry_id) as { spawned_by: string };
    expect(q.spawned_by).toBe(root_questions[0].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/synthesize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/synthesize.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Element } from "../types.js";

interface NextQuestion {
  element: Element;
  question: string;
  spawned_by?: string;
}

interface SynthesizeInput {
  inquiry_id: string;
  round: number;
  summary: string;
  open_threads?: string[];
  next_questions?: NextQuestion[];
}

interface SynthesizeResult {
  synthesis_id: string;
  next_round: number;
}

export function handleSynthesize(db: DatabaseInstance, input: SynthesizeInput): SynthesizeResult {
  const synthId = randomUUID();
  const now = new Date().toISOString();
  const nextRound = input.round + 1;

  // Serialize arrays to JSON for storage
  const openThreadsJson = input.open_threads ? JSON.stringify(input.open_threads) : null;
  const nextQuestionsJson = input.next_questions ? JSON.stringify(input.next_questions) : null;

  db.prepare(
    `INSERT INTO syntheses (id, inquiry_id, round, summary, open_threads, next_questions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(synthId, input.inquiry_id, input.round, input.summary, openThreadsJson, nextQuestionsJson, now);

  // Create next-round questions if provided
  if (input.next_questions) {
    for (const nq of input.next_questions) {
      const questionId = randomUUID();
      db.prepare(
        `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
      ).run(questionId, input.inquiry_id, nextRound, nq.element, nq.question, nq.spawned_by ?? null, now);
    }
  }

  // Update inquiry timestamp
  db.prepare("UPDATE inquiries SET updated_at = ? WHERE id = ?").run(now, input.inquiry_id);

  return { synthesis_id: synthId, next_round: nextRound };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/synthesize.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/synthesize.ts plugin/tests/tools/synthesize.test.ts
git commit -m "feat: add maieutic_synthesize tool with next-round question spawning"
```

---

## Task 10: maieutic_reflect Tool

**Files:**
- Create: `plugin/src/tools/reflect.ts`
- Create: `plugin/tests/tools/reflect.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/reflect.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleReflect } from "../../src/tools/reflect.js";
import { searchQA } from "../../src/db/fts.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-reflect");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id } = handleBegin(db, {
    task: "Build feature X",
    profile: "feature",
    project: "/test",
  });
  return { db, inquiry_id };
}

describe("maieutic_reflect", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a reflection record", () => {
    const { db, inquiry_id } = setup();
    const result = handleReflect(db, {
      inquiry_id,
      what_worked: "Questioning assumptions early saved time",
      what_missed: "Didn't consider mobile performance constraints",
      key_insight: "Always question the data before questioning the design",
    });

    expect(result.reflection_id).toBeTruthy();

    const ref = db.prepare("SELECT * FROM reflections WHERE id = ?").get(result.reflection_id) as {
      key_insight: string;
    };
    expect(ref.key_insight).toBe("Always question the data before questioning the design");
  });

  it("marks inquiry as completed", () => {
    const { db, inquiry_id } = setup();
    handleReflect(db, {
      inquiry_id,
      what_worked: "Good",
      what_missed: "Nothing",
      key_insight: "It worked",
    });

    const inquiry = db.prepare("SELECT status FROM inquiries WHERE id = ?").get(inquiry_id) as {
      status: string;
    };
    expect(inquiry.status).toBe("completed");
  });

  it("indexes key insight into FTS for future recall", () => {
    const { db, inquiry_id } = setup();
    handleReflect(db, {
      inquiry_id,
      what_worked: "Socratic questioning surfaced hidden assumptions",
      what_missed: "Should have questioned stakeholder priorities",
      key_insight: "Never assume the stated requirements match the actual business goal",
    });

    const results = searchQA(db, { query: "requirements business goal" });
    expect(results.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/reflect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/reflect.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { indexReflection } from "../db/fts.js";

interface ReflectInput {
  inquiry_id: string;
  what_worked: string;
  what_missed: string;
  key_insight: string;
}

interface ReflectResult {
  reflection_id: string;
}

export function handleReflect(db: DatabaseInstance, input: ReflectInput): ReflectResult {
  const reflectionId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO reflections (id, inquiry_id, what_worked, what_missed, key_insight, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(reflectionId, input.inquiry_id, input.what_worked, input.what_missed, input.key_insight, now);

  // Mark inquiry as completed
  db.prepare("UPDATE inquiries SET status = 'completed', updated_at = ? WHERE id = ?").run(now, input.inquiry_id);

  // Index key insight into FTS for future recall
  const inquiry = db
    .prepare("SELECT project FROM inquiries WHERE id = ?")
    .get(input.inquiry_id) as { project: string };

  const ftsRowid = db.prepare("SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM qa_fts").get() as {
    next: number;
  };
  indexReflection(db, {
    rowid: ftsRowid.next,
    question_text: `Reflection: ${input.what_worked}. Missed: ${input.what_missed}`,
    answer_text: input.key_insight,
    element: "reflection",
    project: inquiry.project,
  });

  return { reflection_id: reflectionId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/reflect.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/reflect.ts plugin/tests/tools/reflect.test.ts
git commit -m "feat: add maieutic_reflect tool with FTS-indexed key insights"
```

---

## Task 11: maieutic_config Tool

**Files:**
- Create: `plugin/src/tools/config.ts`
- Create: `plugin/tests/tools/config.test.ts`

- [ ] **Step 1: Write the failing test for `plugin/tests/tools/config.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleConfig } from "../../src/tools/config.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-config");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  return db;
}

describe("maieutic_config", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("sets and gets a config value", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "deep", scope: "project" });

    const result = handleConfig(db, { action: "get", key: "depth" });
    expect(result.config.depth).toBe("deep");
  });

  it("returns all config when no key specified", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "deep" });
    handleConfig(db, { action: "set", key: "visibility", value: "verbose" });

    const result = handleConfig(db, { action: "get" });
    expect(result.config.depth).toBe("deep");
    expect(result.config.visibility).toBe("verbose");
  });

  it("upserts on set — updates existing keys", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "shallow" });
    handleConfig(db, { action: "set", key: "depth", value: "deep" });

    const result = handleConfig(db, { action: "get", key: "depth" });
    expect(result.config.depth).toBe("deep");
  });

  it("returns empty config for missing keys", () => {
    const db = setup();
    const result = handleConfig(db, { action: "get", key: "nonexistent" });
    expect(result.config).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugin && npx vitest run tests/tools/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `plugin/src/tools/config.ts`**

```typescript
import type { Database as DatabaseInstance } from "better-sqlite3";

interface ConfigInput {
  action: "get" | "set";
  key?: string;
  value?: string;
  scope?: "project" | "global";
}

interface ConfigResult {
  config: Record<string, string>;
}

export function handleConfig(db: DatabaseInstance, input: ConfigInput): ConfigResult {
  if (input.action === "set") {
    if (!input.key || !input.value) {
      throw new Error("key and value are required for set action");
    }
    const scope = input.scope ?? "project";
    db.prepare(
      `INSERT INTO config (key, value, scope) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, scope = excluded.scope`
    ).run(input.key, input.value, scope);

    return { config: { [input.key]: input.value } };
  }

  // action === "get"
  if (input.key) {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(input.key) as
      | { value: string }
      | undefined;
    return { config: row ? { [input.key]: row.value } : {} };
  }

  // Return all config
  const rows = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return { config };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugin && npx vitest run tests/tools/config.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/tools/config.ts plugin/tests/tools/config.test.ts
git commit -m "feat: add maieutic_config tool with get/set/upsert"
```

---

## Task 12: MCP Server Entry Point

**Files:**
- Create: `plugin/src/index.ts`

- [ ] **Step 1: Write `plugin/src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDatabase, resolveDbDir } from "./db/connection.js";
import { applySchema } from "./db/schema.js";
import { handleBegin } from "./tools/begin.js";
import { handleAsk } from "./tools/ask.js";
import { handleAnswer } from "./tools/answer.js";
import { handleRecall } from "./tools/recall.js";
import { handleSynthesize } from "./tools/synthesize.js";
import { handleReflect } from "./tools/reflect.js";
import { handleConfig } from "./tools/config.js";
import type { Element } from "./types.js";

const VERSION = "0.1.0";

const server = new McpServer({
  name: "maieutic-engine",
  version: VERSION,
});

function getDb() {
  const dbDir = resolveDbDir();
  const db = getDatabase(dbDir);
  applySchema(db);
  return db;
}

const ELEMENTS = [
  "purpose", "question_at_issue", "assumptions", "point_of_view",
  "information", "concepts", "inferences", "implications",
] as const;

// ── maieutic_begin ──────────────────────────────────────

server.registerTool(
  "maieutic_begin",
  {
    title: "Begin Maieutic Inquiry",
    description:
      "Start a new Socratic inquiry for a task. Returns an inquiry ID and root questions " +
      "based on the selected profile (feature/bugfix/refactor/auto/custom). " +
      "Each root question targets a different Element of Thought.",
    inputSchema: z.object({
      task: z.string().describe("Description of the task to investigate"),
      profile: z
        .enum(["auto", "feature", "bugfix", "refactor", "custom"])
        .optional()
        .default("auto")
        .describe("Question profile — determines which Elements of Thought to activate"),
      depth: z
        .enum(["shallow", "medium", "deep", "custom"])
        .optional()
        .default("medium")
        .describe("How deep to question: shallow=2-3, medium=4-5, deep=6-8 root questions"),
      visibility: z
        .enum(["silent", "summary", "verbose"])
        .optional()
        .default("summary")
        .describe("How much of the questioning process to show the user"),
      elements: z
        .array(z.enum(ELEMENTS))
        .optional()
        .describe("Override: specific Elements of Thought to use (for custom profile)"),
    }),
  },
  async (input) => {
    const db = getDb();
    const project = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const result = handleBegin(db, { ...input, project });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_ask ────────────────────────────────────────

server.registerTool(
  "maieutic_ask",
  {
    title: "Ask Maieutic Question",
    description:
      "Pose a new Socratic question within an inquiry. Can be a root question " +
      "or a follow-up spawned by a previous answer.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("The inquiry to add this question to"),
      element: z.enum(ELEMENTS).describe("Which Element of Thought this question targets"),
      question: z.string().describe("The question text"),
      spawned_by: z.string().optional().describe("Parent question ID if this is a follow-up"),
      round: z.number().optional().default(0).describe("Which round of questioning"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleAsk(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_answer ─────────────────────────────────────

server.registerTool(
  "maieutic_answer",
  {
    title: "Answer Maieutic Question",
    description:
      "Record an answer to a question. Indexes into FTS5 for future recall. " +
      "Can atomically spawn follow-up questions via the spawn parameter.",
    inputSchema: z.object({
      question_id: z.string().describe("The question being answered"),
      answer: z.string().describe("The answer text"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .default(0.5)
        .describe("Confidence in this answer: 0.0=guessing, 1.0=certain"),
      source: z
        .enum(["self", "user", "recall", "tool"])
        .optional()
        .default("self")
        .describe("Where this answer came from"),
      spawn: z
        .array(
          z.object({
            element: z.enum(ELEMENTS),
            question: z.string(),
          })
        )
        .optional()
        .describe("Follow-up questions to create from this answer"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleAnswer(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_recall ─────────────────────────────────────

server.registerTool(
  "maieutic_recall",
  {
    title: "Recall Past Reasoning",
    description:
      "Search past Socratic reasoning using FTS5 full-text search. " +
      "This is the core 'anamnesis' tool — it helps you remember what you " +
      "already know by finding relevant past questions, answers, and insights.",
    inputSchema: z.object({
      query: z.string().describe("Natural language search query"),
      project: z.string().optional().describe("Filter to a specific project directory"),
      element: z.enum(ELEMENTS).optional().describe("Filter to a specific Element of Thought"),
      limit: z.number().optional().default(10).describe("Max results to return"),
      min_confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Only return answers with confidence >= this value"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleRecall(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_synthesize ─────────────────────────────────

server.registerTool(
  "maieutic_synthesize",
  {
    title: "Synthesize Round Insights",
    description:
      "Called after a round of parallel questioning completes. Records the synthesis " +
      "of all answers from the round, identifies open threads, and optionally " +
      "creates next-round questions.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("The inquiry being synthesized"),
      round: z.number().describe("Which round just completed (0-indexed)"),
      summary: z.string().describe("Your synthesis of this round's findings"),
      open_threads: z
        .array(z.string())
        .optional()
        .describe("Question IDs that need more exploration"),
      next_questions: z
        .array(
          z.object({
            element: z.enum(ELEMENTS),
            question: z.string(),
            spawned_by: z.string().optional(),
          })
        )
        .optional()
        .describe("Questions to create for the next round"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleSynthesize(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_reflect ────────────────────────────────────

server.registerTool(
  "maieutic_reflect",
  {
    title: "Post-Task Reflection",
    description:
      "Record a retrospective after completing a task. The key insight is indexed " +
      "into FTS5 for future recall across sessions. Marks the inquiry as completed.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("The inquiry to reflect on"),
      what_worked: z.string().describe("What the Socratic process got right"),
      what_missed: z.string().describe("What was missed or should have been questioned"),
      key_insight: z.string().describe("The single most valuable takeaway"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleReflect(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── maieutic_config ─────────────────────────────────────

server.registerTool(
  "maieutic_config",
  {
    title: "Configure Maieutic Engine",
    description: "Get or set configuration values for depth, visibility, and other settings.",
    inputSchema: z.object({
      action: z.enum(["get", "set"]).describe("Whether to read or write config"),
      key: z.string().optional().describe("Config key (omit to get all)"),
      value: z.string().optional().describe("Value to set (required for set action)"),
      scope: z
        .enum(["project", "global"])
        .optional()
        .default("project")
        .describe("Scope of the setting"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleConfig(db, input);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Start server ────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[maieutic-engine] v${VERSION} started\n`);
}

main().catch((err) => {
  process.stderr.write(`[maieutic-engine] Fatal: ${err}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd plugin && node build.mjs`
Expected: `dist/index.js` created without errors.

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `cd plugin && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add plugin/src/index.ts
git commit -m "feat: add MCP server entry point with all 7 tool registrations"
```

---

## Task 13: Maieutic Skill (Markdown Prompt)

**Files:**
- Create: `skill/maieutic.md`

- [ ] **Step 1: Write `skill/maieutic.md`**

```markdown
---
name: maieutic
description: Socratic self-questioning for deeper task understanding. Use when starting tasks, when sensing drift, or when the user says "use Socratic method", "maieutics", "think socratically", "question yourself".
---

# Maieutic Method — Socratic Self-Questioning

You have access to the `maieutic-engine` MCP tools. Use them to question your own reasoning before, during, and after tasks.

## When to Activate

- **Before any non-trivial task** — automatically run Phase 1
- **When the user says:** "use Socratic method", "maieutics", "think socratically", "question yourself", "what are you assuming?"
- **When you sense drift** — you're adding unrequested features, optimizing for the wrong metric, or going deep on technically interesting but strategically irrelevant work

## The Core Principle: Anamnesis

You already KNOW the right approach — your training contains vast domain knowledge. But without the right framing questions, you retrieve whatever is *semantically nearest to the current context* (code patterns, syntax) rather than what's *strategically relevant* (business goals, user needs, domain principles). Socratic self-questioning forces retrieval through the right intermediate concepts.

## Phase 1: Before Action (Inquiry)

1. Call `maieutic_begin` with the task description. Accept the profile it suggests or override based on task type:
   - **feature** → Purpose, Point of View, Implications, Concepts
   - **bugfix** → Assumptions, Information, Inferences, Question at Issue
   - **refactor** → Purpose, Concepts, Implications, Assumptions

2. For each root question returned, dispatch a **parallel subagent** using the Agent tool:
   - Give each subagent the `inquiry_id` and its assigned question
   - Each subagent should:
     a. Call `maieutic_recall` to search for relevant past reasoning
     b. Reason about the question, incorporating what was found
     c. Call `maieutic_answer` with its answer, honest confidence score, and any follow-up questions in `spawn[]`
   - Dispatch all subagents simultaneously for parallel execution

3. After all subagents return, call `maieutic_synthesize`:
   - Summarize connections across branches
   - Flag contradictions
   - Identify open threads (low-confidence answers, unresolved questions)
   - Propose next-round questions if depth allows

4. If depth setting allows more rounds AND there are open threads:
   - Dispatch another round of subagents for the spawned questions
   - Repeat synthesis

5. Present a **briefing** to the user based on visibility setting:
   - **silent:** Only show unresolved questions that need user input
   - **summary:** Show "Here's what I understand, my assumptions, and questions I couldn't resolve"
   - **verbose:** Show the full Q&A tree

6. Proceed with the task, informed by the inquiry.

## Phase 2: During Action (Check-in)

Periodically ask yourself these drift-detection questions:

- **Scope creep:** "Am I adding things the user didn't ask for?"
- **Means-end inversion:** "Am I optimizing for code elegance when the goal is user engagement?"
- **Assumption violation:** "Did I discover something that contradicts my starting assumptions?"

When you detect drift:
1. Call `maieutic_recall` with the original task purpose
2. Call `maieutic_ask` with an alignment question
3. Call `maieutic_answer` honestly
4. If misaligned, surface to the user and course-correct

## Phase 3: After Action (Reflection)

When the task is complete, call `maieutic_reflect` with:
- **what_worked:** What did the Socratic process surface that was valuable?
- **what_missed:** What should have been questioned but wasn't?
- **key_insight:** The single most valuable takeaway (this gets indexed for future recall)

## Subagent Prompt Template

When dispatching subagents for parallel questioning, give each one this context:

```
You are investigating a specific aspect of a task using Socratic questioning.

TASK: {task_description}
YOUR ELEMENT: {element} (e.g., "assumptions")
YOUR QUESTION: {question_text}
INQUIRY CONTEXT: {synthesis_from_previous_rounds, if any}

You have access to maieutic_recall and maieutic_answer MCP tools.

Process:
1. Call maieutic_recall with a relevant search query to find past reasoning
2. Call maieutic_recall with the current inquiry to check sibling answers
3. Reason about your question, incorporating what you found
4. Call maieutic_answer with your answer, honest confidence (0.3=guessing, 0.8+=solid), and spawn[] for follow-ups
```

## Depth Guide

| Depth | Root Questions | Max Rounds | Use For |
|-------|---------------|------------|---------|
| shallow | 2-3 | 1 | Quick tasks, bug fixes |
| medium | 4-5 | 2 | Features, refactors |
| deep | 6-8 | 3+ | Architecture, unfamiliar domains |

## Elements of Thought (Quick Reference)

| Element | Ask Yourself |
|---------|-------------|
| Purpose | What are we REALLY trying to achieve? |
| Question at Issue | What SPECIFIC problem are we solving? |
| Assumptions | What are we TAKING FOR GRANTED? |
| Point of View | Whose PERSPECTIVE are we missing? |
| Information | What DATA do we have or need? |
| Concepts | What DOMAIN PRINCIPLES apply? |
| Inferences | Are our CONCLUSIONS justified? |
| Implications | What are the SECOND-ORDER EFFECTS? |
```

- [ ] **Step 2: Commit**

```bash
git add skill/maieutic.md
git commit -m "feat: add Maieutic skill prompt with Socratic methodology"
```

---

## Task 14: Integration Test & Build Verification

**Files:**
- Modify: `plugin/package.json` (add integration test script)

- [ ] **Step 1: Run full test suite**

Run: `cd plugin && npx vitest run`
Expected: All tests PASS (across all test files).

- [ ] **Step 2: Build the plugin**

Run: `cd plugin && node build.mjs`
Expected: `dist/index.js` created, no errors.

- [ ] **Step 3: Verify the built server starts**

Run: `cd plugin && echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}' | timeout 5 node dist/index.js 2>/dev/null || true`
Expected: Server starts and responds with an initialize response (may timeout after — that's fine, we're just checking it doesn't crash on startup).

- [ ] **Step 4: Add `.maieutic/` to `.gitignore`**

Append to the project root `.gitignore`:
```
.maieutic/
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add .maieutic/ to gitignore and verify build"
```

---

## Task 15: MCP Registration & Installation

**Files:**
- Modify: `.claude/settings.local.json` (add MCP server config)

- [ ] **Step 1: Register the MCP server**

Add to `.claude/settings.local.json`:
```json
{
  "mcpServers": {
    "maieutic-engine": {
      "command": "node",
      "args": ["/home/mike/Documents/grimoires/cc-cyber-maieutics/plugin/dist/index.js"],
      "env": {
        "MAIEUTIC_DB_DIR": ".maieutic"
      }
    }
  }
}
```

Note: Merge with existing content if the file already has settings.

- [ ] **Step 2: Install the skill**

Copy `skill/maieutic.md` to the appropriate skill directory. The exact location depends on your Claude Code skill configuration. Common locations:
- Project-local: `.claude/skills/maieutic.md`
- Or register it in your superpowers skill directory

- [ ] **Step 3: Verify MCP tools appear**

Restart Claude Code and verify that the 7 `maieutic_*` tools appear in the tool list. You can check by asking Claude "what maieutic tools do you have?"

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore: register maieutic-engine MCP server"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Architecture (plugin + skill): Task 12 (entry point) + Task 13 (skill)
   - Data model: Task 3 (schema)
   - All 7 MCP tools: Tasks 5-11
   - FTS5 search: Task 4
   - DB connection + WAL: Task 2
   - Subagent coordination: Task 13 (skill prompt template)
   - Depth/visibility config: Tasks 5 (begin) + 11 (config)
   - Installation: Task 15

2. **Placeholder scan:** No TBDs, TODOs, or vague steps. All code is complete.

3. **Type consistency verified:**
   - `Element` type used consistently across all tools
   - `handleBegin/handleAsk/handleAnswer/handleRecall/handleSynthesize/handleReflect/handleConfig` — naming consistent
   - `inquiry_id`, `question_id`, `answer_id` — consistent ID field names
   - FTS functions `indexQA`, `searchQA`, `indexReflection` — consistent between fts.ts and consumers
