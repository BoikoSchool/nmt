"use client";

import React, { useState, useEffect } from "react";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Session } from "@/lib/types";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Clock, Pause } from "lucide-react";

export const SessionTimer = ({ session, asAdmin = false }: { session: Session, asAdmin?: boolean }) => {
  const firestore = useFirestore();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (session.status !== "active" || !session.endTime) {
      setTimeLeft(null);
      return;
    }
    
    if (session.isPaused) {
        if (session.endTime && session.pausedAt) {
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

      if (remaining <= 0 && !asAdmin) {
        clearInterval(interval);
        const sessionRef = doc(firestore, "sessions", session.id);
        updateDocumentNonBlocking(sessionRef, { status: "finished" });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, firestore, asAdmin]);

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

  if (session.status !== 'active') {
    if(asAdmin) return <span className="text-muted-foreground">-</span>
    return null;
  };

  if (session.isPaused) {
    return (
        <div className="flex items-center text-sm font-semibold text-destructive">
            <Pause className="mr-2 h-4 w-4" />
            <span>Призупинено</span>
        </div>
    );
  }

  return (
    <div className={`flex items-center font-semibold text-foreground ${asAdmin ? 'text-sm' : 'text-lg'}`}>
      <Clock className={`mr-2 ${asAdmin ? 'h-4 w-4' : 'h-5 w-5'}`} />
      <span>{formatTime(timeLeft)}</span>
    </div>
  );
};
