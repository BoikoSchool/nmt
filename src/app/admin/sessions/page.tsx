"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  Trash2,
  Play,
  Pause,
  PlayCircle,
  Square,
  ChevronDown,
  BarChart,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type DbSession = {
  id: string;
  title: string;
  test_ids: string[];
  duration_minutes: number;
  status: "draft" | "active" | "finished";
  allowed_students: string[];
  show_detailed_results_to_student: boolean;
  start_time: string | null;
  end_time: string | null;
  is_paused: boolean;
  paused_at: string | null;
  created_at: string;
};

type DbTest = {
  id: string;
  title: string;
};

const sessionSchema = z.object({
  title: z.string().min(1, "Назва сесії є обов'язковою."),
  testIds: z.array(z.string()).min(1, "Потрібно вибрати хоча б один тест."),
  durationMinutes: z.coerce
    .number()
    .min(1, "Тривалість має бути більшою за 0."),
  showDetailedResultsToStudent: z.boolean().default(false),
});

type SessionFormData = z.infer<typeof sessionSchema>;

function formatRemaining(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

export default function SessionsPage() {
  const { toast } = useToast();

  const [tests, setTests] = useState<DbTest[] | null>(null);
  const [sessions, setSessions] = useState<DbSession[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ щоб таймер у таблиці не “завмирав”
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: "",
      testIds: [],
      durationMinutes: 120,
      showDetailedResultsToStudent: false,
    },
  });

  const testsMap = useMemo(() => {
    if (!tests) return {};
    return tests.reduce((acc, t) => {
      acc[t.id] = t.title;
      return acc;
    }, {} as Record<string, string>);
  }, [tests]);

  const loadAll = async () => {
    setIsLoading(true);

    const [testsRes, sessionsRes] = await Promise.all([
      supabase
        .from("tests")
        .select("id,title")
        .order("created_at", { ascending: false }),
      supabase
        .from("sessions")
        .select(
          "id,title,test_ids,duration_minutes,status,allowed_students,show_detailed_results_to_student,start_time,end_time,is_paused,paused_at,created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (testsRes.error) {
      console.error("Tests load error:", testsRes.error);
      toast({
        title: "Не вдалося завантажити тести",
        description: testsRes.error.message,
      });
    } else {
      setTests((testsRes.data ?? []) as DbTest[]);
    }

    if (sessionsRes.error) {
      console.error("Sessions load error:", sessionsRes.error);
      toast({
        title: "Не вдалося завантажити сесії",
        description: sessionsRes.error.message,
      });
    } else {
      setSessions((sessionsRes.data ?? []) as DbSession[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSession = async (data: SessionFormData) => {
    const insertRes = await supabase.from("sessions").insert({
      title: data.title,
      test_ids: data.testIds,
      duration_minutes: data.durationMinutes,
      show_detailed_results_to_student: data.showDetailedResultsToStudent,
      status: "draft",
      allowed_students: ["all"],
      start_time: null,
      end_time: null,
      is_paused: false,
      paused_at: null,
    });

    if (insertRes.error) {
      console.error("Create session error:", insertRes.error);
      toast({
        title: "Помилка створення сесії",
        description: insertRes.error.message,
      });
      return;
    }

    toast({ title: "Сесію успішно створено!" });
    form.reset();
    loadAll();
  };

  const handleDeleteSession = async (sessionId: string) => {
    const res = await supabase.from("sessions").delete().eq("id", sessionId);
    if (res.error) {
      console.error("Delete session error:", res.error);
      toast({
        title: "Не вдалося видалити сесію",
        description: res.error.message,
      });
      return;
    }
    toast({ title: "Сесію видалено." });
    loadAll();
  };

  const handleStartSession = async (session: DbSession) => {
    const now = new Date();
    const end = new Date(now.getTime() + session.duration_minutes * 60 * 1000);

    const res = await supabase
      .from("sessions")
      .update({
        status: "active",
        start_time: now.toISOString(),
        end_time: end.toISOString(),
        is_paused: false,
        paused_at: null,
      })
      .eq("id", session.id);

    if (res.error) {
      console.error("Start session error:", res.error);
      toast({
        title: "Не вдалося запустити сесію",
        description: res.error.message,
      });
      return;
    }

    toast({ title: "Сесію запущено!" });
    loadAll();
  };

  const handlePauseSession = async (session: DbSession) => {
    const res = await supabase
      .from("sessions")
      .update({
        is_paused: true,
        paused_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (res.error) {
      console.error("Pause session error:", res.error);
      toast({
        title: "Не вдалося призупинити сесію",
        description: res.error.message,
      });
      return;
    }

    toast({ title: "Сесію призупинено." });
    loadAll();
  };

  const handleResumeSession = async (session: DbSession) => {
    if (!session.paused_at || !session.end_time) return;

    const pausedAt = new Date(session.paused_at).getTime();
    const now = Date.now();
    const pauseDurationMs = now - pausedAt;

    const oldEnd = new Date(session.end_time).getTime();
    const newEnd = new Date(oldEnd + pauseDurationMs);

    const res = await supabase
      .from("sessions")
      .update({
        end_time: newEnd.toISOString(),
        is_paused: false,
        paused_at: null,
      })
      .eq("id", session.id);

    if (res.error) {
      console.error("Resume session error:", res.error);
      toast({
        title: "Не вдалося продовжити сесію",
        description: res.error.message,
      });
      return;
    }

    toast({ title: "Сесію продовжено." });
    loadAll();
  };

  const handleFinishSession = async (session: DbSession) => {
    const res = await supabase
      .from("sessions")
      .update({
        status: "finished",
        is_paused: false,
      })
      .eq("id", session.id);

    if (res.error) {
      console.error("Finish session error:", res.error);
      toast({
        title: "Не вдалося завершити сесію",
        description: res.error.message,
      });
      return;
    }

    toast({ title: "Сесію завершено." });
    loadAll();
  };

  const getStatusBadge = (session: DbSession) => {
    if (session.status === "finished")
      return <Badge variant="secondary">Завершена</Badge>;
    if (session.status === "draft")
      return <Badge variant="outline">Чернетка</Badge>;
    if (session.status === "active") {
      if (session.is_paused)
        return <Badge variant="destructive">Призупинена</Badge>;
      return <Badge>Активна</Badge>;
    }
    return <Badge variant="secondary">Невідомо</Badge>;
  };

  const getTimeLeftLabel = (session: DbSession) => {
    if (session.status !== "active") return "-";
    if (!session.end_time) return "-";

    const endMs = new Date(session.end_time).getTime();

    if (session.is_paused) {
      if (!session.paused_at) return "Призупинено";
      const pausedMs = new Date(session.paused_at).getTime();
      return formatRemaining(endMs - pausedMs);
    }

    return formatRemaining(endMs - nowMs);
  };

  const getTestTitles = (testIds: string[]) => {
    if (!tests) return "Завантаження...";
    return testIds
      .map((id) => testsMap[id] || "")
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Створити нову сесію</CardTitle>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSession)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Назва сесії*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Напр. Пробне НМТ - Весна 2024"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="testIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тести*</FormLabel>

                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal"
                            >
                              <span className="truncate">
                                {field.value?.length > 0
                                  ? tests
                                      ?.filter((t) =>
                                        field.value.includes(t.id)
                                      )
                                      .map((t) => t.title)
                                      .join(", ")
                                  : "Оберіть тести..."}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>

                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          {tests?.map((test) => (
                            <div
                              key={test.id}
                              className="flex items-center gap-2 p-2"
                            >
                              <Checkbox
                                id={`test-${test.id}`}
                                checked={field.value?.includes(test.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...(field.value || []),
                                        test.id,
                                      ])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (v) => v !== test.id
                                        )
                                      );
                                }}
                              />
                              <label
                                htmlFor={`test-${test.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {test.title}
                              </label>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тривалість (хвилин)*</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="showDetailedResultsToStudent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Показувати детальні результати студенту
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>

              <CardFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Створити сесію
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Список сесій</CardTitle>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <h3 className="text-lg font-semibold">
                  Ще не створено жодної сесії.
                </h3>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Час до завершення</TableHead>
                    <TableHead>Дії</TableHead>
                    <TableHead className="text-right">Видалити</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/sessions/${session.id}`}
                          className="hover:underline"
                        >
                          {session.title}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                          Тести: {getTestTitles(session.test_ids)}
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(session)}</TableCell>

                      <TableCell className="font-mono">
                        {getTimeLeftLabel(session)}
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {session.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartSession(session)}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Запустити
                            </Button>
                          )}

                          {session.status === "active" &&
                            !session.is_paused && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePauseSession(session)}
                              >
                                <Pause className="mr-2 h-4 w-4" />
                                Призупинити
                              </Button>
                            )}

                          {session.status === "active" && session.is_paused && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeSession(session)}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Продовжити
                            </Button>
                          )}

                          {session.status !== "finished" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleFinishSession(session)}
                            >
                              <Square className="mr-2 h-4 w-4" />
                              Завершити
                            </Button>
                          )}

                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/sessions/${session.id}`}>
                              <BarChart className="mr-2 h-4 w-4" />
                              Результати
                            </Link>
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ви впевнені?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ця дія назавжди видалить сесію "{session.title}
                                ".
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                              <AlertDialogCancel>Скасувати</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSession(session.id)}
                              >
                                Видалити
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
