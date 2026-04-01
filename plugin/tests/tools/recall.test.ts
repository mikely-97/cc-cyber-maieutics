import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { handleRecall } from "../../src/tools/recall.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-recall");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id, root_questions } = handleBegin(db, { task: "Build mobile game onboarding", profile: "feature", project: "/game-project" });
  handleAnswer(db, { question_id: root_questions[0].id, answer: "The purpose is to maximize player retention through engaging first-time experience and monetization hooks", confidence: 0.9 });
  handleAnswer(db, { question_id: root_questions[1].id, answer: "The end user is a casual mobile gamer who plays in short sessions during commute", confidence: 0.7 });
  return { db, inquiry_id, root_questions };
}

describe("maieutic_recall", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("finds relevant past reasoning by keyword", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "player retention monetization" });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].answer).toContain("retention");
  });

  it("filters by project", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "retention", project: "/other-project" });
    expect(result.results.length).toBe(0);
    const result2 = handleRecall(db, { query: "retention", project: "/game-project" });
    expect(result2.results.length).toBeGreaterThan(0);
  });

  it("respects limit", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "mobile game", limit: 1 });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });

  it("filters by min_confidence", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "mobile game", min_confidence: 0.85 });
    for (const r of result.results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("returns empty array for no matches", () => {
    const { db } = setup();
    const result = handleRecall(db, { query: "quantum physics blockchain" });
    expect(result.results).toEqual([]);
  });
});
