"use client";

import { useState } from "react";
import { LayoutTemplate, Search, X, Import } from "lucide-react";
import { TEMPLATES, templateToWorkflow, type Template } from "@/lib/templates";
import { useEditorStore } from "@/lib/store/editor";
import { Backdrop } from "./Backdrop";

export function TemplateLibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadWorkflow = useEditorStore((s) => s.loadWorkflow);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  if (!open) return null;

  const allTags = Array.from(new Set(TEMPLATES.flatMap((t) => t.tags))).sort();

  const filteredTemplates = TEMPLATES.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag ? t.tags.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  function handleImport(template: Template) {
    loadWorkflow(templateToWorkflow(template));
    setProjectId(null); // start as a new project
    onClose();
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <LayoutTemplate size={20} className="text-accent" /> Template Library
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-4 border-b border-border bg-off p-5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-[13.5px] outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                selectedTag === null ? "border-accent bg-accent-light text-accent" : "border-border text-muted hover:text-ink"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  selectedTag === tag ? "border-accent bg-accent-light text-accent" : "border-border text-muted hover:text-ink"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-[13.5px] text-muted">
              No templates found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-white p-5 transition-colors hover:border-accent"
                >
                  <div>
                    <h3 className="mb-1.5 text-[14.5px] font-semibold text-ink">{template.name}</h3>
                    <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
                      {template.description}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-off px-1.5 py-0.5 text-[10.5px] font-medium text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => handleImport(template)}
                      className="btn-outline flex w-full items-center justify-center gap-1.5 group-hover:bg-accent group-hover:text-white group-hover:border-accent"
                    >
                      <Import size={14} /> Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}
