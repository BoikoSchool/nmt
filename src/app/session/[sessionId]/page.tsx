// src/app/session/[sessionId]/page.tsx
import { use } from "react";
import SessionPageClient from "./SessionPageClient";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function Page({ params }: PageProps) {
  const { sessionId } = use(params);

  return <SessionPageClient sessionId={sessionId} />;
}
