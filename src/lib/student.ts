// As there's no real authentication, we'll use localStorage to maintain a stable student ID.
// This allows a "student" to refresh the page or come back later and see their attempt.

const STUDENT_ID_KEY = 'demoStudentId';

/**
 * Gets the demo student ID from localStorage or generates a new one.
 * @returns {string} The student ID.
 */
export const getDemoStudentId = (): string => {
  if (typeof window === 'undefined') {
    // Return a temporary ID for SSR, actual ID will be determined on the client
    return 'ssr-student';
  }

  let studentId = localStorage.getItem(STUDENT_ID_KEY);

  if (!studentId) {
    studentId = crypto.randomUUID();
    localStorage.setItem(STUDENT_ID_KEY, studentId);
  }

  return studentId;
};
