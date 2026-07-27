import { safeGitHubSourceUrl } from "@/lib/evidence/safe-source-url";

interface GraphEvidence {
  id: string;
  title: string;
  evidenceType: string;
  canonicalUrl: string;
}

export function ClaimEvidenceGraph({
  statement,
  evidence,
}: {
  statement: string;
  evidence: GraphEvidence[];
}) {
  const height = Math.max(180, evidence.length * 72 + 48);
  return (
    <figure className="overflow-hidden rounded-xl border bg-card p-4">
      <figcaption className="font-semibold">Claim-to-evidence graph</figcaption>
      <svg
        className="mt-4 h-auto w-full"
        viewBox={`0 0 760 ${height}`}
        role="img"
        aria-labelledby="claim-graph-title claim-graph-description"
      >
        <title id="claim-graph-title">Claim and linked evidence</title>
        <desc id="claim-graph-description">
          One human-authored claim connected to {evidence.length} GitHub fact
          {evidence.length === 1 ? "" : "s"}. A complete text list follows.
        </desc>
        <rect
          x="20"
          y={height / 2 - 35}
          width="270"
          height="70"
          rx="12"
          className="fill-accent stroke-primary"
        />
        <text
          x="36"
          y={height / 2 - 6}
          className="fill-foreground text-sm font-semibold"
        >
          Human-authored claim
        </text>
        <text
          x="36"
          y={height / 2 + 17}
          className="fill-muted-foreground text-xs"
        >
          {statement.slice(0, 38)}
          {statement.length > 38 ? "…" : ""}
        </text>
        {evidence.map((item, index) => {
          const y = 30 + index * 72;
          return (
            <g key={item.id}>
              <line
                x1="290"
                y1={height / 2}
                x2="455"
                y2={y + 25}
                className="stroke-rail"
                strokeWidth="2"
              />
              <text
                x="350"
                y={(height / 2 + y + 25) / 2 - 5}
                className="fill-muted-foreground text-[10px]"
              >
                supported by
              </text>
              <rect
                x="455"
                y={y}
                width="280"
                height="50"
                rx="10"
                className="fill-card stroke-border"
              />
              <text
                x="470"
                y={y + 21}
                className="fill-primary text-xs font-semibold"
              >
                {item.evidenceType} · Fact
              </text>
              <text x="470" y={y + 38} className="fill-foreground text-[11px]">
                {item.title.slice(0, 42)}
                {item.title.length > 42 ? "…" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 border-t pt-4">
        <p className="text-sm font-medium">Text equivalent</p>
        {evidence.length ? (
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {evidence.map((item) => {
              const url = safeGitHubSourceUrl(item.canonicalUrl);
              return (
                <li key={item.id}>
                  The claim is supported by the {item.evidenceType} fact{" "}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                  .
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No evidence is linked.
          </p>
        )}
      </div>
    </figure>
  );
}
