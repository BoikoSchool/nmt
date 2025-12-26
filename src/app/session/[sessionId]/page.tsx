// src/app/session/[sessionId]/page.tsx
import SessionPageClient from "./SessionPageClient";

interface PageProps {
  params: Promise<{ sessionId: string }>; // ✅ params тепер Promise
}

export default async function Page({ params }: PageProps) {
  // ✅ async
  const { sessionId } = await params; // ✅ await params

  return <SessionPageClient sessionId={sessionId} />;
}
