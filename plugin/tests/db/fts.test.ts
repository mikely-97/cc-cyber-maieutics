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
    indexQA(db, { rowid: 1, question_text: "What is the purpose?", answer_text: "Revenue growth", element: "purpose", project: "/test/project" });
    indexQA(db, { rowid: 2, question_text: "What assumptions exist?", answer_text: "Revenue comes from ads", element: "assumptions", project: "/test/project" });
    const results = searchQA(db, { query: "revenue", element: "purpose" });
    expect(results.length).toBe(1);
    expect(results[0].element).toBe("purpose");
  });

  it("filters by project", () => {
    const db = setup();
    indexQA(db, { rowid: 1, question_text: "Purpose of game A?", answer_text: "Engagement", element: "purpose", project: "/project-a" });
    indexQA(db, { rowid: 2, question_text: "Purpose of game B?", answer_text: "Engagement", element: "purpose", project: "/project-b" });
    const results = searchQA(db, { query: "engagement", project: "/project-a" });
    expect(results.length).toBe(1);
    expect(results[0].project).toBe("/project-a");
  });

  it("respects limit parameter", () => {
    const db = setup();
    for (let i = 0; i < 20; i++) {
      indexQA(db, { rowid: i + 1, question_text: `Question about engagement strategy ${i}`, answer_text: `Answer about engagement ${i}`, element: "purpose", project: "/test" });
    }
    const results = searchQA(db, { query: "engagement", limit: 5 });
    expect(results.length).toBe(5);
  });

  it("indexes reflection key insights", () => {
    const db = setup();
    indexReflection(db, { rowid: 100, question_text: "Key insight from bear den dungeon task", answer_text: "Always question the data before questioning the design", element: "reflection", project: "/test" });
    const results = searchQA(db, { query: "question data design" });
    expect(results.length).toBe(1);
  });
});
