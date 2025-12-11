import { Timestamp } from "firebase/firestore";

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'student';
  class?: string | null;
  createdAt: Timestamp;
}

export interface Subject {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp | Date;
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

export type QuestionType = 'single_choice' | 'multiple_choice' | 'numeric_input' | 'text_input' | 'matching';

export interface Question {
  id: string;
  questionText: string;
  type: QuestionType;
  points: number;
  imageUrl?: string;
  testId?: string; // Added to simplify lookups
  // For single/multiple choice
  options?: QuestionOption[];
  // For matching
  matchPrompts?: MatchPrompt[];
  // Correct answers definition
  correctAnswers: (string | CorrectMatch)[];
}


export interface Test {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt?: Timestamp | Date;
}

// ================== Session Types ==================

export interface Session {
    id: string;
    title: string;
    testIds: string[];
    durationMinutes: number;
    status: 'draft' | 'active' | 'finished';
    allowedStudents: string[];
    showDetailedResultsToStudent: boolean;
    startTime: Timestamp | null;
    endTime: Timestamp | null;
    isPaused: boolean;
    pausedAt: Timestamp | null;
    createdAt: Timestamp;
}

// ================== Attempt Types =.================
export type AttemptStatus = 'in_progress' | 'finished';

export interface AttemptAnswer {
  value: any; // string for single_choice/numeric/text, string[] for multiple_choice, Record<string, string> for matching
  testId: string;
  subjectId: string;
}

export interface Attempt {
  id: string;
  sessionId: string;
  studentId: string;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  status: AttemptStatus;
  answers: Record<string, AttemptAnswer>; // Key is questionId
  scoreByTest: Record<string, number>; // Key is testId
}
