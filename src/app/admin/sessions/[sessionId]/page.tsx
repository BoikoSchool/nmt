"use client";

import React, { useMemo } from "react";
import Link from 'next/link';
import {
  collection,
  query,
  where,
  doc
} from "firebase/firestore";
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { Session, Attempt, Test, Subject, AppUser } from "@/lib/types";
import { convertToNmtScale, getMaxScoreForTest, generateResultsCsv } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";


export default function SessionResultsPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const firestore = useFirestore();
  const { toast } = useToast();

  // Fetch session details
  const sessionRef = useMemoFirebase(() => doc(firestore, "sessions", sessionId), [firestore, sessionId]);
  const { data: session, isLoading: loadingSession } = useDoc<Session>(sessionRef);

  // Fetch all attempts for this session
  const attemptsQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, "attempts"),
        where("sessionId", "==", sessionId)
      ),
    [firestore, sessionId]
  );
  const { data: attempts, isLoading: loadingAttempts } = useCollection<Attempt>(attemptsQuery);
  
  // Fetch users based on studentIds from attempts
  const studentIds = useMemo(() => attempts?.map(a => a.studentId) || [], [attempts]);
  const usersQuery = useMemoFirebase(() => {
    if (studentIds.length === 0) return null;
    return query(collection(firestore, "users"), where("__name__", "in", studentIds));
  }, [firestore, studentIds]);
  const { data: users, isLoading: loadingUsers } = useCollection<AppUser>(usersQuery);

  const usersMap = useMemo(() => {
    const map = new Map<string, AppUser>();
    users?.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);


  // Fetch tests and subjects to map IDs to names
  const testIds = useMemo(() => session?.testIds || [], [session]);
  const testsQuery = useMemoFirebase(() => {
    if (testIds.length === 0) return null;
    return query(collection(firestore, "tests"), where("__name__", "in", testIds));
  }, [firestore, testIds]);
  const { data: tests, isLoading: loadingTests } = useCollection<Test>(testsQuery);
  
  const subjectIds = useMemo(() => tests?.map(t => t.subjectId) || [], [tests]);
  const subjectsQuery = useMemoFirebase(() => {
    if (subjectIds.length === 0) return null;
    return query(collection(firestore, "subjects"), where("__name__", "in", subjectIds));
  }, [firestore, subjectIds]);
  const { data: subjects, isLoading: loadingSubjects } = useCollection<Subject>(subjectsQuery);

  const testsMap = useMemo(() => {
    const map = new Map<string, Test>();
    tests?.forEach(t => map.set(t.id, t));
    return map;
  }, [tests]);

  const subjectsMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects?.forEach(s => map.set(s.id, s));
    return map;
  }, [subjects]);

  const handleExport = () => {
    if (!attempts || !session) {
        toast({
            variant: "destructive",
            title: "Немає даних для експорту"
        });
        return;
    }

    try {
        const csvString = generateResultsCsv(attempts, testsMap, subjectsMap);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const safeTitle = session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("download", `results_${safeTitle}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
            title: "Експорт завершено",
            description: "Дані результатів було завантажено."
        });
    } catch (error) {
        console.error("CSV Export Error:", error);
        toast({
            variant: "destructive",
            title: "Помилка експорту",
            description: "Не вдалося згенерувати CSV файл."
        });
    }
  };


  const isLoading = loadingSession || loadingAttempts || loadingTests || loadingSubjects || loadingUsers;

  if (isLoading) {
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
              <Button variant="link" asChild><Link href="/admin/sessions">Повернутись до списку</Link></Button>
          </div>
      )
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
              <h2 className="text-2xl font-bold tracking-tight">Результати сесії: {session.title}</h2>
              <p className="text-muted-foreground">Перегляд спроб проходження тесту студентами.</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={!attempts || attempts.length === 0}>
            <Download className="mr-2 h-4 w-4"/>
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
              {(!attempts || attempts.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Ще немає жодної спроби для цієї сесії.
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map(attempt => {
                    const user = usersMap.get(attempt.studentId);
                    return (
                        <TableRow key={attempt.id}>
                        <TableCell className="font-medium">{user?.email || attempt.studentId}</TableCell>
                        <TableCell>{attempt.status === 'finished' ? 'Завершено' : 'В процесі'}</TableCell>
                        <TableCell>
                        <div className="flex flex-col gap-1">
                            {Object.entries(attempt.scoreByTest).map(([testId, score]) => {
                            const test = testsMap.get(testId);
                            const subject = test ? subjectsMap.get(test.subjectId) : null;
                            return (
                                <div key={testId} className="text-sm whitespace-nowrap">
                                    <span className="font-medium">{subject?.name || 'Невідомий'}:</span>{' '}
                                    {score as number} / {getMaxScoreForTest(test)}
                                </div>
                            )
                            })}
                        </div>
                        </TableCell>
                        <TableCell>
                        <div className="flex flex-col gap-1">
                            {Object.entries(attempt.scoreByTest).map(([testId, score]) => {
                            const test = testsMap.get(testId);
                            const maxScore = getMaxScoreForTest(test);
                            return (
                                <div key={testId} className="text-sm font-semibold whitespace-nowrap">
                                    {convertToNmtScale(score as number, maxScore)}
                                </div>
                            )
                            })}
                        </div>
                        </TableCell>
                        <TableCell>
                        {attempt.finishedAt 
                            ? formatDistanceToNow(attempt.finishedAt.toDate(), { addSuffix: true, locale: uk })
                            : '-'}
                        </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
