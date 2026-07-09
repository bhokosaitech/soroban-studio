"use client";

import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useEditorStore } from "@/lib/store/editor";
import { runSandbox, type RunLog } from "@/lib/soroban/sandbox";
import { extractNodeSecrets, validateWorkflow } from "@/lib/workflow";
import { getTemplate, templateToWorkflow } from "@/lib/templates";
import { isBackendUnavailable, runWorkflowLive } from "@/lib/api";
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
import { useVaultStore } from "@/lib/vault/store";

export function EditorApp() {
  const toWorkflow = useEditorStore((s) => s.toWorkflow);
  const loadWorkflow = useEditorStore((s) => s.loadWorkflow);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | undefined>();

  // Seed from query params: ?template=<id> (dashboard) or ?prompt=... (landing).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("template");
    const template = id ? getTemplate(id) : undefined;
    if (template) loadWorkflow(templateToWorkflow(template));

    const prompt = params.get("prompt");
    if (prompt) {
      setAiPrompt(prompt);
      setShowAI(true);
    }
  }, [loadWorkflow]);

  const [showExport, setShowExport] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
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
      // Real execution against Stellar testnet via the backend, streamed live.
      await runWorkflowLive(wf, append, { signers, nodeSecrets });
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
          onAI={() => setShowAI(true)}
          onVault={() => setShowVault(true)}
          onSchedule={() => setShowSchedule(true)}
          running={running}
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
      <Guide />
    </ReactFlowProvider>
  );
}
