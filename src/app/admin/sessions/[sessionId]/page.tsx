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
import { Session, Attempt, Test, Subject } from "@/lib/types";
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
import { Loader2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';

export default function SessionResultsPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const firestore = useFirestore();

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


  const isLoading = loadingSession || loadingAttempts || loadingTests || loadingSubjects;

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
                <TableHead className="w-[30%]">ID Студента (демо)</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Загальний бал</TableHead>
                <TableHead>Результати по тестах</TableHead>
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
                attempts.map(attempt => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-mono text-xs">{attempt.studentId}</TableCell>
                    <TableCell>{attempt.status === 'finished' ? 'Завершено' : 'В процесі'}</TableCell>
                    <TableCell className="font-bold">{attempt.totalScore}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {Object.entries(attempt.scoreByTest).map(([testId, score]) => {
                          const test = testsMap.get(testId);
                          const subject = test ? subjectsMap.get(test.subjectId) : null;
                          return (
                            <div key={testId} className="text-sm">
                                <span className="font-medium">{subject?.name || 'Невідомий предмет'}:</span>{' '}
                                {score} балів
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
