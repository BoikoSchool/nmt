import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { UserProfile } from "@/components/auth/UserProfile";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard role="admin">
      <div className="min-h-screen w-full">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          <nav className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon" className="h-8 w-8">
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Назад на адмін-панель</span>
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Адмін-панель</h1>
          </nav>
          <UserProfile />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
