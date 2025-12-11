"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import {
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
  updateDocumentNonBlocking,
} from "@/firebase";
import {
  Session,
  Test,
  Subject,
  Question,
  Attempt,
  AttemptAnswer,
  MatchingOption,
} from "@/lib/types";
import { getDemoStudentId } from "@/lib/student";
import { useDebouncedCallback } from "use-debounce";
import Link from "next/link";
import 'katex/dist/katex.min.css';
import { KatexRenderer } from "@/components/shared/KatexRenderer";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ChevronLeft,
  ChevronRight,
  Send,
  Flag,
  CheckCircle2,
} from "lucide-react";
import { SessionTimer } from "@/components/shared/SessionTimer";

type EnrichedTest = Test & { subjectName: string };

type EnrichedQuestion = Question & {
    testId: string;
    subjectId: string;
    testTitle: string;
    localIndex: number;
};


export default function SessionPage({
  params: { sessionId },
}: {
  params: { sessionId: string };
}) {
  const firestore = useFirestore();

  // State Management
  const [studentId] = useState(getDemoStudentId);
  const [tests, setTests] = useState<EnrichedTest[]>([]);
  const [allQuestions, setAllQuestions] = useState<EnrichedQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState<
    Record<string, AttemptAnswer>
  >({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  // Data Fetching
  const sessionRef = useMemoFirebase(
    () => doc(firestore, "sessions", sessionId),
    [firestore, sessionId]
  );
  const { data: session, isLoading: loadingSession } = useDoc<Session>(sessionRef);

  // Fetch tests and subjects when session data is available
  useEffect(() => {
    if (!session || tests.length > 0) return;

    const fetchTestsAndSubjects = async () => {
      if (session.testIds.length === 0) {
        setTests([]);
        return;
      }
      const testsQuery = query(
        collection(firestore, "tests"),
        where("__name__", "in", session.testIds)
      );
      const subjectsQuery = collection(firestore, "subjects");

      const [testsSnapshot, subjectsSnapshot] = await Promise.all([
        getDocs(testsQuery),
        getDocs(subjectsQuery),
      ]);

      const subjectsMap = new Map(
        subjectsSnapshot.docs.map((d) => [d.id, d.data() as Subject])
      );
      const enrichedTests = testsSnapshot.docs.map((d) => {
        const testData = d.data() as Test;
        return {
          id: d.id,
          ...testData,
          subjectName: subjectsMap.get(testData.subjectId)?.name ?? "Невідомо",
        };
      });

      // Keep the order from session.testIds
      enrichedTests.sort((a, b) => session.testIds.indexOf(a.id) - session.testIds.indexOf(b.id));

      const allQuestionsFromTests = enrichedTests.flatMap(t => 
        (t.questions || []).map((q, index) => ({
          ...q,
          testId: t.id,
          subjectId: t.subjectId,
          testTitle: t.title,
          localIndex: index + 1,
        }))
      );

      setAllQuestions(allQuestionsFromTests as EnrichedQuestion[]);
      setTests(enrichedTests);
    };

    fetchTestsAndSubjects();
  }, [session, firestore, tests.length]);

  // Find or create an attempt for this student and session
  useEffect(() => {
    if (!session || !studentId) return;

    const attemptQuery = query(
      collection(firestore, "attempts"),
      where("sessionId", "==", sessionId),
      where("studentId", "==", studentId)
    );

    const findOrCreateAttempt = async () => {
      const existingAttempts = await getDocs(attemptQuery);
      if (!existingAttempts.empty) {
        const existingAttempt = {
          id: existingAttempts.docs[0].id,
          ...existingAttempts.docs[0].data(),
        } as Attempt;
        setAttempt(existingAttempt);
        setCurrentAnswers(existingAttempt.answers || {});
      } else if (session.status === 'active') {
        const attemptsCollection = collection(firestore, "attempts");
        const newAttemptData = {
          sessionId,
          studentId,
          startedAt: serverTimestamp(),
          finishedAt: null,
          status: "in_progress" as const,
          answers: {},
          scoreByTest: {},
          totalScore: 0,
        };
        const newAttemptRef = await addDoc(attemptsCollection, newAttemptData);
        setAttempt({ id: newAttemptRef.id, ...newAttemptData } as Attempt);
      }
      setIsLoading(false);
    };

    findOrCreateAttempt();
  }, [session, studentId, sessionId, firestore]);
  
  // Debounced answer saving
  const debouncedSaveAnswer = useDebouncedCallback(
    (questionId: string, answer: AttemptAnswer) => {
      if (!attempt) return;
      const attemptRef = doc(firestore, "attempts", attempt.id);
      updateDocumentNonBlocking(attemptRef, {
        [`answers.${questionId}`]: answer,
      });
    },
    500
  );

  const handleAnswerChange = (question: Question, value: any) => {
    const questionId = question.id;
    const newAnswers = { ...currentAnswers };
    const enrichedQuestion = question as EnrichedQuestion;
    newAnswers[questionId] = { value, testId: enrichedQuestion.testId, subjectId: enrichedQuestion.subjectId };
    setCurrentAnswers(newAnswers);
    debouncedSaveAnswer(questionId, newAnswers[questionId]);
  };
  
  // Finalize and score the attempt
  const finishAttempt = useCallback(async () => {
      if (!attempt || attempt.status === 'finished' || !allQuestions.length || isFinishing) return;
      setIsFinishing(true);

      let calculatedScore = 0;
      allQuestions.forEach(q => {
          const answer = currentAnswers[q.id];
          if (!answer || answer.value === undefined) return;

          let isCorrect = false;
          if (q.type === 'single_choice' || q.type === 'numeric_input' || q.type === 'text_input') {
              isCorrect = q.correctAnswers.length === 1 && String(answer.value).toLowerCase() === String(q.correctAnswers[0]).toLowerCase();
          } else if (q.type === 'multiple_choice') {
              const studentAnswers = (Array.isArray(answer.value) ? answer.value : []).sort();
              const correctAnswers = [...q.correctAnswers].sort();
              isCorrect = studentAnswers.length === correctAnswers.length && studentAnswers.every((val, index) => val === correctAnswers[index]);
          } else if (q.type === 'matching') {
              const studentMatches = answer.value as Record<string, string>; // { leftId: rightId }
              const correctMatches = q.correctAnswers.map(ca => ca.split(':')).reduce((acc, [left, right]) => ({ ...acc, [left]: right }), {} as Record<string, string>);
              
              let correctCount = 0;
              for (const leftId in studentMatches) {
                  if (correctMatches[leftId] === studentMatches[leftId]) {
                      correctCount++;
                  }
              }
              // For simplicity, grant points if all matches are correct
              if(correctCount === q.correctAnswers.length) {
                isCorrect = true;
              }
          }
          if (isCorrect) {
              calculatedScore += q.points;
          }
      });
      
      const attemptRef = doc(firestore, "attempts", attempt.id);
      await updateDoc(attemptRef, {
          status: 'finished',
          finishedAt: serverTimestamp(),
          totalScore: calculatedScore,
      });

      setAttempt(prev => prev ? { ...prev, status: 'finished', totalScore: calculatedScore } : null);
      setIsFinishing(false);

  }, [attempt, currentAnswers, allQuestions, firestore, isFinishing]);

  // Effect to auto-finish attempt when time is up or session is finished by admin
  useEffect(() => {
    if (session?.status === 'finished' || (session?.endTime && session.endTime.toDate() <= new Date())) {
        finishAttempt();
    }
  }, [session, finishAttempt]);


  const activeQuestion = allQuestions[activeQuestionIndex];
  const unansweredQuestions = allQuestions.length - Object.values(currentAnswers).filter(a => a.value !== undefined && a.value !== '' && a.value?.length !== 0).length;


  // Loading and initial states
  if (isLoading || loadingSession || (session && tests.length === 0 && session.testIds.length > 0)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || (session.status !== 'active' && attempt?.status !== 'finished')) {
      return (
        <div className="flex flex-col h-screen items-center justify-center text-center p-4">
          <h1 className="text-2xl font-bold">Сесію не розпочато або завершено</h1>
          <p className="mt-2 text-muted-foreground">Будь ласка, поверніться до кабінету, щоб перевірити статус.</p>
          <Button asChild className="mt-6">
              <Link href="/student">Повернутись до кабінету</Link>
          </Button>
        </div>
      );
  }

  if (attempt?.status === 'finished') {
     return (
        <div className="flex flex-col h-screen items-center justify-center text-center p-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h1 className="text-2xl font-bold mt-4">Ви вже завершили цю сесію!</h1>
          <p className="mt-2 text-muted-foreground">Ваш результат: {attempt.totalScore} балів.</p>
           <p className="mt-1 text-sm text-muted-foreground">Детальні результати будуть доступні пізніше.</p>
          <Button asChild className="mt-6">
              <Link href="/student">Повернутись до кабінету</Link>
          </Button>
        </div>
      );
  }
  
  if (session.isPaused) {
       return (
        <div className="flex flex-col h-screen items-center justify-center text-center p-4">
            <h1 className="text-2xl font-bold text-destructive">Сесію тимчасово призупинено.</h1>
            <p className="mt-2 text-muted-foreground">Зачекайте, поки вчитель її продовжить. Ваш прогрес збережено.</p>
            <Loader2 className="h-8 w-8 animate-spin mt-8 text-muted-foreground" />
        </div>
      );
  }

  return (
    <div className="flex flex-col h-screen">
       {/* Header */}
        <header className="flex h-16 items-center justify-between border-b px-6 shrink-0">
            <h1 className="text-xl font-semibold truncate" title={session.title}>{session.title}</h1>
            <SessionTimer session={session} />
        </header>

        <div className="flex flex-1 overflow-hidden">
             {/* Left Panel: Question List */}
            <aside className="w-72 border-r overflow-y-auto p-4 flex flex-col">
                {tests.map(test => (
                    <div key={test.id} className="mb-4">
                        <h3 className="font-semibold text-md mb-2">{test.title}</h3>
                        <div className="grid grid-cols-5 gap-2">
                           {allQuestions.filter(q => q.testId === test.id).map(q => {
                               const qIndex = allQuestions.findIndex(aq => aq.id === q.id);
                               const isAnswered = currentAnswers[q.id]?.value !== undefined && currentAnswers[q.id]?.value !== '' && currentAnswers[q.id]?.value?.length !== 0;
                               return (
                                <button
                                key={q.id}
                                onClick={() => setActiveQuestionIndex(qIndex)}
                                className={`flex items-center justify-center h-10 w-10 rounded-md border text-sm font-medium transition-colors ${activeQuestionIndex === qIndex ? 'bg-primary text-primary-foreground' : isAnswered ? 'bg-secondary' : 'hover:bg-accent'}`}
                                >
                                {q.localIndex}
                                </button>
                               )
                           })}
                        </div>
                    </div>
                ))}
            </aside>
            
            {/* Main Panel: Active Question */}
            {activeQuestion ? (
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 overflow-y-auto flex-1">
                        <p className="text-sm text-muted-foreground mb-4">Питання {activeQuestion.localIndex} з {(tests.find(t => t.id === activeQuestion.testId)?.questions || []).length}</p>
                        
                        {activeQuestion.imageUrl && (
                            <div className="mb-4 relative h-64 w-full">
                                <Image src={activeQuestion.imageUrl} alt={`Зображення до питання ${activeQuestion.localIndex}`} layout="fill" objectFit="contain" />
                            </div>
                        )}

                        <div className="prose prose-lg max-w-none mb-6 text-lg">
                           <KatexRenderer content={activeQuestion.questionText} />
                        </div>

                         {activeQuestion.type === 'single_choice' && activeQuestion.options && (
                            <RadioGroup
                                value={currentAnswers[activeQuestion.id]?.value}
                                onValueChange={(value) => handleAnswerChange(activeQuestion, value)}
                                className="space-y-2"
                            >
                                {activeQuestion.options.map(opt => (
                                    <div key={opt.id} className="flex items-center space-x-3">
                                        <RadioGroupItem value={opt.id} id={opt.id} />
                                        <Label htmlFor={opt.id} className="text-base font-normal">
                                            <KatexRenderer content={opt.text} />
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                         )}

                         {activeQuestion.type === 'multiple_choice' && activeQuestion.options && (
                             <div className="space-y-2">
                                {activeQuestion.options.map(opt => {
                                    const currentSelection = (currentAnswers[activeQuestion.id]?.value as string[] | undefined) || [];
                                    return (
                                        <div key={opt.id} className="flex items-center space-x-3">
                                            <Checkbox
                                                id={opt.id}
                                                checked={currentSelection.includes(opt.id)}
                                                onCheckedChange={(checked) => {
                                                    const newSelection = checked
                                                        ? [...currentSelection, opt.id]
                                                        : currentSelection.filter((id: string) => id !== opt.id);
                                                    handleAnswerChange(activeQuestion, newSelection);
                                                }}
                                            />
                                            <Label htmlFor={opt.id} className="text-base font-normal">
                                                <KatexRenderer content={opt.text} />
                                            </Label>
                                        </div>
                                    )
                                })}
                             </div>
                         )}
                         
                         {activeQuestion.type === 'matching' && activeQuestion.matchingOptions && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                               <div className="flex flex-col gap-4">
                                {activeQuestion.matchingOptions.map((opt, index) => (
                                    <div key={opt.id} className="flex items-center gap-4">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary font-bold">{index + 1}</div>
                                        <div className="flex-1"><KatexRenderer content={opt.left} /></div>
                                    </div>
                                ))}
                               </div>
                               <div className="flex flex-col gap-4">
                                {activeQuestion.matchingOptions.map((opt, index) => {
                                    const currentSelection = (currentAnswers[activeQuestion.id]?.value as Record<string, string> | undefined) || {};
                                    const rightOptions = activeQuestion.matchingOptions!.map(o => ({ id: o.id, text: o.right }));
                                    const rightOptionLetters = "АБВГД".split('');

                                    return (
                                        <div key={opt.id} className="flex items-center gap-4">
                                           <div className="font-bold">{index + 1}</div>
                                           <div className="flex-1">
                                             <Select
                                                value={currentSelection[opt.id] || ""}
                                                onValueChange={(value) => {
                                                    const newSelection = {...currentSelection};
                                                    if (value) {
                                                        newSelection[opt.id] = value;
                                                    } else {
                                                        delete newSelection[opt.id];
                                                    }
                                                    handleAnswerChange(activeQuestion, newSelection);
                                                }}
                                             >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {rightOptions.map((rightOpt, rightIndex) => (
                                                        <SelectItem key={rightOpt.id} value={rightOpt.id}>
                                                            <div className="flex gap-2">
                                                                <span>{rightOptionLetters[rightIndex]}</span>
                                                                <KatexRenderer content={rightOpt.text} />
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                             </Select>
                                           </div>
                                        </div>
                                    )
                                })}
                               </div>
                            </div>
                         )}

                          {activeQuestion.type === 'numeric_input' && (
                            <Input
                                type="number"
                                className="max-w-xs"
                                value={currentAnswers[activeQuestion.id]?.value || ''}
                                onChange={(e) => handleAnswerChange(activeQuestion, e.target.value)}
                            />
                         )}

                         {activeQuestion.type === 'text_input' && (
                            <Textarea
                                value={currentAnswers[activeQuestion.id]?.value || ''}
                                onChange={(e) => handleAnswerChange(activeQuestion, e.target.value)}
                                rows={4}
                            />
                         )}

                    </div>
                    {/* Bottom Navigation */}
                    <footer className="h-16 border-t flex items-center justify-between px-6 shrink-0 bg-background">
                         <Button
                            variant="outline"
                            onClick={() => setActiveQuestionIndex(p => Math.max(0, p - 1))}
                            disabled={activeQuestionIndex === 0}
                         >
                            <ChevronLeft className="mr-2 h-4 w-4" /> Попереднє питання
                         </Button>
                         
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                 <Button variant="destructive" disabled={isFinishing}>
                                    {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                    Завершити сесію
                                 </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Завершити сесію?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {unansweredQuestions > 0 
                                     ? `Ви впевнені, що хочете завершити? У вас залишилося ${unansweredQuestions} питань без відповіді.`
                                     : "Ви відповіли на всі питання. Ви впевнені, що хочете завершити сесію?"}
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                <AlertDialogAction onClick={finishAttempt}>Завершити</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        
                         <Button
                            variant="outline"
                            onClick={() => setActiveQuestionIndex(p => Math.min(allQuestions.length - 1, p + 1))}
                            disabled={activeQuestionIndex === allQuestions.length - 1}
                         >
                            Наступне питання <ChevronRight className="ml-2 h-4 w-4" />
                         </Button>
                    </footer>
                </main>
            ) : (
                 <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Питання завантажуються...</p>
                </div>
            )}
        </div>
    </div>
  );
}
