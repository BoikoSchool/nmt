"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import {
  Session,
  Test,
  Subject,
  Question,
  Attempt,
  AttemptAnswer,
  CorrectMatch,
} from "@/lib/types";
import { useDebouncedCallback } from "use-debounce";
import Link from "next/link";
import "katex/dist/katex.min.css";
import { KatexRenderer } from "@/components/shared/KatexRenderer";
import { useAppUser } from "@/hooks/useAppUser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
} from "lucide-react";
import { SessionTimer } from "@/components/shared/SessionTimer";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

type EnrichedTest = Test & { subjectName: string };

type EnrichedQuestion = Question & {
  testId: string;
  subjectId: string;
  testTitle: string;
  localIndex: number;
};

interface SessionPageClientProps {
  sessionId: string;
}

export default function SessionPageClient({
  sessionId,
}: SessionPageClientProps) {
  const firestore = useFirestore();

  // State Management
  const { firebaseUser, isLoading: isUserLoading } = useAppUser();
  const [tests, setTests] = useState<EnrichedTest[]>([]);
  const [allQuestions, setAllQuestions] = useState<EnrichedQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState<
    Record<string, AttemptAnswer>
  >({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  // Data Fetching
  const sessionRef = useMemoFirebase(
    () => doc(firestore, "sessions", sessionId),
    [firestore, sessionId]
  );
  const { data: session, isLoading: loadingSession } =
    useDoc<Session>(sessionRef);

  const isStudentAllowed = useMemo(() => {
    if (!session) return false;
    if (session.allowedStudents?.includes("all")) return true;
    if (firebaseUser && session.allowedStudents?.includes(firebaseUser.uid)) {
      return true;
    }
    return false;
  }, [session, firebaseUser]);

  // Fetch tests and subjects when session data is available
  useEffect(() => {
    if (!session || tests.length > 0) return;

    const fetchTestsAndSubjects = async () => {
      if (session.testIds.length === 0) {
        setTests([]);
        setIsLoading(false);
        return;
      }
      const testsQuery = query(
        collection(firestore, "tests"),
        where("__name__", "in", session.testIds)
      );
      const subjectsQuery = collection(firestore, "subjects");

      const [testsSnapshot, subjectsSnapshot] = await Promise.all([
        getDocs(testsQuery),
        getDocs(subjectsQuery),
      ]);

      const subjectsMap = new Map(
        subjectsSnapshot.docs.map((d) => [d.id, d.data() as Subject])
      );
      const enrichedTests = testsSnapshot.docs.map((d) => {
        const testData = d.data() as Test;
        return {
          id: d.id,
          ...testData,
          subjectName: subjectsMap.get(testData.subjectId)?.name ?? "Невідомо",
        };
      });

      // Keep the order from session.testIds
      enrichedTests.sort(
        (a, b) => session.testIds.indexOf(a.id) - session.testIds.indexOf(b.id)
      );

      const allQuestionsFromTests = enrichedTests.flatMap((t) =>
        (t.questions || []).map((q, index) => ({
          ...q,
          testId: t.id,
          subjectId: t.subjectId,
          testTitle: t.title,
          localIndex: index + 1,
        }))
      );

      setAllQuestions(allQuestionsFromTests as EnrichedQuestion[]);
      setTests(enrichedTests);
      if (enrichedTests.length > 0) {
        setActiveTestId(enrichedTests[0].id);
      }
    };

    fetchTestsAndSubjects();
  }, [session, firestore, tests.length]);

  // Find or create an attempt for this student and session
  useEffect(() => {
    if (!session || isUserLoading) return;

    if (!firebaseUser || !isStudentAllowed) {
      if (session && !isUserLoading && !isStudentAllowed) {
        setIsLoading(false);
      }
      return;
    }

    const studentId = firebaseUser.uid;

    const attemptQuery = query(
      collection(firestore, "attempts"),
      where("sessionId", "==", sessionId),
      where("studentId", "==", studentId)
    );

    const findOrCreateAttempt = async () => {
      const existingAttempts = await getDocs(attemptQuery);
      if (!existingAttempts.empty) {
        const existingAttempt = {
          id: existingAttempts.docs[0].id,
          ...existingAttempts.docs[0].data(),
        } as Attempt;
        setAttempt(existingAttempt);
        setCurrentAnswers(existingAttempt.answers || {});
      } else if (session.status === "active") {
        const attemptsCollection = collection(firestore, "attempts");
        const newAttemptData = {
          sessionId,
          studentId,
          startedAt: serverTimestamp(),
          finishedAt: null,
          status: "in_progress" as const,
          answers: {},
          scoreByTest: {},
        };
        const newAttemptRef = await addDoc(attemptsCollection, newAttemptData);
        setAttempt({ id: newAttemptRef.id, ...newAttemptData } as Attempt);
      }
      setIsLoading(false);
    };

    findOrCreateAttempt();
  }, [session, firebaseUser, sessionId, firestore, isStudentAllowed, isUserLoading]);

  // Debounced answer saving
  const debouncedSaveAnswer = useDebouncedCallback(
    (questionId: string, answer: AttemptAnswer) => {
      if (!attempt) return;
      const attemptRef = doc(firestore, "attempts", attempt.id);
      updateDocumentNonBlocking(attemptRef, {
        [`answers.${questionId}`]: answer,
      });
    },
    500
  );

  const handleAnswerChange = (question: Question, value: any) => {
    const questionId = question.id;
    const newAnswers = { ...currentAnswers };
    const enrichedQuestion = question as EnrichedQuestion;

    const currentAnswer = newAnswers[questionId] || {
      value: {},
      testId: enrichedQuestion.testId,
      subjectId: enrichedQuestion.subjectId,
    };

    if (question.type === "matching") {
      const [promptId, optionId] = value.split(":");
      let newMatchingValue = {
        ...(typeof currentAnswer.value === "object" &&
        currentAnswer.value !== null &&
        !Array.isArray(currentAnswer.value)
          ? currentAnswer.value
          : {}),
      };

      if (optionId && optionId !== "none") {
        newMatchingValue[promptId] = optionId;
      } else {
        delete newMatchingValue[promptId];
      }
      newAnswers[questionId] = { ...currentAnswer, value: newMatchingValue };
    } else {
      newAnswers[questionId] = { ...currentAnswer, value };
    }

    setCurrentAnswers(newAnswers);
    debouncedSaveAnswer(questionId, newAnswers[questionId]);
  };

  // Finalize and score the attempt
  const finishAttempt = useCallback(async () => {
    if (
      !attempt ||
      attempt.status === "finished" ||
      !allQuestions.length ||
      isFinishing
    )
      return;
    setIsFinishing(true);

    let scoreByTest: Record<string, number> = {};

    allQuestions.forEach((q) => {
      const answer = currentAnswers[q.id];
      if (
        !answer ||
        answer.value === undefined ||
        answer.value === null ||
        (typeof answer.value === "string" && answer.value.trim() === "")
      )
        return;

      if (!scoreByTest[q.testId]) {
        scoreByTest[q.testId] = 0;
      }

      let questionScore = 0;

      if (
        q.type === "single_choice" ||
        q.type === "numeric_input" ||
        q.type === "text_input"
      ) {
        const correctAnswers = q.correctAnswers as string[];
        const isCorrect =
          correctAnswers.length === 1 &&
          String(answer.value).toLowerCase().trim() ===
            String(correctAnswers[0]).toLowerCase().trim();
        if (isCorrect) {
          questionScore = q.points;
        }
      } else if (q.type === "multiple_choice") {
        const studentAnswers = (
          Array.isArray(answer.value) ? answer.value : []
        ).sort();
        const correctAnswers = [...(q.correctAnswers as string[])].sort();
        const isCorrect =
          studentAnswers.length === correctAnswers.length &&
          studentAnswers.every((val, index) => val === correctAnswers[index]);
        if (isCorrect) {
          questionScore = q.points;
        }
      } else if (q.type === "matching") {
        const studentMatches = (answer.value as Record<string, string>) || {};
        const correctMatches = q.correctAnswers as CorrectMatch[];

        if (
          studentMatches &&
          typeof studentMatches === "object" &&
          correctMatches.length > 0
        ) {
          let correctCount = 0;
          for (const correctMatch of correctMatches) {
            if (
              studentMatches[correctMatch.promptId] === correctMatch.optionId
            ) {
              correctCount++;
            }
          }
          if (correctMatches.length > 0) {
            const pointsPerMatch = q.points / correctMatches.length;
            questionScore = correctCount * pointsPerMatch;
          }
        }
      }

      scoreByTest[q.testId] += questionScore;
    });

    Object.keys(scoreByTest).forEach((testId) => {
      scoreByTest[testId] = Math.round(scoreByTest[testId]);
    });

    const attemptRef = doc(firestore, "attempts", attempt.id);
    await updateDoc(attemptRef, {
      status: "finished",
      finishedAt: serverTimestamp(),
      scoreByTest: scoreByTest,
    });

    setAttempt((prev) =>
      prev ? { ...prev, status: "finished", scoreByTest } : null
    );
    setIsFinishing(false);
  }, [attempt, currentAnswers, allQuestions, firestore, isFinishing]);

  // Effect to auto-finish attempt when time is up or session is finished by admin
  useEffect(() => {
    if (!session || attempt?.status === "finished") return;
    if (
      session.status === "finished" ||
      (session.endTime && session.endTime.toDate() <= new Date())
    ) {
      finishAttempt();
    }
  }, [session, attempt?.status, finishAttempt]);

  const questionsForActiveTest = useMemo(() => {
    return allQuestions.filter((q) => q.testId === activeTestId);
  }, [allQuestions, activeTestId]);

  const activeQuestion = allQuestions[activeQuestionIndex];

  const unansweredQuestions =
    allQuestions.length -
    Object.keys(currentAnswers).filter((key) => {
      const answer = currentAnswers[key];
      if (answer.value === undefined || answer.value === null) return false;
      if (typeof answer.value === "string" && answer.value.trim() === "")
        return false;
      if (Array.isArray(answer.value) && answer.value.length === 0)
        return false;
      if (
        typeof answer.value === "object" &&
        !Array.isArray(answer.value) &&
        Object.keys(answer.value).length === 0
      )
        return false;
      return true;
    }).length;

  // Loading and initial states
  if (isLoading || loadingSession || isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Увійдіть, щоб продовжити</h1>
        <p className="mt-2 text-muted-foreground">
          Будь ласка, увійдіть у свій акаунт, щоб розпочати тестування.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Увійти</Link>
        </Button>
      </div>
    );
  }

  if (!isStudentAllowed) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Сесію не знайдено</h1>
        <p className="mt-2 text-muted-foreground">
          Переконайтеся, що ви використовуєте коректне посилання або що вас додали до списку
          дозволених студентів.
        </p>
        <Button asChild className="mt-6">
          <Link href="/student">Повернутись до кабінету</Link>
        </Button>
      </div>
    );
  }

  if (
    !session ||
    (session.status !== "active" && attempt?.status !== "finished")
  ) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Сесію не розпочато або завершено</h1>
        <p className="mt-2 text-muted-foreground">
          Будь ласка, поверніться до кабінету, щоб перевірити статус.
        </p>
        <Button asChild className="mt-6">
          <Link href="/student">Повернутись до кабінету</Link>
        </Button>
      </div>
    );
  }

  if (attempt?.status === "finished") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center p-4 bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold mt-4">
              Ви завершили цю сесію!
            </CardTitle>
            <CardDescription>
              Перегляньте ваші результати нижче.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-semibold text-left">
                Результати по предметах:
              </h3>
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="flex justify-between items-center p-3 rounded-md bg-secondary"
                >
                  <span className="font-medium">
                    {test.subjectName} - {test.title}
                  </span>
                  <span className="font-bold">
                    {attempt.scoreByTest?.[test.id] ?? 0} балів
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/student">Повернутись до кабінету</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (session.isPaused) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold text-destructive">
          Сесію тимчасово призупинено.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Зачекайте, поки вчитель її продовжить. Ваш прогрес збережено.
        </p>
        <Loader2 className="h-8 w-8 animate-spin mt-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-6 shrink-0 gap-4">
        <h1 className="text-xl font-semibold truncate" title={session.title}>
          {session.title}
        </h1>
        <div className="flex gap-4">
          {tests.map((test) => (
            <Button
              key={test.id}
              variant={activeTestId === test.id ? "secondary" : "ghost"}
              onClick={() => {
                setActiveTestId(test.id);
                const firstQuestionIndexOfTest = allQuestions.findIndex(
                  (q) => q.testId === test.id
                );
                setActiveQuestionIndex(
                  firstQuestionIndexOfTest >= 0 ? firstQuestionIndexOfTest : 0
                );
              }}
            >
              {test.subjectName}
            </Button>
          ))}
        </div>
        <SessionTimer session={session} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Question List */}
        <aside className="w-72 border-r overflow-y-auto p-4 flex flex-col">
          <h3 className="font-semibold text-md mb-2">
            {tests.find((t) => t.id === activeTestId)?.title}
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {questionsForActiveTest.map((q) => {
              const qIndex = allQuestions.findIndex((aq) => aq.id === q.id);
              const answer = currentAnswers[q.id];
              const isAnswered =
                answer?.value !== undefined &&
                answer.value !== null &&
                answer.value !== "" &&
                (Array.isArray(answer.value)
                  ? answer.value.length > 0
                  : typeof answer.value === "object" &&
                    !Array.isArray(answer.value)
                  ? Object.keys(answer.value).length > 0
                  : true);
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(qIndex)}
                  className={`flex items-center justify-center h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                    activeQuestionIndex === qIndex
                      ? "bg-primary text-primary-foreground"
                      : isAnswered
                      ? "bg-secondary"
                      : "hover:bg-accent"
                  }`}
                >
                  {q.localIndex}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Panel: Active Question */}
        {activeQuestion ? (
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-muted-foreground mb-4">
                Питання {activeQuestion.localIndex} з{" "}
                {questionsForActiveTest.length}
              </p>

              {activeQuestion.imageUrl && (
                <div className="mb-4 relative h-64 w-full">
                  <Image
                    src={activeQuestion.imageUrl}
                    alt={`Зображення до питання ${activeQuestion.localIndex}`}
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              )}

              <div className="prose prose-lg max-w-none mb-6 text-lg">
                <KatexRenderer content={activeQuestion.questionText} />
              </div>

              {activeQuestion.type === "single_choice" &&
                activeQuestion.options && (
                  <RadioGroup
                    key={activeQuestion.id}
                    value={
                      currentAnswers[activeQuestion.id]?.value ?? undefined
                    }
                    onValueChange={(value) =>
                      handleAnswerChange(activeQuestion, value)
                    }
                    className="space-y-2"
                    disabled={session.isPaused}
                  >
                    {activeQuestion.options.map((opt) => (
                      <div key={opt.id} className="flex items-center space-x-3">
                        <RadioGroupItem value={opt.id} id={opt.id} />
                        <Label
                          htmlFor={opt.id}
                          className="text-base font-normal"
                        >
                          <KatexRenderer content={opt.text} />
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

              {activeQuestion.type === "multiple_choice" &&
                activeQuestion.options && (
                  <div key={activeQuestion.id} className="space-y-2">
                    {activeQuestion.options.map((opt) => {
                      const currentSelection =
                        (currentAnswers[activeQuestion.id]?.value as
                          | string[]
                          | undefined) || [];
                      return (
                        <div
                          key={opt.id}
                          className="flex items-center space-x-3"
                        >
                          <Checkbox
                            id={opt.id}
                            key={`${activeQuestion.id}-${opt.id}`}
                            checked={currentSelection.includes(opt.id)}
                            onCheckedChange={(checked) => {
                              const newSelection = checked
                                ? [...currentSelection, opt.id]
                                : currentSelection.filter(
                                    (id: string) => id !== opt.id
                                  );
                              handleAnswerChange(activeQuestion, newSelection);
                            }}
                            disabled={session.isPaused}
                          />
                          <Label
                            htmlFor={opt.id}
                            className="text-base font-normal"
                          >
                            <KatexRenderer content={opt.text} />
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}

              {activeQuestion.type === "matching" &&
                activeQuestion.matchPrompts &&
                activeQuestion.options && (
                  <div
                    key={activeQuestion.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-8 gap-y-4 items-center"
                  >
                    {/* Prompts (Left side) */}
                    <div className="flex flex-col gap-4">
                      {activeQuestion.matchPrompts.map((prompt, index) => (
                        <div
                          key={prompt.id}
                          className="flex items-center gap-4 h-10"
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary font-bold shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <KatexRenderer content={prompt.text} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Selects (Middle) */}
                    <div className="flex flex-col gap-4">
                      {activeQuestion.matchPrompts.map((prompt) => {
                        const answerObject =
                          currentAnswers[activeQuestion.id]?.value;
                        const currentSelection =
                          typeof answerObject === "object" &&
                          answerObject !== null &&
                          !Array.isArray(answerObject)
                            ? (answerObject as Record<string, string>)
                            : {};

                        return (
                          <div
                            key={prompt.id}
                            className="flex items-center gap-4 h-10"
                          >
                            <Select
                              key={`${activeQuestion.id}-${prompt.id}`}
                              value={currentSelection[prompt.id] || "none"}
                              onValueChange={(value) =>
                                handleAnswerChange(
                                  activeQuestion,
                                  `${prompt.id}:${value}`
                                )
                              }
                              disabled={session.isPaused}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {activeQuestion.options!.map(
                                  (opt, optIndex) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                      {"АБВГДЕЄЖ"[optIndex]}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>

                    {/* Options (Right side) */}
                    <div className="flex flex-col gap-4">
                      {activeQuestion.options.map((option, index) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-4 h-10"
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary font-bold shrink-0">
                            {"АБВГДЕЄЖ"[index]}
                          </div>
                          <div className="flex-1">
                            <KatexRenderer content={option.text} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {activeQuestion.type === "numeric_input" && (
                <Input
                  key={activeQuestion.id}
                  type="number"
                  className="max-w-xs bg-white"
                  value={currentAnswers[activeQuestion.id]?.value ?? ""}
                  onChange={(e) =>
                    handleAnswerChange(activeQuestion, e.target.value)
                  }
                  disabled={session.isPaused}
                />
              )}

              {activeQuestion.type === "text_input" && (
                <Textarea
                  key={activeQuestion.id}
                  value={currentAnswers[activeQuestion.id]?.value ?? ""}
                  onChange={(e) =>
                    handleAnswerChange(activeQuestion, e.target.value)
                  }
                  rows={4}
                  className="bg-white"
                  disabled={session.isPaused}
                />
              )}
            </div>
            {/* Bottom Navigation */}
            <footer className="h-16 border-t flex items-center justify-between px-6 shrink-0 bg-background">
              <Button
                variant="outline"
                onClick={() =>
                  setActiveQuestionIndex((p) => Math.max(0, p - 1))
                }
                disabled={activeQuestionIndex === 0 || session.isPaused}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Попереднє питання
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isFinishing || session.isPaused}
                  >
                    {isFinishing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Завершити сесію
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Завершити сесію?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {unansweredQuestions > 0
                        ? `Ви впевнені, що хочете завершити? У вас залишилося ${unansweredQuestions} питань без відповіді.`
                        : "Ви відповіли на всі питання. Ви впевнені, що хочете завершити сесію?"}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                    <AlertDialogAction onClick={finishAttempt}>
                      Завершити
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                onClick={() =>
                  setActiveQuestionIndex((p) =>
                    Math.min(allQuestions.length - 1, p + 1)
                  )
                }
                disabled={
                  activeQuestionIndex === allQuestions.length - 1 ||
                  session.isPaused
                }
              >
                Наступне питання <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </footer>
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Питання завантажуються...</p>
          </div>
        )}
      </div>
    </div>
  );
}
