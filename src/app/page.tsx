import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, Shield } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl font-headline">
          НМТ Demo
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          Оберіть свою роль для входу в систему. Це демонстраційний режим без реальної автентифікації.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          <Card className="text-left flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Shield className="w-10 h-10 text-primary" />
                <CardTitle className="text-2xl font-headline">Адміністратор</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>
                Керуйте предметами, тестами та сесіями НМТ. Цей розділ призначений для умовних адміністраторів.
              </CardDescription>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin">
                  Увійти як адмін (демо)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="text-left flex flex-col">
            <CardHeader>
               <div className="flex items-center gap-4">
                <User className="w-10 h-10 text-primary" />
                <CardTitle className="text-2xl font-headline">Студент</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>
                Проходьте тренувальні тести НМТ, переглядайте активні та завершені сесії у вашому кабінеті.
              </CardDescription>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/student">
                  Увійти як студент (демо)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
