"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Subject, Test } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const testSchema = z.object({
  title: z.string().min(1, { message: "Назва тесту є обов'язковою." }),
  description: z.string().optional(),
  subjectId: z.string().min(1, { message: "Будь ласка, оберіть предмет." }),
});

type TestFormData = z.infer<typeof testSchema>;

type DbSubjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type DbTestRow = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  created_at: string;
};

export default function TestsPage() {
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);

  const subjectsMap = useMemo(() => {
    return (subjects ?? []).reduce((acc, s) => {
      acc[s.id] = s.name;
      return acc;
    }, {} as Record<string, string>);
  }, [subjects]);

  const form = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      title: "",
      description: "",
      subjectId: "",
    },
  });

  async function loadSubjects() {
    setLoadingSubjects(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("id,name,description,created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("loadSubjects error:", error);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося завантажити предмети.",
      });
      setSubjects([]);
      setLoadingSubjects(false);
      return;
    }

    const mapped: Subject[] = (data as DbSubjectRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
    }));

    setSubjects(mapped);
    setLoadingSubjects(false);
  }

  async function loadTests() {
    setLoadingTests(true);
    const { data, error } = await supabase
      .from("tests")
      .select("id,subject_id,title,description,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadTests error:", error);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося завантажити тести.",
      });
      setTests([]);
      setLoadingTests(false);
      return;
    }

    const mapped: Test[] = (data as DbTestRow[]).map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      title: row.title,
      description: row.description ?? undefined,
      questions: [], // питання підтягнемо на сторінці редагування тесту (наступний крок)
      createdAt: row.created_at,
    }));

    setTests(mapped);
    setLoadingTests(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([loadSubjects(), loadTests()]);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTest = async (data: TestFormData) => {
    try {
      const { data: created, error } = await supabase
        .from("tests")
        .insert({
          subject_id: data.subjectId,
          title: data.title,
          description: data.description?.trim()
            ? data.description.trim()
            : null,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Тест створено!",
        description: `Тест "${data.title}" успішно створено.`,
      });

      form.reset();
      await loadTests();

      // НЕ переходимо на /admin/tests/[id] поки не переведемо ту сторінку з Firebase на Supabase
      // (це буде наступним кроком)
      console.log("Created test id:", created?.id);
    } catch (error) {
      console.error("Error creating test:", error);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося створити тест.",
      });
    }
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      // Якщо є FK questions.test_id -> tests.id, спочатку видаляємо питання
      const { error: qErr } = await supabase
        .from("questions")
        .delete()
        .eq("test_id", testId);

      // якщо таблиці questions ще нема або RLS не дає - qErr може бути
      if (qErr) console.warn("delete questions warning:", qErr);

      const { error } = await supabase.from("tests").delete().eq("id", testId);
      if (error) throw error;

      toast({ title: "Тест видалено." });
      await loadTests();
    } catch (error) {
      console.error("Error deleting test:", error);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося видалити тест.",
      });
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    const jsDate =
      typeof date === "string"
        ? new Date(date)
        : date?.toDate?.() ?? new Date(date);
    return format(jsDate, "dd.MM.yyyy");
  };

  const isLoading = loadingSubjects || loadingTests;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Створити новий тест</CardTitle>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateTest)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Предмет*</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loadingSubjects}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Оберіть предмет..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects?.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Назва тесту*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Напр. Українська мова - варіант 1"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Опис (необов'язково)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Короткий опис тесту"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                  Створити тест
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Список тестів</CardTitle>
            <CardDescription>
              Тут знаходяться всі створені тести. Кнопку "Редагувати" увімкнемо
              наступним кроком.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !tests || tests.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <h3 className="text-lg font-semibold">
                  Ще не створено жодного тесту.
                </h3>
                <p className="mt-1 text-sm">
                  Скористайтеся формою зліва, щоб додати перший тест.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва тесту</TableHead>
                    <TableHead>Предмет</TableHead>
                    <TableHead>Питань</TableHead>
                    <TableHead>Дата створення</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">
                        {test.title}
                      </TableCell>
                      <TableCell>
                        {subjectsMap[test.subjectId] || "Невідомо"}
                      </TableCell>
                      <TableCell>{test.questions?.length || 0}</TableCell>
                      <TableCell>{formatDate(test.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild disabled>
                            <Link href={`/admin/tests/${test.id}`}>
                              <Pencil className="h-3 w-3 mr-1" />
                              Редагувати
                            </Link>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Видалити</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Ви впевнені?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Цю дію неможливо скасувати. Це назавжди
                                  видалить тест "{test.title}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTest(test.id)}
                                >
                                  Видалити
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
