import SessionPageClient from "./SessionPageClient";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <SessionPageClient sessionId={sessionId} />;
}
