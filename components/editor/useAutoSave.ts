"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor";
import { extractNodeSecrets } from "@/lib/workflow";
import { saveProject } from "@/lib/api";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced auto-save: whenever the workflow changes, persist it (creating the
 * project row on first save, updating it thereafter). External private keys are
 * stripped before saving — secrets never touch the database, matching the vault
 * policy. Returns the current save status for the toolbar to display.
 */
export function useAutoSave(): SaveStatus {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const meta = useEditorStore((s) => s.meta);
  const projectId = useEditorStore((s) => s.projectId);
  const setProjectId = useEditorStore((s) => s.setProjectId);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { workflow } = extractNodeSecrets(useEditorStore.getState().toWorkflow());
    // Nothing worth persisting yet: no project row and an empty canvas.
    if (!projectId && workflow.nodes.length === 0) return;

    const serialized = JSON.stringify(workflow);
    if (serialized === lastSaved.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        const saved = await saveProject(workflow, projectId);
        lastSaved.current = serialized;
        if (!projectId) {
          setProjectId(saved.id);
          // Reflect the new id in the URL so a refresh reopens the same project.
          const url = new URL(window.location.href);
          url.searchParams.set("project", saved.id);
          window.history.replaceState(null, "", url.toString());
        }
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nodes, edges, meta, projectId, setProjectId]);

  return status;
}
