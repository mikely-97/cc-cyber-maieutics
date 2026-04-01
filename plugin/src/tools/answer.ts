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

  const question = db
    .prepare("SELECT inquiry_id, element, question, round FROM questions WHERE id = ?")
    .get(input.question_id) as { inquiry_id: string; element: string; question: string; round: number } | undefined;
  if (!question) throw new Error(`Question not found: ${input.question_id}`);

  const inquiry = db
    .prepare("SELECT project FROM inquiries WHERE id = ?")
    .get(question.inquiry_id) as { project: string };

  db.prepare(
    "INSERT INTO answers (id, question_id, answer, confidence, source, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(answerId, input.question_id, input.answer, confidence, source, now);

  db.prepare("UPDATE questions SET status = 'answered' WHERE id = ?").run(input.question_id);

  // Generate next rowid using qa_fts (always exists after applySchema).
  // qa_search_store is created lazily inside indexQA, so we cannot query it here first.
  const ftsRowid = db
    .prepare("SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM qa_fts")
    .get() as { next: number };

  indexQA(db, {
    rowid: ftsRowid.next,
    question_text: question.question,
    answer_text: input.answer,
    element: question.element,
    project: inquiry.project,
  });

  let spawnedIds: string[] | undefined;
  if (input.spawn && input.spawn.length > 0) {
    spawnedIds = input.spawn.map((s) => {
      const spawnId = randomUUID();
      db.prepare(
        "INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)"
      ).run(spawnId, question.inquiry_id, question.round + 1, s.element, s.question, input.question_id, now);
      return spawnId;
    });
  }

  return { answer_id: answerId, spawned_question_ids: spawnedIds };
}
