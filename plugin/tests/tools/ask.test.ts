import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAsk } from "../../src/tools/ask.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-ask");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id } = handleBegin(db, { task: "Test task", profile: "feature", project: "/test" });
  return { db, inquiry_id };
}

describe("maieutic_ask", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a new question in the database", () => {
    const { db, inquiry_id } = setup();
    const result = handleAsk(db, { inquiry_id, element: "assumptions", question: "Are we assuming users have fast internet?", round: 1 });
    expect(result.question_id).toBeTruthy();
    const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(result.question_id) as { element: string; round: number };
    expect(row.element).toBe("assumptions");
    expect(row.round).toBe(1);
  });

  it("links to parent question via spawned_by", () => {
    const { db, inquiry_id } = setup();
    const parentQuestions = db.prepare("SELECT id FROM questions WHERE inquiry_id = ? LIMIT 1").get(inquiry_id) as { id: string };
    const result = handleAsk(db, { inquiry_id, element: "inferences", question: "Follow-up question", spawned_by: parentQuestions.id, round: 1 });
    const row = db.prepare("SELECT spawned_by FROM questions WHERE id = ?").get(result.question_id) as { spawned_by: string };
    expect(row.spawned_by).toBe(parentQuestions.id);
  });

  it("defaults round to 0 when not specified", () => {
    const { db, inquiry_id } = setup();
    const result = handleAsk(db, { inquiry_id, element: "purpose", question: "Why?" });
    const row = db.prepare("SELECT round FROM questions WHERE id = ?").get(result.question_id) as { round: number };
    expect(row.round).toBe(0);
  });
});
