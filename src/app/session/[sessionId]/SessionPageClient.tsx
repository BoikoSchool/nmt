// src/app/session/[sessionId]/SessionPageClient.tsx
"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Image from "next/image";
import Link from "next/link";
import "katex/dist/katex.min.css";

import { supabase } from "@/lib/supabaseClient";

import { KatexRenderer } from "@/components/shared/KatexRenderer";
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
import { useDebouncedCallback } from "use-debounce";

import type {
  Test,
  Subject,
  Question,
  AttemptAnswer,
  CorrectMatch,
} from "@/lib/types";
import { useAppUser } from "@/hooks/useAppUser";

type SessionRow = {
  id: string;
  title: string;
  status: "draft" | "active" | "finished";
  test_ids: string[];
  allowed_students: string[] | null;
  duration_minutes: number;
  show_detailed_results_to_student: boolean | null;

  start_time: string | null;
  end_time: string | null;
  is_paused: boolean | null;
  paused_at: string | null;
};

type AttemptRow = {
  id: string;
  session_id: string;
  student_id: string;
  started_at: string | null;
  finished_at: string | null;
  status: "in_progress" | "finished";
  answers: Record<string, AttemptAnswer> | null;
  score_by_test: Record<string, number> | null;
};

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

// Утиліта для порівняння об'єктів (shallow)
function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

