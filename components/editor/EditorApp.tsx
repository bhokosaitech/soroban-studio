"use client";

import { useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useEditorStore } from "@/lib/store/editor";
import { runSandbox, type RunLog } from "@/lib/soroban/sandbox";
import { deserializeWorkflow, emptyWorkflow, extractNodeSecrets, validateWorkflow } from "@/lib/workflow";
import { getTemplate, templateToWorkflow } from "@/lib/templates";
import { isBackendUnavailable, runWorkflowLive, fetchProject } from "@/lib/api";
import { Toolbar } from "./Toolbar";
import { BlockPalette } from "./BlockPalette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { RunConsole } from "./RunConsole";
import { AIBuilder } from "./AIBuilder";
import { ExportDialog } from "./ExportDialog";
import { Guide } from "./Guide";
import { WalletVault } from "./WalletVault";
import { ScheduleDialog } from "./ScheduleDialog";
import { ShareDialog } from "./ShareDialog";
import { TemplateLibraryDialog } from "./TemplateLibraryDialog";
import { useVaultStore } from "@/lib/vault/store";
import { useAutoSave } from "./useAutoSave";

export function EditorApp() {
  const toWorkflow = useEditorStore((s) => s.toWorkflow);
  const loadWorkflow = useEditorStore((s) => s.loadWorkflow);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | undefined>();
  const saveStatus = useAutoSave();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Import a workflow from a `.json` file exported by Soroban Studio. Loads it
  // onto the canvas as a NEW workflow (clears the current project id so it saves
  // as a fresh project rather than overwriting the open one).
  async function importFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const wf = deserializeWorkflow(JSON.parse(text));
      loadWorkflow(wf);
      setProjectId(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  // Seed from query params: ?project=<id> (saved project), ?template=<id>
  // (dashboard) or ?prompt=... (landing).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const projectId = params.get("project");
    if (projectId) {
      fetchProject(projectId)
        .then((p) => {
          loadWorkflow(p.workflow);
          setProjectId(p.id);
        })
        .catch(() => {
          /* project missing or not owned — start blank */
        });
    } else {
      const id = params.get("template");
      const template = id ? getTemplate(id) : undefined;
      if (template) {
        loadWorkflow(templateToWorkflow(template));
      } else {
        // Fresh editor: reset any state the module-level store held from a
        // previously opened project so a new workflow starts clean.
        loadWorkflow(emptyWorkflow());
      }
      setProjectId(null);
    }

    const prompt = params.get("prompt");
    if (prompt) {
      setAiPrompt(prompt);
      setShowAI(true);
    }
  }, [loadWorkflow, setProjectId]);

  const [showExport, setShowExport] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function run() {
    // Strip external private keys out of the workflow before it's sent/saved;
    // they travel separately as ephemeral per-run secrets.
    const { workflow: wf, nodeSecrets } = extractNodeSecrets(toWorkflow());
    const problems = validateWorkflow(wf);
    setConsoleOpen(true);
    setLogs([]);
    setRunning(true);

    if (problems.length) {
      setLogs(
        problems.map((p) => ({
          nodeId: "validation",
          blockType: "validation",
          level: "error" as const,
          message: `⚠ ${p}`,
          at: Date.now(),
        }))
      );
      setRunning(false);
      return;
    }

    const append = (log: RunLog) => setLogs((prev) => [...prev, log]);

    // Collect signers for any saved (vault) wallets referenced in the workflow.
    const savedPks = wf.nodes
      .filter((n) => n.type === "use-wallet" || n.type === "connect-wallet")
      .map((n) => n.data.publicKey)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    let signers: Record<string, string> | undefined;
    if (savedPks.length) {
      const vault = useVaultStore.getState();
      if (!vault.unlocked) {
        append({
          nodeId: "runtime",
          blockType: "runtime",
          level: "error",
          message: "This workflow uses a saved wallet — unlock your Wallet vault (top bar) before running.",
          at: Date.now(),
        });
        setShowVault(true);
        setRunning(false);
        return;
      }
      signers = await vault.getSigners(savedPks);
    }

    try {
      // Real execution against Stellar via the backend, streamed live. Wallets
      // created mid-run arrive over a dedicated channel: we show the keypair in
      // the console and auto-save it to the client vault (the backend keeps no
      // private keys).
      const onWallet = (w: {
        publicKey: string;
        secret: string;
        network: string;
        label: string;
      }) => {
        append({
          nodeId: "runtime",
          blockType: "runtime",
          level: "success",
          message: `🔑 New wallet — public: ${w.publicKey}`,
          at: Date.now(),
        });
        append({
          nodeId: "runtime",
          blockType: "runtime",
          level: "warn",
          message: `🔒 Secret key (store it now, shown once): ${w.secret}`,
          at: Date.now(),
        });
        const vault = useVaultStore.getState();
        if (vault.unlocked) {
          void vault
            .addWallet({ publicKey: w.publicKey, label: w.label, network: w.network, secret: w.secret })
            .then(() =>
              append({
                nodeId: "runtime",
                blockType: "runtime",
                level: "info",
                message: `Saved ${w.publicKey.slice(0, 6)}…${w.publicKey.slice(-4)} to your wallet vault.`,
                at: Date.now(),
              })
            )
            .catch(() => {});
        } else {
          append({
            nodeId: "runtime",
            blockType: "runtime",
            level: "warn",
            message: "Unlock your wallet vault (top bar) to save this wallet — otherwise copy the secret above now.",
            at: Date.now(),
          });
        }
      };
      await runWorkflowLive(wf, append, { signers, nodeSecrets }, onWallet);
    } catch (e) {
      if (isBackendUnavailable(e)) {
        append({
          nodeId: "runtime",
          blockType: "runtime",
          level: "warn",
          message:
            "Execution API not reachable — the database or Stellar network may be down. Showing a local simulation instead.",
          at: Date.now(),
        });
        await runSandbox(wf, append);
      } else {
        append({
          nodeId: "runtime",
          blockType: "runtime",
          level: "error",
          message: (e as Error).message ?? "Run failed.",
          at: Date.now(),
        });
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <Toolbar
          onRun={run}
          onExport={() => setShowExport(true)}
          onImport={() => fileInputRef.current?.click()}
          onTemplates={() => setShowTemplates(true)}
          onAI={() => setShowAI((v) => !v)}
          onVault={() => setShowVault(true)}
          onSchedule={() => setShowSchedule(true)}
          onShare={() => setShowShare(true)}
          running={running}
          aiOpen={showAI}
          saveStatus={saveStatus}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = ""; // allow re-importing the same file
          }}
        />
        <div className="flex min-h-0 flex-1">
          <BlockPalette />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <Canvas />
            </div>
            {consoleOpen && (
              <RunConsole logs={logs} running={running} onClose={() => setConsoleOpen(false)} />
            )}
          </div>
          <Inspector />
        </div>
      </div>

      <AIBuilder open={showAI} onClose={() => setShowAI(false)} initialPrompt={aiPrompt} />
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <WalletVault open={showVault} onClose={() => setShowVault(false)} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} />
      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />
      <TemplateLibraryDialog open={showTemplates} onClose={() => setShowTemplates(false)} />
      <Guide hidden={showAI} />

      {importError && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-[13px] text-red-600 shadow-lg">
          Import failed: {importError}
          <button onClick={() => setImportError(null)} className="ml-3 text-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}
    </ReactFlowProvider>
  );
}
