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
  const openThreadsJson = input.open_threads ? JSON.stringify(input.open_threads) : null;
  const nextQuestionsJson = input.next_questions ? JSON.stringify(input.next_questions) : null;

  db.prepare(
    `INSERT INTO syntheses (id, inquiry_id, round, summary, open_threads, next_questions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(synthId, input.inquiry_id, input.round, input.summary, openThreadsJson, nextQuestionsJson, now);

  if (input.next_questions) {
    for (const nq of input.next_questions) {
      const questionId = randomUUID();
      db.prepare(
        `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
      ).run(questionId, input.inquiry_id, nextRound, nq.element, nq.question, nq.spawned_by ?? null, now);
    }
  }

  db.prepare("UPDATE inquiries SET updated_at = ? WHERE id = ?").run(now, input.inquiry_id);
  return { synthesis_id: synthId, next_round: nextRound };
}