export default function SessionPageClient({
  sessionId,
}: SessionPageClientProps) {
  // Використовуємо useAppUser замість прямого supabase.auth.getUser()
  const { appUser, isLoading: authLoading } = useAppUser();

  // session / data
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [tests, setTests] = useState<EnrichedTest[]>([]);
  const [allQuestions, setAllQuestions] = useState<EnrichedQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  // Синхронізація: коли змінюється activeQuestionIndex, оновлюємо activeTestId
  useEffect(() => {
    const currentQuestion = allQuestions[activeQuestionIndex];
    if (currentQuestion && currentQuestion.testId !== activeTestId) {
      setActiveTestId(currentQuestion.testId);
    }
  }, [activeQuestionIndex, allQuestions, activeTestId]);

  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<
    Record<string, AttemptAnswer>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  // Refs для запобігання зайвим оновленням
  const sessionRef = useRef<SessionRow | null>(null);
  const isFinishingRef = useRef(false);

  // ---------- SESSION FETCH з shallow comparison ----------
  const fetchSession = useCallback(async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) {
      console.error("Session load error:", error);
      setSession(null);
      sessionRef.current = null;
      return;
    }

    const newSession = data as SessionRow;

    // Оновлюємо state тільки якщо дані змінились
    if (!shallowEqual(sessionRef.current, newSession)) {
      sessionRef.current = newSession;
      setSession(newSession);
    }
  }, [sessionId]);

  // ---------- SESSION: realtime + рідкісний polling ----------
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setSessionLoading(true);
      await fetchSession();
      if (mounted) setSessionLoading(false);
    };

    init();

    // Realtime
    const channel = supabase
      .channel(`sessions:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (!mounted) return;

          if (payload.eventType === "DELETE") {
            setSession(null);
            sessionRef.current = null;
            return;
          }

          // Підтягуємо повний рядок
          fetchSession();
        }
      )
      .subscribe();

    // Fallback polling (рідше - кожні 10 секунд)
    const pollId = setInterval(() => {
      if (mounted) fetchSession();
    }, 10000);

    // Оновлення при поверненні на вкладку
    const onFocus = () => {
      if (mounted) fetchSession();
    };
    window.addEventListener("focus", onFocus);

    const onVis = () => {
      if (mounted && document.visibilityState === "visible") {
        fetchSession();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSession]);

  const isStudentAllowed = useMemo(() => {
    if (!session) return false;
    const allowed = session.allowed_students ?? [];
    if (allowed.includes("all")) return true;
    if (appUser && allowed.includes(appUser.id)) return true;
    return false;
  }, [session, appUser]);

  // ---------- TESTS + SUBJECTS (оновлюється тільки коли test_ids змінюється) ----------
  useEffect(() => {
    if (!session?.test_ids?.length) {
      setTests([]);
      setAllQuestions([]);
      setActiveTestId(null);
      return;
    }

    // Перевіряємо чи змінились test_ids
    const currentIds = tests
      .map((t) => t.id)
      .sort()
      .join(",");
    const sessionIds = [...session.test_ids].sort().join(",");

    if (currentIds === sessionIds && tests.length > 0) return;

    let mounted = true;

    const fetchTestsAndSubjects = async () => {
      const { data: testsRows, error: testsErr } = await supabase
        .from("tests")
        .select("id,title,subject_id,questions")
        .in("id", session.test_ids);

      if (!mounted) return;
      if (testsErr) {
        console.error("Tests load error:", testsErr);
        return;
      }

      const subjectIds = Array.from(
        new Set((testsRows ?? []).map((t: any) => t.subject_id).filter(Boolean))
      );

      const { data: subjectsRows, error: subjErr } = await supabase
        .from("subjects")
        .select("id,name")
        .in("id", subjectIds);

      if (!mounted) return;
      if (subjErr) {
        console.error("Subjects load error:", subjErr);
        return;
      }

      const subjectsMap = new Map<string, Subject>(
        (subjectsRows ?? []).map((s: any) => [s.id, s as Subject])
      );

      const enrichedTests: EnrichedTest[] = (testsRows ?? []).map((t: any) => {
        const subjectName = subjectsMap.get(t.subject_id)?.name ?? "Невідомо";
        return {
          id: t.id,
          title: t.title,
          subjectId: t.subject_id,
          questions: t.questions ?? [],
          subjectName,
        } as EnrichedTest;
      });

      // Порядок як в session.test_ids
      enrichedTests.sort(
        (a, b) =>
          session.test_ids.indexOf(a.id) - session.test_ids.indexOf(b.id)
      );

      const allQuestionsFromTests: EnrichedQuestion[] = enrichedTests.flatMap(
        (t) =>
          (t.questions || []).map((q: any, index: number) => ({
            ...q,
            testId: t.id,
            subjectId: t.subjectId,
            testTitle: t.title,
            localIndex: index + 1,
          }))
      );

      setTests(enrichedTests);
      setAllQuestions(allQuestionsFromTests);

      // Встановлюємо activeTestId на основі поточного activeQuestionIndex або першого питання
      if (allQuestionsFromTests.length > 0) {
        const currentQuestion =
          allQuestionsFromTests[activeQuestionIndex] ||
          allQuestionsFromTests[0];
        if (currentQuestion) {
          setActiveTestId(currentQuestion.testId);
          // Якщо поточний індекс виходить за межі, скидаємо на 0
          if (activeQuestionIndex >= allQuestionsFromTests.length) {
            setActiveQuestionIndex(0);
          }
        }
      }
    };

    fetchTestsAndSubjects();

    return () => {
      mounted = false;
    };
  }, [session?.test_ids]);

  // ---------- ATTEMPT: find or create ----------
  useEffect(() => {
    if (!session) return;
    if (authLoading) return;

    if (!appUser || !isStudentAllowed) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const ensureAttempt = async () => {
      setIsLoading(true);

      const { data: existing, error: findErr } = await supabase
        .from("attempts")
        .select("*")
        .eq("session_id", sessionId)
        .eq("student_id", appUser.id)
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (findErr) {
        console.error("Attempt find error:", findErr);
        setIsLoading(false);
        return;
      }

      if (existing) {
        const row = existing as AttemptRow;
        setAttempt(row);
        setCurrentAnswers(row.answers ?? {});
        setIsLoading(false);
        return;
      }

      if (session.status === "active") {
        const { data: created, error: insErr } = await supabase
          .from("attempts")
          .insert({
            session_id: sessionId,
            student_id: appUser.id,
            status: "in_progress",
            started_at: new Date().toISOString(),
            finished_at: null,
            answers: {},
            score_by_test: {},
          })
          .select("*")
          .single();

        if (!mounted) return;

        if (insErr) {
          console.error("Attempt insert error:", insErr);
        } else {
          const row = created as AttemptRow;
          setAttempt(row);
          setCurrentAnswers(row.answers ?? {});
        }
      }

      setIsLoading(false);
    };

    ensureAttempt();

    return () => {
      mounted = false;
    };
  }, [session?.status, sessionId, appUser?.id, authLoading, isStudentAllowed]);

  // ---------- Debounced answers save ----------
  const debouncedSaveAnswers = useDebouncedCallback(
    async (answers: Record<string, AttemptAnswer>) => {
      if (!attempt) return;

      const { error } = await supabase
        .from("attempts")
        .update({ answers })
        .eq("id", attempt.id);

      if (error) console.error("Attempt answers update error:", error);
    },
    500
  );

  // Cleanup debounced функції
  useEffect(() => {
    return () => {
      debouncedSaveAnswers.cancel();
    };
  }, [debouncedSaveAnswers]);

  const handleAnswerChange = useCallback(
    (question: Question, value: any) => {
      const questionId = question.id;
      const enrichedQuestion = question as EnrichedQuestion;

      setCurrentAnswers((prev) => {
        const prevAnswer = prev[questionId] || {
          value: {},
          testId: enrichedQuestion.testId,
          subjectId: enrichedQuestion.subjectId,
        };

        let nextAnswer: AttemptAnswer;

        if (question.type === "matching") {
          const [promptId, optionId] = String(value).split(":");

          const currentObj =
            typeof prevAnswer.value === "object" &&
            prevAnswer.value &&
            !Array.isArray(prevAnswer.value)
              ? (prevAnswer.value as Record<string, string>)
              : {};

          const updated = { ...currentObj };

          if (optionId && optionId !== "none") updated[promptId] = optionId;
          else delete updated[promptId];

          nextAnswer = { ...prevAnswer, value: updated };
        } else {
          nextAnswer = { ...prevAnswer, value };
        }

        const next = { ...prev, [questionId]: nextAnswer };
        debouncedSaveAnswers(next);
        return next;
      });
    },
    [debouncedSaveAnswers]
  );

  // ---------- finish attempt + scoring ----------
  const finishAttempt = useCallback(async () => {
    if (!attempt) return;
    if (attempt.status === "finished") return;
    if (!allQuestions.length) return;
    if (isFinishingRef.current) return;

    isFinishingRef.current = true;
    setIsFinishing(true);

    const scoreByTest: Record<string, number> = {};

    allQuestions.forEach((q) => {
      const answer = currentAnswers[q.id];
      if (!answer) return;

      const v = answer.value;
      if (v === undefined || v === null) return;
      if (typeof v === "string" && v.trim() === "") return;
      if (Array.isArray(v) && v.length === 0) return;
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      )
        return;

      if (!scoreByTest[q.testId]) scoreByTest[q.testId] = 0;

      let questionScore = 0;

      if (
        q.type === "single_choice" ||
        q.type === "numeric_input" ||
        q.type === "text_input"
      ) {
        const correctAnswers = q.correctAnswers as string[];
        const isCorrect =
          correctAnswers?.length === 1 &&
          String(v).toLowerCase().trim() ===
            String(correctAnswers[0]).toLowerCase().trim();

        if (isCorrect) questionScore = q.points;
      } else if (q.type === "multiple_choice") {
        const studentAnswers = (Array.isArray(v) ? v : []).slice().sort();
        const correctAnswers = ([...(q.correctAnswers as string[])] || [])
          .slice()
          .sort();

        const isCorrect =
          studentAnswers.length === correctAnswers.length &&
          studentAnswers.every((val, idx) => val === correctAnswers[idx]);

        if (isCorrect) questionScore = q.points;
      } else if (q.type === "matching") {
        const studentMatches = (v as Record<string, string>) || {};
        const correctMatches = (q.correctAnswers as CorrectMatch[]) || [];

        if (correctMatches.length > 0) {
          let correctCount = 0;
          for (const cm of correctMatches) {
            if (studentMatches[cm.promptId] === cm.optionId) correctCount++;
          }
          const pointsPerMatch = q.points / correctMatches.length;
          questionScore = correctCount * pointsPerMatch;
        }
      }

      scoreByTest[q.testId] += questionScore;
    });

    Object.keys(scoreByTest).forEach((testId) => {
      scoreByTest[testId] = Math.round(scoreByTest[testId]);
    });

    const { error } = await supabase
      .from("attempts")
      .update({
        status: "finished",
        finished_at: new Date().toISOString(),
        score_by_test: scoreByTest,
        answers: currentAnswers,
      })
      .eq("id", attempt.id);

    if (error) console.error("Attempt finish error:", error);

    setAttempt((prev) =>
      prev ? { ...prev, status: "finished", score_by_test: scoreByTest } : null
    );

    isFinishingRef.current = false;
    setIsFinishing(false);
  }, [attempt, allQuestions, currentAnswers]);

  // Auto-finish when session ended (виправлені залежності)
  useEffect(() => {
    if (!session) return;
    if (!attempt) return;
    if (attempt.status === "finished") return;
    if (isFinishingRef.current) return;

    const endMs = session.end_time
      ? new Date(session.end_time).getTime()
      : null;
    const now = Date.now();

    if (session.status === "finished" || (endMs !== null && endMs <= now)) {
      finishAttempt();
    }
  }, [session?.status, session?.end_time, attempt?.status, finishAttempt]);

  const questionsForActiveTest = useMemo(() => {
    return allQuestions.filter((q) => q.testId === activeTestId);
  }, [allQuestions, activeTestId]);

  const activeQuestion = useMemo(() => {
    const question = allQuestions[activeQuestionIndex];
    // Переконуємось, що активне питання належить до активного тесту
    if (question && question.testId === activeTestId) {
      return question;
    }
    // Якщо не співпадає, повертаємо перше питання активного тесту
    return questionsForActiveTest[0];
  }, [allQuestions, activeQuestionIndex, activeTestId, questionsForActiveTest]);

  const unansweredQuestions = useMemo(() => {
    return (
      allQuestions.length -
      Object.keys(currentAnswers).filter((key) => {
        const answer = currentAnswers[key];
        if (!answer) return false;
        const v = answer.value;
        if (v === undefined || v === null) return false;
        if (typeof v === "string" && v.trim() === "") return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (
          typeof v === "object" &&
          !Array.isArray(v) &&
          Object.keys(v).length === 0
        )
          return false;
        return true;
      }).length
    );
  }, [allQuestions.length, currentAnswers]);

  // ---------- UI STATES ----------
  if (isLoading || sessionLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!appUser) {
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

  // Перевіряємо що це студент
  if (appUser.role !== "student") {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Доступ тільки для студентів</h1>
        <p className="mt-2 text-muted-foreground">
          Ця сторінка доступна тільки для студентів.
        </p>
        <Button asChild className="mt-6">
          <Link href={appUser.role === "admin" ? "/admin" : "/"}>
            Повернутись
          </Link>
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Сесію не знайдено</h1>
        <p className="mt-2 text-muted-foreground">
          Можливо, її видалили або немає доступу.
        </p>
        <Button asChild className="mt-6">
          <Link href="/student">Повернутись до кабінету</Link>
        </Button>
      </div>
    );
  }

  if (!isStudentAllowed) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Немає доступу до сесії</h1>
        <p className="mt-2 text-muted-foreground">
          Перевірте посилання або чи вас додали до дозволених студентів.
        </p>
        <Button asChild className="mt-6">
          <Link href="/student">Повернутись до кабінету</Link>
        </Button>
      </div>
    );
  }

  if (session.status !== "active" && attempt?.status !== "finished") {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Сесію не розпочато або завершено</h1>
        <p className="mt-2 text-muted-foreground">
          Поверніться до кабінету та перевірте статус.
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
                    {attempt.score_by_test?.[test.id] ?? 0} балів
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

  if (session.is_paused) {
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

  // ---------- MAIN UI ----------
  return (
    <div className="flex flex-col h-screen">
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
                // Знаходимо перше питання цього тесту
                const firstQuestionIndex = allQuestions.findIndex(
                  (q) => q.testId === test.id
                );
                if (firstQuestionIndex >= 0) {
                  // Встановлюємо індекс - activeTestId оновиться автоматично через useEffect
                  setActiveQuestionIndex(firstQuestionIndex);
                }
              }}
            >
              {test.subjectName}
            </Button>
          ))}
        </div>

        <SessionTimer
          session={{
            id: session.id,
            status: session.status,
            isPaused: !!session.is_paused,
            endTime: session.end_time,
            pausedAt: session.paused_at,
          }}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r overflow-y-auto p-4 flex flex-col">
          <h3 className="font-semibold text-md mb-2">
            {tests.find((t) => t.id === activeTestId)?.title}
          </h3>

          <div className="grid grid-cols-5 gap-2">
            {questionsForActiveTest.map((q) => {
              const qIndex = allQuestions.findIndex((aq) => aq.id === q.id);
              const ans = currentAnswers[q.id];
              const v = ans?.value;

              const isAnswered =
                v !== undefined &&
                v !== null &&
                v !== "" &&
                (Array.isArray(v)
                  ? v.length > 0
                  : typeof v === "object" && !Array.isArray(v)
                  ? Object.keys(v).length > 0
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
                    fill
                    style={{ objectFit: "contain" }}
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
                    disabled={!!session.is_paused}
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
                            checked={currentSelection.includes(opt.id)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...currentSelection, opt.id]
                                : currentSelection.filter(
                                    (id) => id !== opt.id
                                  );
                              handleAnswerChange(activeQuestion, next);
                            }}
                            disabled={!!session.is_paused}
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

                    <div className="flex flex-col gap-4">
                      {activeQuestion.matchPrompts.map((prompt) => {
                        const answerObj =
                          currentAnswers[activeQuestion.id]?.value;
                        const currentSelection =
                          typeof answerObj === "object" &&
                          answerObj &&
                          !Array.isArray(answerObj)
                            ? (answerObj as Record<string, string>)
                            : {};

                        return (
                          <div
                            key={prompt.id}
                            className="flex items-center gap-4 h-10"
                          >
                            <Select
                              value={currentSelection[prompt.id] || "none"}
                              onValueChange={(value) =>
                                handleAnswerChange(
                                  activeQuestion,
                                  `${prompt.id}:${value}`
                                )
                              }
                              disabled={!!session.is_paused}
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
                  disabled={!!session.is_paused}
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
                  disabled={!!session.is_paused}
                />
              )}
            </div>

            <footer className="h-16 border-t flex items-center justify-between px-6 shrink-0 bg-background">
              <Button
                variant="outline"
                onClick={() =>
                  setActiveQuestionIndex((p) => Math.max(0, p - 1))
                }
                disabled={activeQuestionIndex === 0 || !!session.is_paused}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Попереднє питання
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isFinishing || !!session.is_paused}
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
                        ? `Ви впевнені? Залишилося ${unansweredQuestions} питань без відповіді.`
                        : "Ви відповіли на всі питання. Завершити?"}
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
                  !!session.is_paused
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
