export type IsoDate = string;

// ================== Users ==================
export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "student";
  class?: string | null;
  createdAt: IsoDate;
}

// ================== Subjects ==================
export interface Subject {
  id: string;
  name: string;
  description?: string;
  createdAt?: IsoDate | Date;
}

// ================== Test & Question Types ==================
export interface QuestionOption {
  id: string;
  text: string;
}

export interface MatchPrompt {
  id: string;
  text: string;
}

export interface CorrectMatch {
  promptId: string;
  optionId: string;
}

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "numeric_input"
  | "text_input"
  | "matching";

export interface Question {
  id: string;
  questionText: string;
  type: QuestionType;
  points: number;
  imageUrl?: string;

  // For single/multiple choice
  options?: QuestionOption[];

  // For matching
  matchPrompts?: MatchPrompt[];

  // Correct answers
  // single_choice/numeric/text: string[]
  // matching: CorrectMatch[]
  correctAnswers: (string | CorrectMatch)[];
}

export interface Test {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt?: IsoDate | Date;
}

// ================== Session Types (app-level) ==================
export interface Session {
  id: string;
  title: string;
  testIds: string[];
  durationMinutes: number;
  status: "draft" | "active" | "finished";
  allowedStudents: string[];
  showDetailedResultsToStudent: boolean;

  startTime: IsoDate | null;
  endTime: IsoDate | null;
  isPaused: boolean;
  pausedAt: IsoDate | null;

  createdAt: IsoDate;
}

// ================== Attempt Types ==================
export type AttemptStatus = "in_progress" | "finished";

export interface AttemptAnswer {
  value: any; // string | string[] | Record<string, string> etc.
  testId: string;
  subjectId: string;
}

export interface Attempt {
  id: string;
  sessionId: string;
  studentId: string;

  startedAt: IsoDate;
  finishedAt: IsoDate | null;

  status: AttemptStatus;
  answers: Record<string, AttemptAnswer>;
  scoreByTest: Record<string, number>;
}
