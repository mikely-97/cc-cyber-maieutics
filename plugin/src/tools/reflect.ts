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

  db.prepare("UPDATE inquiries SET status = 'completed', updated_at = ? WHERE id = ?").run(now, input.inquiry_id);

  const inquiry = db.prepare("SELECT project FROM inquiries WHERE id = ?").get(input.inquiry_id) as { project: string };

  // Get next FTS rowid — use qa_fts table
  const ftsRowid = db.prepare("SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM qa_fts").get() as { next: number };
  indexReflection(db, {
    rowid: ftsRowid.next,
    question_text: `Reflection: ${input.what_worked}. Missed: ${input.what_missed}`,
    answer_text: input.key_insight,
    element: "reflection",
    project: inquiry.project,
  });

  return { reflection_id: reflectionId };
}
