"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppUser } from "@/hooks/useAppUser";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { appUser, appUserError, isLoading } = useAppUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Якщо є помилка завантаження профілю або немає користувача
    if (!appUser || appUserError) {
      router.push("/login");
      return;
    }

    // Редірект на основі ролі
    if (appUser.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/student");
    }
  }, [appUser, appUserError, isLoading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </main>
  );
}
