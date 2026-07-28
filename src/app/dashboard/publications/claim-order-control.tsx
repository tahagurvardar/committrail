"use client";

export function ClaimOrderControl({ inputId }: { inputId: string }) {
  function move(delta: number) {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return;
    const current = Number.parseInt(input.value || "0", 10);
    input.value = String(Math.max(0, current + delta));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        onClick={() => move(-1)}
        className="rounded border px-2 py-1 text-xs"
        aria-label="Move claim up"
      >
        Move up
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        className="rounded border px-2 py-1 text-xs"
        aria-label="Move claim down"
      >
        Move down
      </button>
    </span>
  );
}
