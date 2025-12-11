"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  doc,
} from "firebase/firestore";
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { Session, Test } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Pause, Play } from "lucide-react";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

const SessionTimer = ({ session }: { session: Session }) => {
  const firestore = useFirestore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (session.status !== "active" || !session.endTime) {
      setTimeLeft(null);
      return;
    }
    
    if (session.isPaused) {
        // If paused, just calculate time left once and don't start interval
        if (session.endTime && session.pausedAt) {
            const endTimeMs = session.endTime.toDate().getTime();
            // This calculation is incorrect. The time left should be calculated from endTime - now, but considering the pause.
            // A better way is to store the remaining time when paused.
            // However, with the current logic, the endTime is extended.
            // So we just need to calculate remaining time from now. But since it's paused, we can show the time from when it was paused.
             const now = session.pausedAt.toDate().getTime();
             const remaining = session.endTime.toDate().getTime() - now;
             setTimeLeft(remaining);
        }
        return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const endTimeMs = session.endTime!.toDate().getTime();
      const remaining = endTimeMs - now;
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        // Automatically finish session on client side if time is up
        const sessionRef = doc(firestore, "sessions", session.id);
        updateDocumentNonBlocking(sessionRef, { status: "finished" });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, firestore]);

  const formatTime = (ms: number | null) => {
    if (ms === null || ms < 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  if (session.status !== 'active') return null;

  if (session.isPaused) {
    return (
        <div className="flex items-center text-lg font-semibold text-destructive">
            <Pause className="mr-2 h-5 w-5" />
            <span>Сесію призупинено</span>
        </div>
    );
  }

  return (
    <div className="flex items-center text-lg font-semibold text-foreground">
      <Clock className="mr-2 h-5 w-5" />
      <span>{formatTime(timeLeft)}</span>
    </div>
  );
};


export default function StudentDashboard() {
  const firestore = useFirestore();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionsQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, "sessions"),
        where("status", "==", "active"),
        where("allowedStudents", "array-contains", "all")
      ),
    [firestore]
  );
  
  const testsCollection = useMemoFirebase(() => collection(firestore, "tests"), [firestore]);
  const { data: tests } = useCollection<Test>(testsCollection);

  useEffect(() => {
    if (!sessionsQuery) return;

    const unsubscribe = onSnapshot(sessionsQuery, (querySnapshot) => {
      const sessions: Session[] = [];
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as Session);
      });
      
      // Get the most recently created active session
      const latestSession = sessions.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0] || null;
      setActiveSession(latestSession);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching active sessions: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionsQuery]);

  const getTestTitles = (testIds: string[]) => {
      if (!tests) return 'Завантаження...';
      return testIds.map(id => tests.find(t => t.id === id)?.title || '').join(', ');
  }

  if (loading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          </div>
      )
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
                  <Button className="w-full" disabled={activeSession.isPaused}>
                    <Play className="mr-2 h-4 w-4"/>
                    Перейти до тестування
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
