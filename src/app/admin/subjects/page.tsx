"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { Subject } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

const subjectSchema = z.object({
  name: z.string().min(1, { message: "Назва предмета є обов'язковою." }),
  description: z.string().optional(),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const { toast } = useToast();

  const form = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editForm = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
  });

  useEffect(() => {
    const q = query(collection(db, "subjects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subjectsData: Subject[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Subject[];
        setSubjects(subjectsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching subjects:", error);
        toast({
            variant: "destructive",
            title: "Помилка завантаження даних",
            description: "Не вдалося завантажити список предметів.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleAddSubject = async (data: SubjectFormData) => {
    try {
      await addDoc(collection(db, "subjects"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      toast({
        title: "Предмет додано!",
        description: `"${data.name}" успішно створено.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding subject: ", error);
       toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося додати предмет.",
      });
    }
  };

  const openEditModal = (subject: Subject) => {
    setSelectedSubject(subject);
    editForm.reset({
        name: subject.name,
        description: subject.description || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSubject = async (data: SubjectFormData) => {
    if (!selectedSubject) return;
    const subjectRef = doc(db, "subjects", selectedSubject.id);
    try {
      await updateDoc(subjectRef, {
        name: data.name,
        description: data.description,
      });
      toast({
        title: "Предмет оновлено!",
        description: "Зміни успішно збережено.",
      });
      setIsEditModalOpen(false);
      setSelectedSubject(null);
    } catch (error) {
       console.error("Error updating subject: ", error);
       toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося оновити предмет.",
      });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    const subjectRef = doc(db, "subjects", subjectId);
    try {
      await deleteDoc(subjectRef);
       toast({
        title: "Предмет видалено.",
      });
    } catch (error) {
       console.error("Error deleting subject: ", error);
       toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося видалити предмет.",
      });
    }
  };

  const formatDate = (date: Timestamp | Date | undefined) => {
    if (!date) return "N/A";
    const jsDate = date instanceof Timestamp ? date.toDate() : date;
    return format(jsDate, "dd.MM.yyyy");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Додати новий предмет</CardTitle>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubject)}>
              <CardContent className="space-y-4">
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Назва предмета*</FormLabel>
                        <FormControl>
                            <Input placeholder="Напр. Українська мова" {...field} />
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
                            <Textarea placeholder="Короткий опис предмета" {...field} />
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
                  Додати предмет
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Список предметів</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ще не додано жодного предмета.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead className="hidden md:table-cell">Опис</TableHead>
                    <TableHead className="hidden sm:table-cell">Дата створення</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-xs">{subject.description || "-"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDate(subject.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(subject)}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Редагувати</span>
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Видалити</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Ви впевнені?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Цю дію неможливо скасувати. Це назавжди видалить предмет
                                        "{subject.name}".
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSubject(subject.id)}>
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
        
      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати предмет</DialogTitle>
          </DialogHeader>
           <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateSubject)} className="space-y-4 py-4">
                 <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Назва предмета*</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Опис</FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Скасувати</Button>
                    </DialogClose>
                    <Button type="submit" disabled={editForm.formState.isSubmitting}>
                         {editForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Зберегти зміни
                    </Button>
                </DialogFooter>
            </form>
           </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    