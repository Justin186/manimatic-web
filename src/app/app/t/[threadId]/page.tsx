import { Workbench } from "@/components/workbench/Workbench";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <Workbench threadId={threadId} />;
}
