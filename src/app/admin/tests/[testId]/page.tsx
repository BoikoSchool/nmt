"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Upload,
  Download,
  Plus,
  Pencil,
  Trash2,
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
import { supabase } from "@/lib/supabaseClient";

// ====== Типи (легкі, щоб не залежати від старих firebase-типів) ======
type SubjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
};

type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "numeric_input"
  | "text_input"
  | "matching";

type Question = {
  id: string;
  questionText: string;
  type: QuestionType;
  points: number;

  options?: any[];
  matchPrompts?: any[];
  correctAnswers: any[];
};

type TestRow = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  questions: Question[] | null;
  created_at?: string;
};

// ====== Zod schemas ======
const testDetailsSchema = z.object({
  title: z.string().min(1, "Назва тесту є обов'язковою."),
  description: z.string().optional(),
  subjectId: z.string().min(1, "Предмет є обов'язковим."),
});
type TestDetailsFormData = z.infer<typeof testDetailsSchema>;

const questionSchema = z.object({
  questionText: z.string().min(1, "Текст питання є обов'язковим."),
  type: z.enum([
    "single_choice",
    "multiple_choice",
    "numeric_input",
    "text_input",
    "matching",
  ]),
  points: z.coerce.number().min(0, "Бали мають бути невід'ємним числом."),
});
type QuestionFormData = z.infer<typeof questionSchema>;

