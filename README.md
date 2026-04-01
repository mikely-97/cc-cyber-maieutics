# Maieutic Engine

A Claude Code MCP server and skill that adds Socratic self-questioning to your AI workflow. Before acting, Claude questions its own assumptions, surfaces hidden biases, and retrieves strategically relevant knowledge — not just the semantically nearest code pattern.

Based on the Elements of Thought from Richard Paul and Linda Elder's critical thinking framework.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 20+

## Installation

### 1. Clone and build the MCP server

```bash
git clone https://github.com/your-org/cc-cyber-maieutics.git
cd cc-cyber-maieutics/plugin
npm install
node build.mjs
```

### 2. Register the MCP server

Add to your project's `.mcp.json` (project-scoped) or `~/.claude/mcpjson` (global):

```json
{
  "mcpServers": {
    "maieutic-engine": {
      "command": "node",
      "args": ["/absolute/path/to/cc-cyber-maieutics/plugin/dist/index.js"],
      "env": {
        "MAIEUTIC_DB_DIR": ".maieutic"
      }
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned the repo.

`MAIEUTIC_DB_DIR` controls where the SQLite reasoning database is stored. It defaults to `.maieutic/` in the current working directory. Add it to your `.gitignore`:

```
.maieutic/
```

### 3. Install the skill

Copy the skill file into Claude Code's global skills directory:

```bash
mkdir -p ~/.claude/skills/maieutic
cp skill/maieutic.md ~/.claude/skills/maieutic/SKILL.md
```

> **Note:** The file must be named `SKILL.md` inside a named directory — this is the convention Claude Code's skill discovery expects. Placing a bare `.md` file in `~/.claude/skills/` will not work.

### 4. Restart Claude Code

The maieutic skill and all 7 MCP tools (`maieutic_begin`, `maieutic_ask`, `maieutic_answer`, `maieutic_recall`, `maieutic_synthesize`, `maieutic_reflect`, `maieutic_config`) will be available after restart.

## Usage

Invoke the skill explicitly:

```
/maieutic
```

Or use natural language triggers:

- "use Socratic method"
- "question yourself"
- "what are you assuming?"
- "think socratically"

The skill runs in three phases:

1. **Inquiry** — before action, generates root questions from the Elements of Thought, dispatches parallel subagents to investigate each, then synthesizes findings
2. **Check-in** — during action, detects scope creep, means-end inversion, and assumption violations
3. **Reflection** — after action, captures what worked, what was missed, and indexes key insights for future recall

## MCP Tools

| Tool | Purpose |
|------|---------|
| `maieutic_begin` | Start an inquiry with a task description; returns root questions |
| `maieutic_ask` | Pose a follow-up question within an inquiry |
| `maieutic_answer` | Record an answer with confidence score and optional spawn questions |
| `maieutic_recall` | Search past reasoning by semantic query |
| `maieutic_synthesize` | Summarize connections, contradictions, and open threads |
| `maieutic_reflect` | Post-task reflection; indexes key insight for future recall |
| `maieutic_config` | Adjust depth, visibility, and element profiles |

## License

MIT
