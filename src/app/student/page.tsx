"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { Session, Test } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { SessionTimer } from "@/components/shared/SessionTimer";
import { useAppUser } from "@/hooks/useAppUser";

export default function StudentDashboard() {
  const firestore = useFirestore();
  const { firebaseUser, isLoading: isUserLoading } = useAppUser();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionsQuery = useMemoFirebase(
    () => {
      if (!firebaseUser) return null;
      return query(
        collection(firestore, "sessions"),
        where("status", "==", "active"),
        where("allowedStudents", "array-contains-any", [
          "all",
          firebaseUser.uid,
        ])
      );
    },
    [firestore, firebaseUser?.uid]
  );
  
  const testsCollection = useMemoFirebase(() => collection(firestore, "tests"), [firestore]);
  const { data: tests } = useCollection<Test>(testsCollection);

  useEffect(() => {
    if (!sessionsQuery || isUserLoading) return;

    const unsubscribe = onSnapshot(sessionsQuery, (querySnapshot) => {
      const sessions: Session[] = [];
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as Session);
      });
      
      const latestSession = sessions.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0] || null;
      setActiveSession(latestSession);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching active sessions: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionsQuery, isUserLoading]);

  useEffect(() => {
    if (!firebaseUser && !isUserLoading) {
      setLoading(false);
    }
  }, [firebaseUser, isUserLoading]);

  const getTestTitles = (testIds: string[]) => {
      if (!tests) return 'Завантаження...';
      return testIds.map(id => tests.find(t => t.id === id)?.title || '').join(', ');
  }

  if (loading || isUserLoading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          </div>
      )
  }

  if (!firebaseUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground p-12 space-y-2">
            <p className="font-medium text-lg">Увійдіть, щоб переглянути сесії.</p>
            <Button asChild>
              <Link href="/login">Увійти</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Ваш кабінет</h2>
        <p className="text-muted-foreground">
          Тут з'являться активні тестові сесії, призначені для вас.
        </p>
      </div>

      {activeSession ? (
          <Card className="max-w-2xl mx-auto">
              <CardHeader>
                  <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{activeSession.title}</CardTitle>
                        <CardDescription className="mt-2">
                           Тести: {getTestTitles(activeSession.testIds)}
                        </CardDescription>
                      </div>
                      <SessionTimer session={activeSession} />
                  </div>
              </CardHeader>
              <CardContent>
                  {activeSession.isPaused ? (
                       <div className="text-center text-destructive p-8 rounded-lg bg-destructive/10">
                            <p className="font-medium text-lg">Сесію тимчасово призупинено.</p>
                            <p className="text-sm mt-2">Зачекайте, поки вчитель її продовжить.</p>
                        </div>
                  ) : (
                       <div className="text-center text-muted-foreground p-8">
                            <p className="font-medium text-lg">Сесія активна. Ви можете починати.</p>
                       </div>
                  )}
              </CardContent>
              <CardFooter>
                  <Button className="w-full" disabled={activeSession.isPaused} asChild>
                    <Link href={`/session/${activeSession.id}`}>
                      <Play className="mr-2 h-4 w-4"/>
                      Перейти до тестування
                    </Link>
                  </Button>
              </CardFooter>
          </Card>
      ) : (
         <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground p-12">
                <p className="font-medium text-lg">Наразі немає активних сесій.</p>
                <p className="text-sm mt-2">Коли адміністратор запустить пробну НМТ-сесію, вона з'явиться тут.</p>
              </div>
            </CardContent>
          </Card>
      )}
    </>
  );
}
