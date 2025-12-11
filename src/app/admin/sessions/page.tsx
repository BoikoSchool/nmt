"use client";

import React, { useMemo, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  query,
  orderBy,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Session, Test } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  X,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { Badge } from "@/components/ui/badge";

const sessionSchema = z.object({
  title: z.string().min(1, "Назва сесії є обов'язковою."),
  testIds: z
    .array(z.string())
    .min(1, "Потрібно вибрати хоча б один тест."),
  durationMinutes: z.coerce
    .number()
    .min(1, "Тривалість має бути більшою за 0."),
  showDetailedResultsToStudent: z.boolean().default(false),
});

type SessionFormData = z.infer<typeof sessionSchema>;

export default function SessionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Data fetching
  const testsCollection = useMemoFirebase(
    () => collection(firestore, "tests"),
    [firestore]
  );
  const { data: tests, isLoading: loadingTests } =
    useCollection<Test>(testsCollection);

  const sessionsCollection = useMemoFirebase(
    () => collection(firestore, "sessions"),
    [firestore]
  );
  const sessionsQuery = useMemoFirebase(
    () =>
      sessionsCollection &&
      query(sessionsCollection, orderBy("createdAt", "desc")),
    [sessionsCollection]
  );
  const { data: sessions, isLoading: loadingSessions } =
    useCollection<Session>(sessionsQuery);

  const testsMap = useMemo(() => {
    if (!tests) return {};
    return tests.reduce((acc, test) => {
      acc[test.id] = test.title;
      return acc;
    }, {} as Record<string, string>);
  }, [tests]);

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: "",
      testIds: [],
      durationMinutes: 120,
      showDetailedResultsToStudent: false,
    },
  });

  const handleCreateSession = async (data: SessionFormData) => {
    if (!sessionsCollection) return;
    try {
      await addDoc(sessionsCollection, {
        ...data,
        status: "draft",
        allowedStudents: ["all"],
        startTime: null,
        endTime: null,
        isPaused: false,
        pausedAt: null,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Сесію успішно створено!" });
      form.reset();
    } catch (error) {
      console.error("Error creating session: ", error);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося створити сесію.",
      });
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const sessionRef = doc(firestore, "sessions", sessionId);
    deleteDocumentNonBlocking(sessionRef);
    toast({ title: "Сесію видалено." });
  };
  
  // Session State Management
  const handleStartSession = (session: Session) => {
    const sessionRef = doc(firestore, "sessions", session.id);
    const now = new Date();
    const endTime = new Date(now.getTime() + session.durationMinutes * 60 * 1000);

    updateDocumentNonBlocking(sessionRef, {
        status: 'active',
        startTime: Timestamp.fromDate(now),
        endTime: Timestamp.fromDate(endTime),
        isPaused: false,
        pausedAt: null,
    });
    toast({ title: "Сесію запущено!" });
  };

  const handlePauseSession = (session: Session) => {
      const sessionRef = doc(firestore, "sessions", session.id);
      updateDocumentNonBlocking(sessionRef, {
          isPaused: true,
          pausedAt: Timestamp.now(),
      });
      toast({ title: "Сесію призупинено." });
  };

  const handleResumeSession = (session: Session) => {
      if (!session.pausedAt || !session.endTime) return;
      const sessionRef = doc(firestore, "sessions", session.id);
      const now = new Date();
      const pauseDurationMs = now.getTime() - session.pausedAt.toDate().getTime();
      const newEndTime = new Date(session.endTime.toDate().getTime() + pauseDurationMs);

      updateDocumentNonBlocking(sessionRef, {
          endTime: Timestamp.fromDate(newEndTime),
          isPaused: false,
          pausedAt: null,
      });
      toast({ title: "Сесію продовжено." });
  };

  const handleFinishSession = (session: Session) => {
      const sessionRef = doc(firestore, "sessions", session.id);
      updateDocumentNonBlocking(sessionRef, {
          status: 'finished',
          isPaused: false,
      });
      toast({ title: "Сесію завершено." });
  };


  const formatDate = (date: any) => {
    if (!date) return "N/A";
    const jsDate = date.toDate ? date.toDate() : new Date(date);
    return format(jsDate, "dd.MM.yyyy HH:mm");
  };

  const getStatusBadge = (session: Session) => {
    if (session.status === 'finished') {
        return <Badge variant="secondary">Завершена</Badge>;
    }
    if (session.status === 'draft') {
        return <Badge variant="outline">Чернетка</Badge>;
    }
    if (session.status === 'active') {
        if (session.isPaused) {
            return <Badge variant="destructive">Призупинена</Badge>
        }
        return <Badge>Активна</Badge>
    }
    return <Badge variant="secondary">Невідомо</Badge>;
  };


  const isLoading = loadingTests || loadingSessions;

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
                        <Input placeholder="Напр. Пробне НМТ - Весна 2024" {...field} />
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
                                    ? tests?.filter(t => field.value.includes(t.id)).map(t => t.title).join(', ')
                                    : "Оберіть тести..."}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                           </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                           {tests?.map(test => (
                               <div key={test.id} className="flex items-center gap-2 p-2">
                                <Checkbox
                                    id={`test-${test.id}`}
                                    checked={field.value?.includes(test.id)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? field.onChange([...(field.value || []), test.id])
                                        : field.onChange(
                                            (field.value || []).filter(
                                                (value) => value !== test.id
                                            )
                                            );
                                    }}
                                />
                                <label htmlFor={`test-${test.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
                    <TableHead>Тести</TableHead>
                    <TableHead>Дії</TableHead>
                    <TableHead className="text-right">Видалити</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell>{getStatusBadge(session)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {session.testIds.map(id => testsMap[id]).join(', ') || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                           {session.status === 'draft' && <Button size="sm" variant="outline" onClick={() => handleStartSession(session)}><Play className="mr-2 h-4 w-4" />Запустити</Button>}
                           {session.status === 'active' && !session.isPaused && <Button size="sm" variant="outline" onClick={() => handlePauseSession(session)}><Pause className="mr-2 h-4 w-4" />Призупинити</Button>}
                           {session.status === 'active' && session.isPaused && <Button size="sm" variant="outline" onClick={() => handleResumeSession(session)}><PlayCircle className="mr-2 h-4 w-4" />Продовжити</Button>}
                           {session.status !== 'finished' && <Button size="sm" variant="destructive" onClick={() => handleFinishSession(session)}><Square className="mr-2 h-4 w-4" />Завершити</Button>}
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
                                Ця дія назавжди видалить сесію "{session.title}".
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
