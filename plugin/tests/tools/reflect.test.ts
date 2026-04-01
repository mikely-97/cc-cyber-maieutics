import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleReflect } from "../../src/tools/reflect.js";
import { searchQA } from "../../src/db/fts.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-reflect");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id } = handleBegin(db, { task: "Build feature X", profile: "feature", project: "/test" });
  return { db, inquiry_id };
}

describe("maieutic_reflect", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a reflection record", () => {
    const { db, inquiry_id } = setup();
    const result = handleReflect(db, { inquiry_id, what_worked: "Questioning assumptions early saved time", what_missed: "Didn't consider mobile performance constraints", key_insight: "Always question the data before questioning the design" });
    expect(result.reflection_id).toBeTruthy();
    const ref = db.prepare("SELECT * FROM reflections WHERE id = ?").get(result.reflection_id) as { key_insight: string };
    expect(ref.key_insight).toBe("Always question the data before questioning the design");
  });

  it("marks inquiry as completed", () => {
    const { db, inquiry_id } = setup();
    handleReflect(db, { inquiry_id, what_worked: "Good", what_missed: "Nothing", key_insight: "It worked" });
    const inquiry = db.prepare("SELECT status FROM inquiries WHERE id = ?").get(inquiry_id) as { status: string };
    expect(inquiry.status).toBe("completed");
  });

  it("indexes key insight into FTS for future recall", () => {
    const { db, inquiry_id } = setup();
    handleReflect(db, { inquiry_id, what_worked: "Socratic questioning surfaced hidden assumptions", what_missed: "Should have questioned stakeholder priorities", key_insight: "Never assume the stated requirements match the actual business goal" });
    const results = searchQA(db, { query: "requirements business goal" });
    expect(results.length).toBeGreaterThan(0);
  });
});