export default function EditTestPage({
  params,
}: {
  params: { testId: string };
}) {
  const { testId } = params;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [test, setTest] = useState<TestRow | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    null
  );

  const testDetailsForm = useForm<TestDetailsFormData>({
    resolver: zodResolver(testDetailsSchema),
    defaultValues: { title: "", description: "", subjectId: "" },
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: { questionText: "", type: "single_choice", points: 1 },
  });

  const subjectName = useMemo(() => {
    if (!test) return "...";
    const s = subjects.find((x) => x.id === test.subject_id);
    return s?.name ?? "Невідомий предмет";
  }, [test, subjects]);

  // ====== load test + subjects ======
  useEffect(() => {
    let alive = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const [subjectsRes, testRes] = await Promise.all([
        supabase
          .from("subjects")
          .select("id,name,description,created_at")
          .order("name", { ascending: true }),
        supabase
          .from("tests")
          .select("id,title,description,subject_id,questions,created_at")
          .eq("id", testId)
          .single(),
      ]);

      if (!alive) return;

      if (subjectsRes.error) {
        setLoadError(subjectsRes.error.message);
        setIsLoading(false);
        return;
      }

      if (testRes.error) {
        setLoadError(testRes.error.message);
        setIsLoading(false);
        return;
      }

      const subjectsRows = (subjectsRes.data ?? []) as SubjectRow[];
      const testRow = testRes.data as TestRow;

      setSubjects(subjectsRows);
      setTest(testRow);

      testDetailsForm.reset({
        title: testRow.title ?? "",
        description: testRow.description ?? "",
        subjectId: testRow.subject_id ?? "",
      });

      setIsLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [testId, testDetailsForm]);

  // ====== update test details ======
  const handleUpdateTestDetails = async (data: TestDetailsFormData) => {
    try {
      const { error } = await supabase
        .from("tests")
        .update({
          title: data.title,
          description: data.description ?? null,
          subject_id: data.subjectId,
        })
        .eq("id", testId);

      if (error) throw error;

      setTest((prev) =>
        prev
          ? {
              ...prev,
              title: data.title,
              description: data.description ?? null,
              subject_id: data.subjectId,
            }
          : prev
      );

      toast({ title: "Інформацію про тест оновлено." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: e?.message ?? "Не вдалося оновити тест.",
      });
    }
  };

  // ====== helpers: update questions json ======
  const updateQuestionsInDb = async (updatedQuestions: Question[]) => {
    const { error } = await supabase
      .from("tests")
      .update({ questions: updatedQuestions })
      .eq("id", testId);

    if (error) throw error;

    setTest((prev) => (prev ? { ...prev, questions: updatedQuestions } : prev));
  };

  // ====== import/export ======
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== "string")
          throw new Error("Не вдалося прочитати файл.");

        const questions = JSON.parse(content);
        if (!Array.isArray(questions))
          throw new Error("JSON має бути масивом.");

        const isValid = questions.every((q: any) => {
          if (
            typeof q.id !== "string" ||
            typeof q.questionText !== "string" ||
            typeof q.type !== "string" ||
            typeof q.points !== "number" ||
            !Array.isArray(q.correctAnswers)
          ) {
            return false;
          }

          if (q.type === "matching") {
            if (
              !Array.isArray(q.matchPrompts) ||
              !Array.isArray(q.options) ||
              !Array.isArray(q.correctAnswers)
            ) {
              return false;
            }
            return q.correctAnswers.every(
              (ans: any) =>
                typeof ans === "object" && ans.promptId && ans.optionId
            );
          }

          if (["single_choice", "multiple_choice"].includes(q.type)) {
            if (!Array.isArray(q.options)) return false;
          }

          if (
            [
              "single_choice",
              "multiple_choice",
              "numeric_input",
              "text_input",
            ].includes(q.type)
          ) {
            return q.correctAnswers.every(
              (ans: any) => typeof ans === "string"
            );
          }

          return false;
        });

        if (!isValid) {
          throw new Error(
            "Один або більше об'єктів питань мають невірну структуру або непідтримуваний тип."
          );
        }

        await updateQuestionsInDb(questions as Question[]);

        toast({
          title: "Питання успішно імпортовано!",
          description: `Додано ${questions.length} питань.`,
        });
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Помилка імпорту!",
          description: err?.message ?? "Не вдалося імпортувати JSON.",
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!test?.questions?.length) return;

    const jsonString = JSON.stringify(test.questions, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const safeTitle = (test.title ?? "test")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    a.href = url;
    a.download = `test_${safeTitle}_${testId}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Питання експортовано." });
  };

  // ====== question CRUD in json ======
  const openQuestionModal = (question: Question | null) => {
    if (question) {
      setSelectedQuestion(question);
      questionForm.reset({
        questionText: question.questionText,
        type: question.type,
        points: question.points,
      });
    } else {
      setSelectedQuestion(null);
      questionForm.reset({
        questionText: "",
        type: "single_choice",
        points: 1,
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (data: QuestionFormData) => {
    if (!test) return;

    try {
      const current = Array.isArray(test.questions) ? test.questions : [];
      let updated: Question[];

      if (selectedQuestion) {
        updated = current.map((q) =>
          q.id === selectedQuestion.id ? { ...selectedQuestion, ...data } : q
        );
      } else {
        const newQuestion: Question = {
          id: crypto.randomUUID(),
          questionText: data.questionText,
          type: data.type,
          points: data.points,
          options: data.type.includes("choice") ? [] : undefined,
          matchPrompts: data.type === "matching" ? [] : undefined,
          correctAnswers: [],
        };
        updated = [...current, newQuestion];
      }

      await updateQuestionsInDb(updated);

      toast({
        title: selectedQuestion ? "Питання оновлено" : "Питання додано",
      });
      setIsQuestionModalOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: e?.message ?? "Не вдалося зберегти питання.",
      });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!test) return;

    try {
      const current = Array.isArray(test.questions) ? test.questions : [];
      const updated = current.filter((q) => q.id !== questionId);

      await updateQuestionsInDb(updated);

      toast({ title: "Питання видалено" });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: e?.message ?? "Не вдалося видалити питання.",
      });
    }
  };

  // ====== UI states ======
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center text-destructive">
        Помилка завантаження: {loadError}
      </div>
    );
  }

  if (!test) {
    return (
      <div className="text-center text-muted-foreground">Тест не знайдено.</div>
    );
  }

  const questionsCount = Array.isArray(test.questions)
    ? test.questions.length
    : 0;

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">
        Редагування тесту: <span className="text-primary">{test.title}</span>
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>Основна інформація</CardTitle>
          <CardDescription>
            Тут можна змінити назву, опис та предмет тесту.
          </CardDescription>
        </CardHeader>

        <Form {...testDetailsForm}>
          <form
            onSubmit={testDetailsForm.handleSubmit(handleUpdateTestDetails)}
          >
            <CardContent className="grid md:grid-cols-2 gap-6">
              <FormField
                control={testDetailsForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Назва тесту*</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={testDetailsForm.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Предмет*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={subjectName} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <FormField
                  control={testDetailsForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Опис</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                disabled={testDetailsForm.formState.isSubmitting}
              >
                <Save className="mr-2 h-4 w-4" />
                Зберегти зміни
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Керування питаннями ({questionsCount})</CardTitle>
              <CardDescription>
                Імпортуйте, експортуйте або редагуйте питання вручну.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Імпортувати JSON
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={
                  !test.questions ||
                  (Array.isArray(test.questions) && test.questions.length === 0)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Експортувати JSON
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">ID</TableHead>
                  <TableHead>Текст питання</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Бали</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.isArray(test.questions) && test.questions.length > 0 ? (
                  test.questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">
                        {q.id}
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-sm">
                        {q.questionText}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{q.type}</Badge>
                      </TableCell>
                      <TableCell>{q.points}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openQuestionModal(q)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

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
                                <AlertDialogTitle>
                                  Видалити питання?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Цю дію неможливо скасувати.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteQuestion(q.id)}
                                >
                                  Видалити
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Ще не додано жодного питання. Імпортуйте JSON або додайте
                      вручну.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={() => openQuestionModal(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Додати питання
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestion ? "Редагувати питання" : "Додати нове питання"}
            </DialogTitle>
          </DialogHeader>

          <Form {...questionForm}>
            <form
              onSubmit={questionForm.handleSubmit(handleSaveQuestion)}
              className="space-y-4 py-4"
            >
              <FormField
                control={questionForm.control}
                name="questionText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Текст питання</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={questionForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип питання</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single_choice">
                            Одиночний вибір
                          </SelectItem>
                          <SelectItem value="multiple_choice">
                            Множинний вибір
                          </SelectItem>
                          <SelectItem value="numeric_input">
                            Числова відповідь
                          </SelectItem>
                          <SelectItem value="text_input">
                            Текстова відповідь
                          </SelectItem>
                          <SelectItem value="matching">
                            На відповідність
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={questionForm.control}
                  name="points"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бали</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-sm text-muted-foreground pt-2">
                Примітка: Питання з опціями, зображеннями та типу matching
                наразі керуються через імпорт/експорт JSON.
              </p>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Скасувати
                  </Button>
                </DialogClose>

                <Button
                  type="submit"
                  disabled={questionForm.formState.isSubmitting}
                >
                  {questionForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Зберегти питання
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
