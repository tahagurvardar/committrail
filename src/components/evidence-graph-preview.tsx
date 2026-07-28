/**
 * Static SVG preview of the evidence graph: one verified claim in the middle,
 * five concrete GitHub records around it. Pure presentation — the values match
 * the pulseboard wasm milestone in the demo fixtures.
 */
export function EvidenceGraphPreview({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <div
        role="region"
        aria-label="Evidence graph"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-border bg-card p-2"
      >
        <svg
          viewBox="0 0 640 400"
          role="img"
          aria-labelledby="evidence-graph-title evidence-graph-desc"
          className="h-auto w-full min-w-[560px]"
        >
          <title id="evidence-graph-title">
            Evidence graph for one verified claim
          </title>
          <desc id="evidence-graph-desc">
            The claim “p95 board render latency cut from 1.8 seconds to 420
            milliseconds” connected to five records: pull request 196, commit
            4f21c9a, release v0.5.0, workflow run 588, and the architecture
            decision record adr/0007.
          </desc>

          {/* Edges first, so nodes sit on top of them. */}
          <g className="stroke-rail" strokeWidth="1.5">
            <path d="M320 200 115 63" />
            <path d="M320 200 527 63" />
            <path d="M320 200 543 200" />
            <path d="M320 200 505 337" />
            <path d="M320 200 127 337" />
          </g>

          {/* Claim node */}
          <g>
            <rect
              x="210"
              y="150"
              width="220"
              height="100"
              rx="10"
              className="fill-card stroke-primary"
              strokeWidth="1.25"
            />
            <text
              x="226"
              y="176"
              className="fill-primary font-mono text-[9.5px] uppercase"
              style={{ letterSpacing: "0.12em" }}
            >
              Claim · User verified
            </text>
            <text
              x="226"
              y="199"
              className="fill-foreground text-[13px] font-medium"
            >
              p95 board render latency
            </text>
            <text
              x="226"
              y="217"
              className="fill-foreground font-mono text-[13px]"
            >
              1.8 s → 420 ms
            </text>
            <text x="226" y="237" className="fill-muted-foreground text-[11px]">
              after the Rust wasm diff engine
            </text>
          </g>

          {/* Evidence nodes */}
          <g>
            <rect
              x="40"
              y="36"
              width="150"
              height="54"
              rx="8"
              className="fill-card stroke-border"
            />
            <circle cx="60" cy="63" r="5" className="fill-indigo-500" />
            <text
              x="74"
              y="60"
              className="fill-foreground font-mono text-[12px]"
            >
              PR #196
            </text>
            <text x="74" y="77" className="fill-muted-foreground text-[10.5px]">
              merged Nov 28, 2024
            </text>
          </g>
          <g>
            <rect
              x="452"
              y="36"
              width="150"
              height="54"
              rx="8"
              className="fill-card stroke-border"
            />
            <circle cx="472" cy="63" r="5" className="fill-sky-500" />
            <text
              x="486"
              y="60"
              className="fill-foreground font-mono text-[12px]"
            >
              4f21c9a
            </text>
            <text
              x="486"
              y="77"
              className="fill-muted-foreground text-[10.5px]"
            >
              commit — differ swap
            </text>
          </g>
          <g>
            <rect
              x="468"
              y="173"
              width="150"
              height="54"
              rx="8"
              className="fill-card stroke-border"
            />
            <circle cx="488" cy="200" r="5" className="fill-violet-500" />
            <text
              x="502"
              y="197"
              className="fill-foreground font-mono text-[12px]"
            >
              v0.5.0
            </text>
            <text
              x="502"
              y="214"
              className="fill-muted-foreground text-[10.5px]"
            >
              release — Dec 5, 2024
            </text>
          </g>
          <g>
            <rect
              x="430"
              y="310"
              width="150"
              height="54"
              rx="8"
              className="fill-card stroke-border"
            />
            <circle cx="450" cy="337" r="5" className="fill-emerald-500" />
            <text
              x="464"
              y="334"
              className="fill-foreground font-mono text-[12px]"
            >
              run #588
            </text>
            <text
              x="464"
              y="351"
              className="fill-muted-foreground text-[10.5px]"
            >
              benchmark workflow
            </text>
          </g>
          <g>
            <rect
              x="52"
              y="310"
              width="150"
              height="54"
              rx="8"
              className="fill-card stroke-border"
            />
            <circle cx="72" cy="337" r="5" className="fill-rose-500" />
            <text
              x="86"
              y="334"
              className="fill-foreground font-mono text-[12px]"
            >
              adr/0007-sse.md
            </text>
            <text
              x="86"
              y="351"
              className="fill-muted-foreground text-[10.5px]"
            >
              decision record
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        One verified claim from the synthetic demo, holding on to the five
        records that back it.
      </figcaption>
    </figure>
  );
}
