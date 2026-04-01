import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-begin");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  return db;
}

describe("maieutic_begin", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates an inquiry and returns root questions for feature profile", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Add user onboarding flow", profile: "feature", project: "/test/project" });
    expect(result.inquiry_id).toBeDefined();
    expect(result.root_questions.length).toBe(4);
    expect(result.root_questions[0].element).toBe("purpose");
    expect(result.root_questions[0].question).toBeTruthy();
    expect(result.root_questions[0].id).toBeTruthy();
  });

  it("creates an inquiry with bugfix profile", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Fix crash on login", profile: "bugfix", project: "/test/project" });
    expect(result.root_questions.length).toBe(4);
    const elements = result.root_questions.map((q) => q.element);
    expect(elements).toContain("assumptions");
    expect(elements).toContain("information");
  });

  it("stores the inquiry in the database", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Refactor auth module", profile: "refactor", project: "/test/project" });
    const inquiry = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(result.inquiry_id) as { task: string; profile: string };
    expect(inquiry.task).toBe("Refactor auth module");
    expect(inquiry.profile).toBe("refactor");
  });

  it("stores root questions in the database with round=0", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Add feature", profile: "feature", project: "/test/project" });
    const questions = db.prepare("SELECT * FROM questions WHERE inquiry_id = ?").all(result.inquiry_id) as { round: number; spawned_by: string | null }[];
    expect(questions.length).toBe(result.root_questions.length);
    for (const q of questions) {
      expect(q.round).toBe(0);
      expect(q.spawned_by).toBeNull();
    }
  });

  it("respects custom elements override", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Anything", profile: "custom", elements: ["purpose", "implications"], project: "/test/project" });
    expect(result.root_questions.length).toBe(2);
    const elements = result.root_questions.map((q) => q.element);
    expect(elements).toContain("purpose");
    expect(elements).toContain("implications");
  });

  it("respects depth setting for shallow", () => {
    const db = setup();
    const result = handleBegin(db, { task: "Quick fix", profile: "feature", depth: "shallow", project: "/test/project" });
    expect(result.root_questions.length).toBeLessThanOrEqual(3);
  });
});
