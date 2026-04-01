import type { Database as DatabaseInstance } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Element, Profile, Depth, Visibility } from "../types.js";
import { PROFILE_ELEMENTS, DEPTH_LIMITS } from "../types.js";

interface BeginInput {
  task: string;
  profile?: Profile;
  depth?: Depth;
  visibility?: Visibility;
  elements?: Element[];
  project: string;
}

interface RootQuestion {
  id: string;
  element: Element;
  question: string;
}

interface BeginResult {
  inquiry_id: string;
  root_questions: RootQuestion[];
}

const ELEMENT_QUESTION_TEMPLATES: Record<Element, (task: string) => string> = {
  purpose: (task) =>
    `What is the ultimate purpose or goal of this task: "${task}"? What are we really trying to achieve beyond the immediate request?`,
  question_at_issue: (task) =>
    `What is the specific question or problem we are trying to solve with: "${task}"? What would a successful outcome look like?`,
  assumptions: (task) =>
    `What assumptions are we making about: "${task}"? What are we taking for granted that might not be true?`,
  point_of_view: (task) =>
    `Whose perspective are we considering for: "${task}"? Whose perspective are we missing? (end user, stakeholder, maintainer, etc.)`,
  information: (task) =>
    `What information or data do we have about: "${task}"? What information do we need but don't have yet?`,
  concepts: (task) =>
    `What domain concepts, principles, or patterns are relevant to: "${task}"? What established knowledge should guide our approach?`,
  inferences: (task) =>
    `What conclusions are we drawing about: "${task}"? Are these inferences justified by the evidence we have?`,
  implications: (task) =>
    `What are the implications and consequences of our approach to: "${task}"? What second-order effects should we consider?`,
};

export function handleBegin(db: DatabaseInstance, input: BeginInput): BeginResult {
  const now = new Date().toISOString();
  const inquiryId = randomUUID();
  const profile = input.profile ?? "auto";
  const depth = input.depth ?? "medium";
  const visibility = input.visibility ?? "summary";

  let elements: Element[];
  if (input.elements && input.elements.length > 0) {
    elements = input.elements;
  } else if (profile === "auto" || profile === "custom") {
    elements = PROFILE_ELEMENTS.feature;
  } else {
    elements = PROFILE_ELEMENTS[profile];
  }

  if (depth !== "custom") {
    const limit = DEPTH_LIMITS[depth].maxRoots;
    elements = elements.slice(0, limit);
  }

  db.prepare(
    `INSERT INTO inquiries (id, project, task, profile, depth, visibility, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(inquiryId, input.project, input.task, profile, depth, visibility, now, now);

  const rootQuestions: RootQuestion[] = elements.map((element) => {
    const questionId = randomUUID();
    const questionText = ELEMENT_QUESTION_TEMPLATES[element](input.task);
    db.prepare(
      `INSERT INTO questions (id, inquiry_id, round, element, question, status, spawned_by, created_at)
       VALUES (?, ?, 0, ?, ?, 'open', NULL, ?)`
    ).run(questionId, inquiryId, element, questionText, now);
    return { id: questionId, element, question: questionText };
  });

  return { inquiry_id: inquiryId, root_questions: rootQuestions };
}
