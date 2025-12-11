import { Timestamp } from "firebase/firestore";

export interface Subject {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp | Date;
}
