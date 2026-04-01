import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { handleSynthesize } from "../../src/tools/synthesize.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-synth");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id, root_questions } = handleBegin(db, { task: "Build onboarding", profile: "feature", project: "/test" });
  for (const q of root_questions) {
    handleAnswer(db, { question_id: q.id, answer: `Answer for ${q.element}`, confidence: 0.7 });
  }
  return { db, inquiry_id, root_questions };
}

describe("maieutic_synthesize", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a synthesis record", () => {
    const { db, inquiry_id } = setup();
    const result = handleSynthesize(db, { inquiry_id, round: 0, summary: "The purpose is clear but assumptions need validation" });
    expect(result.synthesis_id).toBeTruthy();
    expect(result.next_round).toBe(1);
    const synth = db.prepare("SELECT * FROM syntheses WHERE id = ?").get(result.synthesis_id) as { summary: string; round: number };
    expect(synth.summary).toContain("assumptions need validation");
    expect(synth.round).toBe(0);
  });

  it("stores open threads as JSON", () => {
    const { db, inquiry_id, root_questions } = setup();
    const openIds = [root_questions[0].id, root_questions[1].id];
    const result = handleSynthesize(db, { inquiry_id, round: 0, summary: "Some threads remain open", open_threads: openIds });
    const synth = db.prepare("SELECT open_threads FROM syntheses WHERE id = ?").get(result.synthesis_id) as { open_threads: string };
    expect(JSON.parse(synth.open_threads)).toEqual(openIds);
  });

  it("creates next-round questions when provided", () => {
    const { db, inquiry_id } = setup();
    handleSynthesize(db, {
      inquiry_id, round: 0, summary: "Need deeper investigation",
      next_questions: [
        { element: "information", question: "What data do we have on drop-off rates?" },
        { element: "inferences", question: "Is our assumption about tutorial length correct?" },
      ],
    });
    const nextQuestions = db.prepare("SELECT * FROM questions WHERE inquiry_id = ? AND round = 1").all(inquiry_id) as { element: string }[];
    expect(nextQuestions.length).toBe(2);
  });

  it("links next questions to their spawned_by parents", () => {
    const { db, inquiry_id, root_questions } = setup();
    handleSynthesize(db, {
      inquiry_id, round: 0, summary: "Follow up needed",
      next_questions: [{ element: "information", question: "More data needed", spawned_by: root_questions[0].id }],
    });
    const q = db.prepare("SELECT spawned_by FROM questions WHERE inquiry_id = ? AND round = 1").get(inquiry_id) as { spawned_by: string };
    expect(q.spawned_by).toBe(root_questions[0].id);
  });
});
