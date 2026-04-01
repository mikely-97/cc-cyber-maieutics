import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getDatabase, closeDatabase, resolveDbDir } from "./db/connection.js";
import { applySchema } from "./db/schema.js";
import { handleBegin } from "./tools/begin.js";
import { handleAsk } from "./tools/ask.js";
import { handleAnswer } from "./tools/answer.js";
import { handleRecall } from "./tools/recall.js";
import { handleSynthesize } from "./tools/synthesize.js";
import { handleReflect } from "./tools/reflect.js";
import { handleConfig } from "./tools/config.js";

import type { Database as DatabaseInstance } from "better-sqlite3";

function getDb(): DatabaseInstance {
  const dir = resolveDbDir();
  const db = getDatabase(dir);
  applySchema(db);
  return db;
}

const ELEMENTS = [
  "purpose",
  "question_at_issue",
  "assumptions",
  "point_of_view",
  "information",
  "concepts",
  "inferences",
  "implications",
] as const;

const elementEnum = z.enum(ELEMENTS);

const server = new McpServer({ name: "maieutic-engine", version: "0.1.0" });

// ── maieutic_begin ────────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_begin",
  {
    title: "Begin Maieutic Inquiry",
    description:
      "Start a new maieutic (Socratic) inquiry for a task. Generates root questions across the selected elements of thought.",
    inputSchema: z.object({
      task: z.string().describe("The task or topic to analyse"),
      project: z.string().describe("Project identifier for grouping inquiries"),
      profile: z
        .enum(["auto", "feature", "bugfix", "refactor", "custom"])
        .optional()
        .describe("Question profile to use"),
      depth: z
        .enum(["shallow", "medium", "deep", "custom"])
        .optional()
        .describe("Depth of inquiry"),
      visibility: z
        .enum(["silent", "summary", "verbose"])
        .optional()
        .describe("Visibility level for results"),
      elements: z
        .array(elementEnum)
        .optional()
        .describe("Explicit elements to include (overrides profile)"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleBegin(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_ask ──────────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_ask",
  {
    title: "Ask a Maieutic Question",
    description: "Record a new question within an active inquiry.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("ID of the inquiry to attach the question to"),
      element: elementEnum.describe("Element of thought this question addresses"),
      question: z.string().describe("The question text"),
      spawned_by: z.string().optional().describe("ID of the parent question that spawned this one"),
      round: z.number().optional().describe("Round number (defaults to 0)"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleAsk(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_answer ───────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_answer",
  {
    title: "Answer a Maieutic Question",
    description: "Record an answer to a question and optionally spawn follow-up questions.",
    inputSchema: z.object({
      question_id: z.string().describe("ID of the question being answered"),
      answer: z.string().describe("The answer text"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Confidence score between 0 and 1"),
      source: z
        .enum(["self", "user", "recall", "tool"])
        .optional()
        .describe("Source of the answer"),
      spawn: z
        .array(
          z.object({
            element: elementEnum,
            question: z.string(),
          })
        )
        .optional()
        .describe("Follow-up questions to spawn from this answer"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleAnswer(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_recall ───────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_recall",
  {
    title: "Recall Past Insights",
    description: "Full-text search across past Q&A pairs stored in the knowledge base.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      project: z.string().optional().describe("Limit results to a specific project"),
      element: elementEnum.optional().describe("Filter by element of thought"),
      limit: z.number().optional().describe("Maximum number of results to return"),
      min_confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum confidence threshold"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleRecall(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_synthesize ───────────────────────────────────────────────────────
server.registerTool(
  "maieutic_synthesize",
  {
    title: "Synthesize a Round",
    description:
      "Record a synthesis summary for the current round and optionally queue next-round questions.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("ID of the inquiry"),
      round: z.number().describe("Round number being synthesised"),
      summary: z.string().describe("Synthesis summary text"),
      open_threads: z
        .array(z.string())
        .optional()
        .describe("Open threads / unresolved questions to carry forward"),
      next_questions: z
        .array(
          z.object({
            element: elementEnum,
            question: z.string(),
            spawned_by: z.string().optional(),
          })
        )
        .optional()
        .describe("New questions to open in the next round"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleSynthesize(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_reflect ──────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_reflect",
  {
    title: "Reflect on an Inquiry",
    description:
      "Record a retrospective reflection on a completed inquiry and mark it as done.",
    inputSchema: z.object({
      inquiry_id: z.string().describe("ID of the inquiry to reflect on"),
      what_worked: z.string().describe("What worked well in this inquiry"),
      what_missed: z.string().describe("What was missed or could be improved"),
      key_insight: z.string().describe("The single most important insight gained"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleReflect(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── maieutic_config ───────────────────────────────────────────────────────────
server.registerTool(
  "maieutic_config",
  {
    title: "Get or Set Configuration",
    description: "Read or write configuration values for the maieutic engine.",
    inputSchema: z.object({
      action: z.enum(["get", "set"]).describe("Whether to get or set a config value"),
      key: z.string().optional().describe("Config key to get or set"),
      value: z.string().optional().describe("Value to set (required for action=set)"),
      scope: z
        .enum(["project", "global"])
        .optional()
        .describe("Scope for the config entry"),
    }),
  },
  async (input) => {
    const db = getDb();
    const result = handleConfig(db, input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
