import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleBegin } from "../../src/tools/begin.js";
import { handleAnswer } from "../../src/tools/answer.js";
import { searchQA } from "../../src/db/fts.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-answer");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  const { inquiry_id, root_questions } = handleBegin(db, { task: "Test task", profile: "feature", project: "/test" });
  return { db, inquiry_id, root_questions };
}

describe("maieutic_answer", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("records an answer and marks question as answered", () => {
    const { db, root_questions } = setup();
    const qid = root_questions[0].id;
    const result = handleAnswer(db, { question_id: qid, answer: "The purpose is to increase user retention", confidence: 0.8, source: "self" });
    expect(result.answer_id).toBeTruthy();
    const answer = db.prepare("SELECT * FROM answers WHERE id = ?").get(result.answer_id) as { answer: string; confidence: number };
    expect(answer.answer).toBe("The purpose is to increase user retention");
    expect(answer.confidence).toBe(0.8);
    const question = db.prepare("SELECT status FROM questions WHERE id = ?").get(qid) as { status: string };
    expect(question.status).toBe("answered");
  });

  it("indexes answer into FTS", () => {
    const { db, root_questions } = setup();
    handleAnswer(db, { question_id: root_questions[0].id, answer: "Maximize engagement through gamification mechanics", confidence: 0.9 });
    const results = searchQA(db, { query: "gamification engagement" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("spawns follow-up questions when spawn[] is provided", () => {
    const { db, inquiry_id, root_questions } = setup();
    const qid = root_questions[0].id;
    const result = handleAnswer(db, {
      question_id: qid,
      answer: "Purpose is retention, but this raises two sub-questions",
      confidence: 0.6,
      spawn: [
        { element: "concepts", question: "What retention mechanics apply here?" },
        { element: "information", question: "What is the current retention rate?" },
      ],
    });
    expect(result.spawned_question_ids).toBeDefined();
    expect(result.spawned_question_ids!.length).toBe(2);
    for (const spawnedId of result.spawned_question_ids!) {
      const row = db.prepare("SELECT spawned_by, inquiry_id FROM questions WHERE id = ?").get(spawnedId) as { spawned_by: string; inquiry_id: string };
      expect(row.spawned_by).toBe(qid);
      expect(row.inquiry_id).toBe(inquiry_id);
    }
  });

  it("defaults confidence to 0.5 and source to self", () => {
    const { db, root_questions } = setup();
    const result = handleAnswer(db, { question_id: root_questions[0].id, answer: "Not sure about this" });
    const answer = db.prepare("SELECT confidence, source FROM answers WHERE id = ?").get(result.answer_id) as { confidence: number; source: string };
    expect(answer.confidence).toBe(0.5);
    expect(answer.source).toBe("self");
  });
});
