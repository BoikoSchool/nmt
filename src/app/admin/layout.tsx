import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
        <nav className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon" className="h-8 w-8">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Назад на адмін-панель</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Адмін-панель</h1>
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
