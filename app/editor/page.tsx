import { EditorApp } from "@/components/editor/EditorApp";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  await requireUser("/editor");
  return <EditorApp />;
}
