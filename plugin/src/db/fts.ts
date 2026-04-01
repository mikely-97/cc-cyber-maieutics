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

function ensureDataTable(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS qa_search_store (
      rowid       INTEGER PRIMARY KEY,
      question_text TEXT NOT NULL,
      answer_text   TEXT NOT NULL,
      element       TEXT NOT NULL,
      project       TEXT NOT NULL
    )
  `);
}

export function indexQA(db: DatabaseInstance, entry: FTSEntry): void {
  ensureDataTable(db);
  db.prepare(
    `INSERT OR REPLACE INTO qa_search_store(rowid, question_text, answer_text, element, project)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entry.rowid, entry.question_text, entry.answer_text, entry.element, entry.project);
  db.prepare(
    `INSERT INTO qa_fts(rowid, question_text, answer_text, element, project)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entry.rowid, entry.question_text, entry.answer_text, entry.element, entry.project);
}

export function deleteQA(db: DatabaseInstance, rowid: number): void {
  db.prepare(`DELETE FROM qa_fts WHERE rowid = ?`).run(rowid);
  db.prepare(`DELETE FROM qa_search_store WHERE rowid = ?`).run(rowid);
}

export function indexReflection(db: DatabaseInstance, entry: FTSEntry): void {
  indexQA(db, entry);
}

export function searchQA(db: DatabaseInstance, options: FTSSearchOptions): FTSResult[] {
  ensureDataTable(db);
  const sanitized = sanitizeQuery(options.query);
  const limit = options.limit ?? 10;

  // FTS5 with content='' is contentless: column values are not stored.
  // We join matched rowids against qa_search_store for actual field values and filtering.
  let sql = `
    SELECT d.rowid, d.question_text, d.answer_text, d.element, d.project,
           bm25(qa_fts, 2.0, 1.0, 0.5, 0.5) AS rank
    FROM qa_fts
    JOIN qa_search_store d ON qa_fts.rowid = d.rowid
    WHERE qa_fts MATCH ?
  `;
  const params: (string | number)[] = [sanitized];

  if (options.element) {
    sql += ` AND d.element = ?`;
    params.push(options.element);
  }

  if (options.project) {
    sql += ` AND d.project = ?`;
    params.push(options.project);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as FTSResult[];
}
