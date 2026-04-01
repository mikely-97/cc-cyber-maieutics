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
  ).run(questionId, input.inquiry_id, input.round ?? 0, input.element, input.question, input.spawned_by ?? null, now);
  return { question_id: questionId };
}
