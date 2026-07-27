"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { MoonIcon, SunIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/**
 * True only after hydration on the client. The theme is unknown during SSR,
 * so the toggle renders a neutral label first and the real state after mount.
 */
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const isDark = hydrated && resolvedTheme === "dark";
  const label = hydrated
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {isDark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </button>
  );
}
