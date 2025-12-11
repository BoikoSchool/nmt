import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayCircle, CheckCircle2 } from "lucide-react";

export default function StudentDashboard() {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Ласкаво просимо!</h2>
        <p className="text-muted-foreground">
          Це ваш особистий кабінет для тренування. Переглядайте доступні сесії та історію проходження.
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="active">
            <PlayCircle className="mr-2 h-4 w-4" />
            Активні сесії
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Пройдені сесії
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground p-8">
                <p className="font-medium text-lg">Наразі немає активних сесій.</p>
                <p className="text-sm mt-2">Коли адміністратор призначить вам тест, він з'явиться тут.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="completed">
          <Card>
            <CardContent className="pt-6">
               <div className="text-center text-muted-foreground p-8">
                <p className="font-medium text-lg">Ви ще не завершили жодної сесії.</p>
                <p className="text-sm mt-2">Результати пройдених тестів будуть відображатися тут.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
