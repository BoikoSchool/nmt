"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Pause } from "lucide-react";

type TimerSession = {
  id: string;
  status: string;
  isPaused?: boolean;
  endTime?: string | Date | null;
  pausedAt?: string | Date | null;
};

const toMs = (v?: string | Date | null) => {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
};

export const SessionTimer = ({
  session,
  asAdmin = false,
}: {
  session: TimerSession;
  asAdmin?: boolean;
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  const endMs = useMemo(() => toMs(session.endTime), [session.endTime]);
  const pausedAtMs = useMemo(() => toMs(session.pausedAt), [session.pausedAt]);

  const stateRef = useRef({
    status: session.status,
    isPaused: !!session.isPaused,
    endMs,
    pausedAtMs,
  });

  // оновлюємо ref, але НЕ перезапускаємо інтервал
  useEffect(() => {
    stateRef.current = {
      status: session.status,
      isPaused: !!session.isPaused,
      endMs,
      pausedAtMs,
    };
  }, [session.status, session.isPaused, endMs, pausedAtMs]);

  // інтервал стартує 1 раз
  useEffect(() => {
    const compute = () => {
      const { status, isPaused, endMs, pausedAtMs } = stateRef.current;

      if (status !== "active" || !endMs) {
        setTimeLeftMs(null);
        return;
      }

      if (isPaused) {
        const base = pausedAtMs ?? Date.now();
        setTimeLeftMs(Math.max(0, endMs - base));
        return;
      }

      setTimeLeftMs(Math.max(0, endMs - Date.now()));
    };

    compute();
    const id = window.setInterval(compute, 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatTime = (ms: number | null) => {
    const safe = ms ?? 0;
    const totalSeconds = Math.floor(safe / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  if (session.status !== "active") {
    if (asAdmin) return <span className="text-muted-foreground">-</span>;
    return null;
  }

  if (session.isPaused) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <Pause className="h-4 w-4" />
        <span>Призупинено</span>
        {/* корисно бачити заморожений час */}
        <span className="text-foreground">{formatTime(timeLeftMs)}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center font-semibold text-foreground ${
        asAdmin ? "text-sm" : "text-lg"
      }`}
    >
      <Clock className={`mr-2 ${asAdmin ? "h-4 w-4" : "h-5 w-5"}`} />
      <span>{formatTime(timeLeftMs)}</span>
    </div>
  );
};
