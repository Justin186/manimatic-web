import { RequireAuth } from "@/components/auth/RequireAuth";
import { Workbench } from "@/components/workbench/Workbench";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <RequireAuth>
      <Workbench threadId={threadId} />
    </RequireAuth>
  );
}
