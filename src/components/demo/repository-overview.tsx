import { Panel } from "@/components/demo/panel";
import { EvidenceTypeBadge } from "@/components/evidence-type-badge";
import type {
  DemoRepository,
  EvidenceInventory,
  EvidenceType,
} from "@/lib/demo/types";
import { formatCount, formatDate } from "@/lib/format";
import { inventoryTotal } from "@/lib/demo/derive";

const INVENTORY_ROWS: Array<{
  type: EvidenceType;
  key: keyof EvidenceInventory;
}> = [
  { type: "commit", key: "commits" },
  { type: "pull-request", key: "pullRequests" },
  { type: "issue", key: "issues" },
  { type: "release", key: "releases" },
  { type: "workflow-run", key: "workflowRuns" },
  { type: "file", key: "files" },
  { type: "doc-section", key: "docSections" },
];

export function RepositoryOverview({ repo }: { repo: DemoRepository }) {
  return (
    <Panel
      title="Repository overview"
      description={`${repo.name} · default branch ${repo.defaultBranch} · active ${formatDate(repo.activeFrom)} – ${formatDate(repo.activeTo)}`}
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        {repo.description}
      </p>
      <h4 className="mt-5 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        Evidence inventory · {formatCount(inventoryTotal(repo.inventory))}{" "}
        records
      </h4>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 lg:grid-cols-3">
        {INVENTORY_ROWS.map((row) => (
          <li
            key={row.type}
            className="flex items-center justify-between gap-2"
          >
            <EvidenceTypeBadge type={row.type} />
            <span className="font-mono text-sm tabular-nums">
              {formatCount(repo.inventory[row.key])}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
