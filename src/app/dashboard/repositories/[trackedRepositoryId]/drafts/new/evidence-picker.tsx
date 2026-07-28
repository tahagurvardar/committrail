"use client";

import { useState } from "react";

export interface DraftEvidencePickerItem {
  id: string;
  title: string;
  evidenceType: string;
  occurredAtLabel: string;
  estimatedBytes: number;
}

export function DraftEvidencePicker({
  evidence,
  maximumCount,
  canQueue,
}: {
  evidence: DraftEvidencePickerItem[];
  maximumCount: number;
  canQueue: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = new Set(selectedIds);
  const estimatedBytes = evidence.reduce(
    (total, item) => total + (selected.has(item.id) ? item.estimatedBytes : 0),
    0,
  );

  return (
    <>
      <p
        aria-live="polite"
        className="mt-3 text-sm"
        id="evidence-selection-summary"
      >
        Selected {selected.size}/{maximumCount} facts · approximately{" "}
        {estimatedBytes.toLocaleString("en-US")} normalized fact bytes. The
        server computes and enforces the exact canonical bundle size.
      </p>
      <div className="mt-4 grid gap-3">
        {evidence.map((item) => {
          const checked = selected.has(item.id);
          return (
            <label
              key={item.id}
              className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-4"
            >
              <input
                aria-describedby="evidence-selection-summary"
                checked={checked}
                className="mt-1"
                disabled={!checked && selected.size >= maximumCount}
                name="evidenceId"
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
                type="checkbox"
                value={item.id}
              />
              <span className="min-w-0 text-sm">
                <strong className="block break-words">{item.title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.evidenceType} · {item.occurredAtLabel} ·{" "}
                  {item.estimatedBytes.toLocaleString("en-US")} stored fact
                  bytes
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <button
        aria-describedby="evidence-selection-summary"
        className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canQueue || selected.size === 0}
      >
        Queue private grounded draft
      </button>
    </>
  );
}
