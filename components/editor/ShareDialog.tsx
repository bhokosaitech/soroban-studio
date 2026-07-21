"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe, Link2, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import {
  createProjectShare,
  getProjectShare,
  saveProject,
  updateProjectShare,
  type ShareInfo,
  type ShareMode,
} from "@/lib/api";
import { extractNodeSecrets } from "@/lib/workflow";
import { Backdrop } from "./Backdrop";

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projectId = useEditorStore((s) => s.projectId);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const toWorkflow = useEditorStore((s) => s.toWorkflow);

  const [share, setShare] = useState<ShareInfo | null>(null);
  const [mode, setMode] = useState<ShareMode>("readonly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the project's existing share (if any) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCopied(false);
    if (!projectId) {
      setShare(null);
      return;
    }
    setLoading(true);
    getProjectShare(projectId)
      .then((s) => {
        setShare(s);
        if (s) setMode(s.mode);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load share status."))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  if (!open) return null;

  async function ensureProjectId(): Promise<string> {
    if (projectId) return projectId;
    const { workflow } = extractNodeSecrets(toWorkflow());
    const saved = await saveProject(workflow, null);
    setProjectId(saved.id);
    return saved.id;
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const id = await ensureProjectId();
      const s = await createProjectShare(id, mode);
      setShare(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create share link.");
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(next: ShareMode) {
    setMode(next);
    if (!share || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      setShare(await updateProjectShare(projectId, { mode: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update share link.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!share || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      await updateProjectShare(projectId, { revoked: true });
      setShare(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke share link.");
    } finally {
      setLoading(false);
    }
  }

  const url = share ? `${window.location.origin}/share/${share.slug}` : "";

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Globe size={16} className="text-accent" /> Share workflow
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <ModeOption
            active={mode === "readonly"}
            title="Read-only"
            description="Anyone with the link can view the workflow, but not edit or fork it."
            onSelect={() => (share ? changeMode("readonly") : setMode("readonly"))}
          />
          <ModeOption
            active={mode === "fork"}
            title="Forkable"
            description="Anyone with the link can view it and fork their own editable copy."
            onSelect={() => (share ? changeMode("fork") : setMode("fork"))}
          />
        </div>

        {share ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-off px-3 py-2">
              <Link2 size={14} className="shrink-0 text-muted" />
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate bg-transparent text-[12.5px] text-ink outline-none"
              />
              <button onClick={copy} className="btn-ghost flex shrink-0 items-center gap-1.5 !px-2 !py-1">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {share.authorName && (
              <p className="text-[11.5px] text-muted">Shared as {share.authorName}</p>
            )}
            <button
              onClick={revoke}
              disabled={loading}
              className="text-[12.5px] font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Revoke link
            </button>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            className="btn-dark flex w-full items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Generate link
          </button>
        )}

        {error && <p className="mt-3 text-[12.5px] text-red-600">{error}</p>}
      </div>
    </Backdrop>
  );
}

function ModeOption({
  active,
  title,
  description,
  onSelect,
}: {
  active: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active ? "border-accent bg-accent-light" : "border-border hover:bg-off"
      }`}
    >
      <div className="text-[13px] font-medium text-ink">{title}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{description}</div>
    </button>
  );
}
