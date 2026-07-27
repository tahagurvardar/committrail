import type { ComponentType, SVGProps } from "react";

import {
  CheckCircleIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldIcon,
} from "@/components/icons";
import { TRUST_PRINCIPLES } from "@/lib/trust-principles";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const PRINCIPLE_ICONS: Record<string, IconComponent> = {
  "read-only": ShieldIcon,
  "evidence-first": DatabaseIcon,
  "user-approval": CheckCircleIcon,
  "no-ranking": LayersIcon,
  "no-execution": ShieldIcon,
};

/**
 * Numbered ledger list of the product's trust principles.
 * Shared by the landing page and the about page so the commitments never drift.
 */
export function TrustPrinciplesList({ className }: { className?: string }) {
  return (
    <ol
      className={cn("divide-y divide-border border-y border-border", className)}
    >
      {TRUST_PRINCIPLES.map((principle, index) => {
        const Icon = PRINCIPLE_ICONS[principle.id] ?? ShieldIcon;
        return (
          <li
            key={principle.id}
            className="grid gap-2 py-5 sm:grid-cols-[5rem_1fr] sm:gap-6"
          >
            <p className="font-mono text-xs text-muted-foreground tabular-nums sm:pt-1">
              {String(index + 1).padStart(2, "0")}
            </p>
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-primary" />
                {principle.title}
              </p>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {principle.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
