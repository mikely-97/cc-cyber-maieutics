// Socratic Elements of Thought
export type Element =
  | "purpose"
  | "question_at_issue"
  | "assumptions"
  | "point_of_view"
  | "information"
  | "concepts"
  | "inferences"
  | "implications";

export type Profile = "auto" | "feature" | "bugfix" | "refactor" | "custom";
export type Depth = "shallow" | "medium" | "deep" | "custom";
export type Visibility = "silent" | "summary" | "verbose";
export type InquiryStatus = "active" | "paused" | "completed" | "abandoned";
export type QuestionStatus = "open" | "answered" | "skipped" | "merged";
export type AnswerSource = "self" | "user" | "recall" | "tool";
export type LinkRelation = "informs" | "contradicts" | "refines" | "duplicates";

export interface Inquiry {
  id: string;
  project: string;
  task: string;
  profile: Profile;
  depth: Depth;
  visibility: Visibility;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  inquiry_id: string;
  round: number;
  element: Element;
  question: string;
  status: QuestionStatus;
  spawned_by: string | null;
  agent_id: string | null;
  created_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  answer: string;
  confidence: number;
  source: AnswerSource;
  created_at: string;
}

export interface QuestionLink {
  from_id: string;
  to_id: string;
  relation: LinkRelation;
}

export interface Synthesis {
  id: string;
  inquiry_id: string;
  round: number;
  summary: string;
  open_threads: string | null;
  next_questions: string | null;
  created_at: string;
}

export interface Reflection {
  id: string;
  inquiry_id: string;
  what_worked: string | null;
  what_missed: string | null;
  key_insight: string | null;
  created_at: string;
}

export interface RecallResult {
  inquiry_id: string;
  question: string;
  answer: string;
  confidence: number;
  element: string;
  created_at: string;
  rank: number;
}

// Profile → default elements mapping
export const PROFILE_ELEMENTS: Record<Exclude<Profile, "auto" | "custom">, Element[]> = {
  feature: ["purpose", "point_of_view", "implications", "concepts"],
  bugfix: ["assumptions", "information", "inferences", "question_at_issue"],
  refactor: ["purpose", "concepts", "implications", "assumptions"],
};

// Depth → limits mapping
export const DEPTH_LIMITS: Record<Exclude<Depth, "custom">, { maxRoots: number; maxRounds: number }> = {
  shallow: { maxRoots: 3, maxRounds: 1 },
  medium: { maxRoots: 5, maxRounds: 2 },
  deep: { maxRoots: 8, maxRounds: 4 },
};
