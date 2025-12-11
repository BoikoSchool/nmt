import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, FileText, ClipboardList } from 'lucide-react';

export default function AdminDashboard() {
  const adminLinks = [
    {
      href: '/admin/subjects',
      title: 'Предмети',
      description: 'Керування списком навчальних предметів.',
      icon: <BookOpen className="w-8 h-8 text-accent" />,
    },
    {
      href: '/admin/tests',
      title: 'Тести',
      description: 'Створення та редагування тестових завдань.',
      icon: <FileText className="w-8 h-8 text-accent" />,
    },
    {
      href: '/admin/sessions',
      title: 'Сесії НМТ',
      description: 'Призначення та моніторинг тестових сесій.',
      icon: <ClipboardList className="w-8 h-8 text-accent" />,
    },
  ];

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Вітаємо, Адміністраторе!</h2>
        <p className="text-muted-foreground">
          Це демонстраційна адмін-панель. Ви можете переходити до відповідних розділів для керування.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Card key={link.href} className="flex flex-col">
            <CardHeader className="flex flex-row items-start gap-4 pb-2">
              {link.icon}
              <CardTitle className="pt-1">{link.title}</CardTitle>
            </CardHeader>
            <CardDescription className="px-6 pb-4 flex-grow">
              {link.description}
            </CardDescription>
            <CardFooter>
              <Button asChild variant="ghost" className="w-full justify-start text-sm">
                <Link href={link.href}>
                  Перейти до розділу <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
