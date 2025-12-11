import { Timestamp } from "firebase/firestore";

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

export type QuestionType = 'single_choice' | 'multiple_choice' | 'numeric_input' | 'text_input';

export interface Question {
  id: string;
  questionText: string;
  type: QuestionType;
  points: number;
  imageUrl?: string;
  options?: QuestionOption[];
  correctAnswers: string[];
}

export interface Test {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt?: Timestamp | Date;
}
