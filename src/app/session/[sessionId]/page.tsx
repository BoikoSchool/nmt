// src/app/session/[sessionId]/page.tsx
import SessionPageClient from "./SessionPageClient";

interface PageProps {
  params: { sessionId: string };
}

export default function Page({ params }: PageProps) {
  const { sessionId } = params;

  return <SessionPageClient sessionId={sessionId} />;
}
