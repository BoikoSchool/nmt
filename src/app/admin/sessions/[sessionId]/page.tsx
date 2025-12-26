"use client";

import React, { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  convertToNmtScale,
  getMaxScoreForTest,
  generateResultsCsv,
} from "@/lib/scoring";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

/**
 * Мінімальні типи для цієї сторінки.
 * Якщо у тебе вже є типи під Supabase в "@/lib/types" – можеш потім підмінити.
 */
type SessionSupa = {
  id: string;
  title: string;
  testIds: string[];
};

type AttemptSupa = {
  id: string;
  studentId: string;
  status: "in_progress" | "finished" | string;
  scoreByTest: Record<string, number>;
  finishedAt: Date | null;
};

type TestSupa = {
  id: string;
  title: string;
  subjectId: string | null;
  // якщо getMaxScoreForTest дивиться на questions, то це треба підвантажувати
  questions?: any;
};

type SubjectSupa = {
  id: string;
  name: string;
};

type ProfileSupa = {
  id: string;
  email: string | null;
};

export default function SessionResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { toast } = useToast();

  const [session, setSession] = useState<SessionSupa | null>(null);
  const [attempts, setAttempts] = useState<AttemptSupa[] | null>(null);
  const [tests, setTests] = useState<TestSupa[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectSupa[] | null>(null);
  const [profiles, setProfiles] = useState<ProfileSupa[] | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Головне завантаження даних
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // A) Session
      const { data: sessionRow, error: sessionErr } = await supabase
        .from("sessions")
        .select("id,title,test_ids")
        .eq("id", sessionId)
        .single();

      if (sessionErr) {
        console.error("Session fetch error:", sessionErr);
        if (!cancelled) {
          setSession(null);
          setAttempts(null);
          setTests(null);
          setSubjects(null);
          setProfiles(null);
          setLoading(false);
        }
        return;
      }

      const mappedSession: SessionSupa = {
        id: sessionRow.id,
        title: sessionRow.title,
        testIds: sessionRow.test_ids ?? [],
      };

      // B) Attempts for this session
      const { data: attemptRows, error: attemptsErr } = await supabase
        .from("attempts")
        .select("id,session_id,student_id,status,score_by_test,finished_at")
        .eq("session_id", sessionId);

      if (attemptsErr) {
        console.error("Attempts fetch error:", attemptsErr);
        toast({
          variant: "destructive",
          title: "Помилка читання спроб",
          description: "Перевір RLS для таблиці attempts (або назви колонок).",
        });
      }

      const mappedAttempts: AttemptSupa[] = (attemptRows ?? []).map(
        (r: any) => ({
          id: r.id,
          studentId: r.student_id,
          status: r.status,
          scoreByTest: r.score_by_test ?? {},
          finishedAt: r.finished_at ? new Date(r.finished_at) : null,
        })
      );

      // C) Profiles for students (id in studentIds)
      const studentIds = Array.from(
        new Set(mappedAttempts.map((a) => a.studentId).filter(Boolean))
      );

      let mappedProfiles: ProfileSupa[] = [];
      if (studentIds.length > 0) {
        const { data: profileRows, error: profilesErr } = await supabase
          .from("profiles")
          .select("id,email")
          .in("id", studentIds);

        if (profilesErr) {
          console.error("Profiles fetch error:", profilesErr);
        } else {
          mappedProfiles = (profileRows ?? []).map((p: any) => ({
            id: p.id,
            email: p.email ?? null,
          }));
        }
      }

      // D) Tests for this session
      let mappedTests: TestSupa[] = [];
      if (mappedSession.testIds.length > 0) {
        const { data: testRows, error: testsErr } = await supabase
          .from("tests")
          .select("id,title,subject_id,questions")
          .in("id", mappedSession.testIds);

        if (testsErr) {
          console.error("Tests fetch error:", testsErr);
        } else {
          mappedTests = (testRows ?? []).map((t: any) => ({
            id: t.id,
            title: t.title,
            subjectId: t.subject_id ?? null,
            questions: t.questions,
          }));
        }
      }

      // E) Subjects
      const subjectIds = Array.from(
        new Set(mappedTests.map((t) => t.subjectId).filter(Boolean) as string[])
      );

      let mappedSubjects: SubjectSupa[] = [];
      if (subjectIds.length > 0) {
        const { data: subjectRows, error: subjectsErr } = await supabase
          .from("subjects")
          .select("id,name")
          .in("id", subjectIds);

        if (subjectsErr) {
          console.error("Subjects fetch error:", subjectsErr);
        } else {
          mappedSubjects = (subjectRows ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
          }));
        }
      }

      if (cancelled) return;

      setSession(mappedSession);
      setAttempts(mappedAttempts);
      setProfiles(mappedProfiles);
      setTests(mappedTests);
      setSubjects(mappedSubjects);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, toast]);

  // 2) Мапи для швидкого доступу
  const usersMap = useMemo(() => {
    const map = new Map<string, ProfileSupa>();
    profiles?.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const testsMap = useMemo(() => {
    const map = new Map<string, any>();
    tests?.forEach((t) => map.set(t.id, t));
    return map;
  }, [tests]);

  const subjectsMap = useMemo(() => {
    const map = new Map<string, any>();
    subjects?.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const handleExport = () => {
    if (!attempts || !session) {
      toast({
        variant: "destructive",
        title: "Немає даних для експорту",
      });
      return;
    }

    try {
      // generateResultsCsv очікує твою структуру.
      // Тому передаю як any (щоб не впертись у типи під час міграції).
      const csvString = generateResultsCsv(
        attempts as any,
        testsMap as any,
        subjectsMap as any
      );

      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.setAttribute("href", url);

      const safeTitle = session.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      link.setAttribute("download", `results_${safeTitle}.csv`);

      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Експорт завершено",
        description: "Дані результатів було завантажено.",
      });
    } catch (error) {
      console.error("CSV Export Error:", error);
      toast({
        variant: "destructive",
        title: "Помилка експорту",
        description: "Не вдалося згенерувати CSV файл.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <h3 className="text-lg font-semibold">Сесію не знайдено.</h3>
        <Button variant="link" asChild>
          <Link href="/admin/sessions">Повернутись до списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon" className="h-8 w-8">
            <Link href="/admin/sessions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Результати сесії: {session.title}
            </h2>
            <p className="text-muted-foreground">
              Перегляд спроб проходження тесту студентами.
            </p>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={!attempts || attempts.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Експортувати в CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Спроби студентів</CardTitle>
          <CardDescription>
            {attempts?.length ?? 0} студентів взяли участь у цій сесії.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Студент</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Результати по тестах</TableHead>
                <TableHead>Рейтинг (100-200)</TableHead>
                <TableHead>Час завершення</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {!attempts || attempts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Ще немає жодної спроби для цієї сесії.
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map((attempt) => {
                  const user = usersMap.get(attempt.studentId);

                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">
                        {user?.email || attempt.studentId}
                      </TableCell>

                      <TableCell>
                        {attempt.status === "finished"
                          ? "Завершено"
                          : "В процесі"}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {Object.entries(attempt.scoreByTest).map(
                            ([testId, score]) => {
                              const test = testsMap.get(testId) as any;
                              const subject = test
                                ? (subjectsMap.get(test.subjectId) as any)
                                : null;

                              return (
                                <div
                                  key={testId}
                                  className="text-sm whitespace-nowrap"
                                >
                                  <span className="font-medium">
                                    {subject?.name || "Невідомий"}:
                                  </span>{" "}
                                  {score} / {getMaxScoreForTest(test)}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {Object.entries(attempt.scoreByTest).map(
                            ([testId, score]) => {
                              const test = testsMap.get(testId) as any;
                              const maxScore = getMaxScoreForTest(test);

                              return (
                                <div
                                  key={testId}
                                  className="text-sm font-semibold whitespace-nowrap"
                                >
                                  {convertToNmtScale(score as number, maxScore)}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {attempt.finishedAt
                          ? formatDistanceToNow(attempt.finishedAt, {
                              addSuffix: true,
                              locale: uk,
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
