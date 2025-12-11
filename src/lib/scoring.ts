"use client";

import { Test, Question } from './types';

/**
 * Calculates the maximum possible score for a given test.
 * @param test The test object with its questions.
 * @returns The total maximum points for the test.
 */
export const getMaxScoreForTest = (test: Test | undefined): number => {
  if (!test || !test.questions) return 0;
  return test.questions.reduce((total, q) => total + q.points, 0);
};


/**
 * Converts a raw test score to the NMT 100-200 point scale using linear interpolation.
 * @param rawScore The student's score on the test.
 * @param maxScore The maximum possible score for the test.
 * @returns The score on the 100-200 scale, or 100 if the maxScore is 0 or score is negative.
 */
export const convertToNmtScale = (rawScore: number, maxScore: number): number => {
  if (maxScore <= 0 || rawScore < 0) {
    return 100;
  }
  const score = Math.min(rawScore, maxScore); // Cap score at max score
  const scale = (200 - 100) / maxScore;
  return Math.round(100 + score * scale);
};


const getCorrectAnswerString = (question: Question): string => {
    if (question.type === 'matching') {
        const correctMatches = question.correctAnswers as { promptId: string; optionId: string }[];
        return correctMatches.map(m => `${m.promptId}->${m.optionId}`).join('; ');
    }
    return (question.correctAnswers as string[]).join(', ');
}

const getStudentAnswerString = (question: Question, answerValue: any): string => {
    if (answerValue === undefined || answerValue === null) return "N/A";
    
    if (question.type === 'matching') {
        if (typeof answerValue !== 'object' || Array.isArray(answerValue)) return "Invalid format";
        return Object.entries(answerValue).map(([promptId, optionId]) => `${promptId}->${optionId}`).join('; ');
    }
    
    if (Array.isArray(answerValue)) {
        return answerValue.join(', ');
    }

    return String(answerValue);
}

/**
 * Generates a CSV string from session results for detailed analysis.
 * @param attempts Array of student attempts.
 * @param testsMap Map of test IDs to test objects.
 * @param subjectsMap Map of subject IDs to subject objects.
 * @returns A string in CSV format.
 */
export const generateResultsCsv = (
  attempts: any[], 
  testsMap: Map<string, Test>,
  subjectsMap: Map<string, any>
): string => {
  const headers = [
    "studentId",
    "subject",
    "testTitle",
    "questionId",
    "questionText",
    "questionType",
    "studentAnswer",
    "correctAnswer",
    "pointsReceived",
    "maxPoints",
  ];
  
  let csvContent = headers.join(",") + "\n";
  const allQuestionsMap = new Map<string, Question>();
  testsMap.forEach(test => {
      test.questions.forEach(q => allQuestionsMap.set(q.id, q));
  });


  attempts.forEach(attempt => {
    const studentId = attempt.studentId;
    const answers = attempt.answers || {};

    // Iterate over all questions that were part of the session
    allQuestionsMap.forEach((question, questionId) => {
        const answer = answers[questionId];
        const test = testsMap.get(answer?.testId || question.testId); // Fallback to question.testId if answer is missing
        const subject = subjectsMap.get(test?.subjectId);
        
        let pointsReceived = 0;
        if (answer && test) {
             const scoreByTestForAttempt = attempt.scoreByTest[test.id] || 0;
             // This is a simplification; for a precise per-question score, the scoring logic would need to be re-run here.
             // For now, we just indicate if the answer was part of a scored test.
        }

        const row = [
            `"${studentId}"`,
            `"${subject?.name || 'N/A'}"`,
            `"${test?.title || 'N/A'}"`,
            `"${question.id}"`,
            `"${question.questionText.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${question.type}"`,
            `"${getStudentAnswerString(question, answer?.value)}"`,
            `"${getCorrectAnswerString(question)}"`,
            `""`, // Points received per question is hard to calculate back, leaving blank
            `"${question.points}"`
        ];
        csvContent += row.join(",") + "\n";
    });
  });

  return csvContent;
};
