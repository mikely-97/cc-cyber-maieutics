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
  const ftsResults = searchQA(db, {
    query: input.query,
    project: input.project,
    element: input.element,
    limit: (input.limit ?? 10) * 2,
  });

  if (ftsResults.length === 0) return { results: [] };

  const results: RecallResultItem[] = [];
  for (const fts of ftsResults) {
    const row = db.prepare(`
      SELECT a.confidence, a.created_at, q.inquiry_id, q.element, q.question, a.answer
      FROM answers a
      JOIN questions q ON q.id = a.question_id
      JOIN inquiries i ON i.id = q.inquiry_id
      WHERE q.question = ? AND a.answer = ?
      LIMIT 1
    `).get(fts.question_text, fts.answer_text) as {
      confidence: number; created_at: string; inquiry_id: string;
      element: string; question: string; answer: string;
    } | undefined;

    if (!row) continue;
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
