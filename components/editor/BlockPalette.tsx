"use client";

import { BLOCK_CATALOG, CATEGORY_META } from "@/lib/blocks/catalog";
import type { BlockCategory } from "@/lib/blocks/types";
import { useEditorStore } from "@/lib/store/editor";
import { Icon } from "./Icon";

const ORDER: BlockCategory[] = [
  "trigger",
  "wallet",
  "payment",
  "asset",
  "contract",
  "automation",
  "output",
];

/**
 * Left-hand palette. Blocks are draggable (HTML5 DnD -> canvas) and also
 * clickable to drop into the viewport center as a fallback.
 */
export function BlockPalette() {
  const addBlock = useEditorStore((s) => s.addBlock);

  return (
    <aside
      data-guide="palette"
      className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-off"
    >
      <div className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted">
        Blocks
      </div>
      {ORDER.map((cat) => {
        const blocks = BLOCK_CATALOG.filter((b) => b.category === cat);
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat} className="px-2 pb-2">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
              <span className="text-[11px] font-medium text-muted">{meta.label}</span>
            </div>
            {blocks.map((b) => (
              <button
                key={b.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/soroban-block", b.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => addBlock(b.type, { x: 380, y: 120 })}
                className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white"
                title={b.description}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `${meta.dot}14`, color: meta.dot }}
                >
                  <Icon name={b.icon} size={13} strokeWidth={2} />
                </span>
                <span className="truncate text-[13px] text-ink">{b.label}</span>
              </button>
            ))}
          </div>
        );
      })}
    </aside>
  );
}
