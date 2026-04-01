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
