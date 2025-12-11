"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  doc,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { Test, Question, Subject } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
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
import { Loader2, Save, Upload, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Badge } from "@/components/ui/badge";
import { QuestionType } from "@/lib/types";

// Schemas
const testDetailsSchema = z.object({
  title: z.string().min(1, "Назва тесту є обов'язковою."),
  description: z.string().optional(),
  subjectId: z.string().min(1, "Предмет є обов'язковим."),
});
type TestDetailsFormData = z.infer<typeof testDetailsSchema>;

const questionSchema = z.object({
  questionText: z.string().min(1, "Текст питання є обов'язковим."),
  type: z.enum(['single_choice', 'multiple_choice', 'numeric_input', 'text_input', 'matching']),
  points: z.coerce.number().min(0, "Бали мають бути невід'ємним числом."),
});
type QuestionFormData = z.infer<typeof questionSchema>;


export default function EditTestPage({ params }: { params: { testId: string } }) {
  const { testId } = params;
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Data fetching
  const testRef = useMemoFirebase(() => doc(firestore, "tests", testId), [firestore, testId]);
  const { data: test, isLoading: loadingTest, error: testError } = useDoc<Test>(testRef);

  const subjectsCollection = useMemoFirebase(() => collection(firestore, "subjects"), [firestore]);
  const { data: subjects, isLoading: loadingSubjects } = useCollection<Subject>(subjectsCollection);

  const subjectName = useMemo(() => {
    if (!test || !subjects) return "...";
    return subjects.find((s) => s.id === test.subjectId)?.name || "Невідомий предмет";
  }, [test, subjects]);

  // Forms
  const testDetailsForm = useForm<TestDetailsFormData>({
    resolver: zodResolver(testDetailsSchema),
    defaultValues: {
      title: "",
      description: "",
      subjectId: "",
    }
  });

  const questionForm = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
        questionText: '',
        type: 'single_choice',
        points: 1,
    }
  });

  // Populate forms with fetched data
  useEffect(() => {
    if (test) {
      testDetailsForm.reset({
        title: test.title,
        description: test.description || "",
        subjectId: test.subjectId,
      });
    }
  }, [test, testDetailsForm]);

  const handleUpdateTestDetails = async (data: TestDetailsFormData) => {
    if (!testRef) return;
    updateDocumentNonBlocking(testRef, data);
    toast({ title: "Інформацію про тест оновлено." });
  };

  // JSON Import/Export
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!testRef) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error("Не вдалося прочитати файл.");
        const questions = JSON.parse(content);
        
        // Basic validation
        if (!Array.isArray(questions)) throw new Error("JSON має бути масивом.");
        
        const isValid = questions.every(q => {
            if (!q.id || !q.questionText || !q.type || q.points === undefined || !q.correctAnswers) {
                return false;
            }
            if (q.type === 'matching') {
                if (!Array.isArray(q.matchPrompts) || !Array.isArray(q.options) || !Array.isArray(q.correctAnswers)) return false;
                return q.correctAnswers.every((ans: any) => typeof ans === 'object' && ans.promptId && ans.optionId);
            }
            return true;
        });

        if (!isValid) {
          throw new Error("Один або більше об'єктів питань мають невірну структуру.");
        }

        updateDocumentNonBlocking(testRef, { questions });
        toast({ title: "Питання успішно імпортовано!", description: `Додано ${questions.length} питань.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Помилка імпорту!", description: error.message });
      } finally {
        // Reset file input
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!test || !test.questions) return;
    const jsonString = JSON.stringify(test.questions, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = test.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `test_${safeTitle}_${testId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Питання експортовано." });
  };

  // Question Management
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
              questionText: '',
              type: 'single_choice',
              points: 1,
          });
      }
      setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = (data: QuestionFormData) => {
    if (!test || !testRef) return;
    let updatedQuestions: Question[];

    if (selectedQuestion) { // Editing existing
        updatedQuestions = (test.questions || []).map(q => 
            q.id === selectedQuestion.id ? { ...selectedQuestion, ...data } : q
        );
    } else { // Adding new
        const newQuestion: Question = {
            id: crypto.randomUUID(),
            ...data,
            // Provide defaults for fields not in the simple form
            options: data.type.includes('choice') ? [] : undefined,
            matchPrompts: data.type === 'matching' ? [] : undefined,
            correctAnswers: [], 
        };
        updatedQuestions = [...(test.questions || []), newQuestion];
    }
    
    updateDocumentNonBlocking(testRef, { questions: updatedQuestions });
    toast({ title: selectedQuestion ? "Питання оновлено" : "Питання додано" });
    setIsQuestionModalOpen(false);
  };

  const handleDeleteQuestion = (questionId: string) => {
    if(!test || !testRef) return;
    const updatedQuestions = (test.questions || []).filter(q => q.id !== questionId);
    updateDocumentNonBlocking(testRef, { questions: updatedQuestions });
    toast({ title: "Питання видалено" });
  };


  if (loadingTest || loadingSubjects) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (testError) {
    return <div className="text-center text-destructive">Помилка завантаження тесту.</div>;
  }
  if (!test) {
    return <div className="text-center text-muted-foreground">Тест не знайдено.</div>;
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">
        Редагування тесту: <span className="text-primary">{test.title}</span>
      </h2>

      {/* Test Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Основна інформація</CardTitle>
          <CardDescription>Тут можна змінити назву, опис та предмет тесту.</CardDescription>
        </CardHeader>
        <Form {...testDetailsForm}>
          <form onSubmit={testDetailsForm.handleSubmit(handleUpdateTestDetails)}>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <FormField
                    control={testDetailsForm.control}
                    name="title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Назва тесту*</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingSubjects}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                {subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                            <FormControl><Textarea {...field} rows={3} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={testDetailsForm.formState.isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                Зберегти зміни
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Questions Management Card */}
      <Card>
        <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <CardTitle>Керування питаннями ({test.questions?.length || 0})</CardTitle>
                    <CardDescription>Імпортуйте, експортуйте або редагуйте питання вручну.</CardDescription>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />Імпортувати JSON
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                    <Button variant="outline" onClick={handleExport} disabled={!test.questions || test.questions.length === 0}>
                        <Download className="mr-2 h-4 w-4" />Експортувати JSON
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
                        {test.questions && test.questions.length > 0 ? (
                            test.questions.map(q => (
                                <TableRow key={q.id}>
                                    <TableCell className="font-mono text-xs">{q.id}</TableCell>
                                    <TableCell className="font-medium truncate max-w-sm">{q.questionText}</TableCell>
                                    <TableCell><Badge variant="secondary">{q.type}</Badge></TableCell>
                                    <TableCell>{q.points}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openQuestionModal(q)}><Pencil className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Видалити питання?</AlertDialogTitle>
                                                    <AlertDialogDescription>Цю дію неможливо скасувати.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteQuestion(q.id)}>Видалити</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Ще не додано жодного питання. Імпортуйте JSON або додайте вручну.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter>
            <Button onClick={() => openQuestionModal(null)}>
                <Plus className="mr-2 h-4 w-4" />Додати питання
            </Button>
        </CardFooter>
      </Card>
      
      {/* Question Edit/Add Modal */}
      <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedQuestion ? "Редагувати питання" : "Додати нове питання"}</DialogTitle>
          </DialogHeader>
          <Form {...questionForm}>
            <form onSubmit={questionForm.handleSubmit(handleSaveQuestion)} className="space-y-4 py-4">
                <FormField
                    control={questionForm.control}
                    name="questionText"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Текст питання</FormLabel>
                            <FormControl><Textarea {...field} rows={4} /></FormControl>
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
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="single_choice">Одиночний вибір</SelectItem>
                                        <SelectItem value="multiple_choice">Множинний вибір</SelectItem>
                                        <SelectItem value="numeric_input">Числова відповідь</SelectItem>
                                        <SelectItem value="text_input">Текстова відповідь</SelectItem>
                                        <SelectItem value="matching">На відповідність</SelectItem>
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
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <p className="text-sm text-muted-foreground pt-2">
                    Примітка: Опції, правильні відповіді та зображення для питань керуються через імпорт/експорт файлів JSON.
                 </p>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Скасувати</Button></DialogClose>
                    <Button type="submit" disabled={questionForm.formState.isSubmitting}>
                         {questionForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
