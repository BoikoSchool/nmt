"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { SessionTimer } from "@/components/shared/SessionTimer";

type SessionRow = {
  id: string;
  title: string;
  test_ids: string[];
  status: string;
  is_paused: boolean;
  start_time: string | null;
  end_time: string | null;
  paused_at: string | null;
  created_at: string;
};

type TestRow = {
  id: string;
  title: string;
};

export default function StudentDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [testsMap, setTestsMap] = useState<Record<string, string>>({});

  // 1) user
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsUserLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setIsUserLoading(false);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadActiveSession = useCallback(async () => {
    setLoading(true);

    if (!userId) {
      setActiveSession(null);
      setTestsMap({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id,title,test_ids,status,is_paused,start_time,end_time,paused_at,created_at"
      )
      .eq("status", "active")
      .or(`allowed_students.cs.{all},allowed_students.cs.{${userId}}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("StudentDashboard: sessions select error", error);
      setActiveSession(null);
      setLoading(false);
      return;
    }

    const sessionRow = (data?.[0] as SessionRow) ?? null;
    setActiveSession(sessionRow);

    const ids = sessionRow?.test_ids ?? [];
    if (ids.length > 0) {
      const { data: tests, error: tErr } = await supabase
        .from("tests")
        .select("id,title")
        .in("id", ids);

      if (tErr) {
        console.error("StudentDashboard: tests select error", tErr);
      } else {
        const map: Record<string, string> = {};
        (tests as TestRow[] | null)?.forEach((t) => (map[t.id] = t.title));
        setTestsMap(map);
      }
    } else {
      setTestsMap({});
    }

    setLoading(false);
  }, [userId]);

  // initial load
  useEffect(() => {
    if (isUserLoading) return;
    loadActiveSession();
  }, [isUserLoading, loadActiveSession]);

  // ✅ realtime + fallback polling
  useEffect(() => {
    if (isUserLoading || !userId) return;

    const channel = supabase
      .channel("student-dashboard:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => {
          loadActiveSession();
        }
      )
      .subscribe();

    const pollId = setInterval(() => {
      loadActiveSession();
    }, 5000);

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [userId, isUserLoading, loadActiveSession]);

  const getTestTitles = (testIds: string[]) => {
    if (!testIds?.length) return "-";
    return testIds.map((id) => testsMap[id] || id).join(", ");
  };

  if (loading || isUserLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground p-12 space-y-2">
            <p className="font-medium text-lg">
              Увійдіть, щоб переглянути сесії.
            </p>
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
          Тут з&apos;являться активні тестові сесії, призначені для вас.
        </p>
      </div>

      {activeSession ? (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle className="text-2xl">
                  {activeSession.title}
                </CardTitle>
                <CardDescription className="mt-2">
                  Тести: {getTestTitles(activeSession.test_ids)}
                </CardDescription>
              </div>

              <SessionTimer
                session={{
                  id: activeSession.id,
                  status: activeSession.status,
                  isPaused: activeSession.is_paused,
                  endTime: activeSession.end_time,
                  pausedAt: activeSession.paused_at,
                }}
              />
            </div>
          </CardHeader>

          <CardContent>
            {activeSession.is_paused ? (
              <div className="text-center text-destructive p-8 rounded-lg bg-destructive/10">
                <p className="font-medium text-lg">
                  Сесію тимчасово призупинено.
                </p>
                <p className="text-sm mt-2">
                  Зачекайте, поки вчитель її продовжить.
                </p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <p className="font-medium text-lg">
                  Сесія активна. Ви можете починати.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button
              className="w-full"
              disabled={activeSession.is_paused}
              asChild
            >
              <Link href={`/session/${activeSession.id}`}>
                <Play className="mr-2 h-4 w-4" />
                Перейти до тестування
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground p-12">
              <p className="font-medium text-lg">
                Наразі немає активних сесій.
              </p>
              <p className="text-sm mt-2">
                Коли адміністратор запустить пробну НМТ-сесію, вона
                з&apos;явиться тут.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
