import type {
  DemoDeveloper,
  DemoRepository,
  Milestone,
} from "@/lib/demo/types";

/**
 * Deterministic synthetic fixtures for the Phase 0 demo.
 *
 * Everything here is fictional: the developer, the repositories, every count
 * and date. The values are hand-written constants (no randomness, no clocks)
 * so the demo renders identically on every machine and in every test run.
 */

export const demoDeveloper: DemoDeveloper = {
  name: "Riley Okafor",
  handle: "riley-demo",
  role: "Senior product engineer",
  focus: "Realtime systems, query engines, and developer tooling",
};

export const demoRepositories: DemoRepository[] = [
  {
    id: "pulseboard",
    name: "pulseboard",
    description:
      "Realtime incident dashboard for on-call teams. TypeScript and React, with a Rust diff engine compiled to WebAssembly.",
    defaultBranch: "main",
    activeFrom: "2024-03-04",
    activeTo: "2025-06-20",
    inventory: {
      commits: 412,
      pullRequests: 96,
      issues: 58,
      releases: 8,
      workflowRuns: 630,
      files: 12,
      docSections: 6,
    },
    languages: [
      { period: "2024 Q2", shares: { TypeScript: 92, CSS: 8 } },
      { period: "2024 Q3", shares: { TypeScript: 84, CSS: 8, Rust: 8 } },
      { period: "2024 Q4", shares: { TypeScript: 76, CSS: 7, Rust: 17 } },
      { period: "2025 Q1", shares: { TypeScript: 72, CSS: 6, Rust: 22 } },
      { period: "2025 Q2", shares: { TypeScript: 70, CSS: 6, Rust: 24 } },
    ],
    releases: [
      {
        version: "v0.4.0",
        date: "2024-09-18",
        title: "Streaming timeline view",
      },
      { version: "v0.5.0", date: "2024-12-05", title: "Rust wasm diff engine" },
      { version: "v1.0.0", date: "2025-03-11", title: "First stable release" },
      { version: "v1.1.0", date: "2025-05-27", title: "Alert routing rules" },
    ],
    pullRequests: [
      {
        number: 241,
        title: "Route alerts by service ownership",
        mergedOn: "2025-05-20",
      },
      {
        number: 233,
        title: "Apply backpressure to the event stream",
        mergedOn: "2025-04-30",
      },
      {
        number: 196,
        title: "Move board diffing into the wasm module",
        mergedOn: "2024-11-28",
      },
      {
        number: 118,
        title: "Replace polling with server-sent events",
        mergedOn: "2024-06-10",
      },
    ],
    workflows: [
      {
        name: "ci.yml",
        runsSampled: 30,
        passed: 28,
        lastRun: { id: 602, date: "2025-06-20", passed: true },
      },
      {
        name: "release.yml",
        runsSampled: 8,
        passed: 8,
        lastRun: { id: 594, date: "2025-05-27", passed: true },
      },
    ],
    caseStudy: {
      title: "Making incident boards feel instant",
      excerpt:
        "pulseboard started as a polling dashboard that redrew everything every 30 seconds. Over three releases, the team moved delivery to server-sent events and pushed board diffing into a Rust module compiled to WebAssembly — cutting p95 render latency from 1.8 s to 420 ms while the board grew to hundreds of live cells. This draft cites the merged pull requests, the benchmark workflow runs, and the release notes behind each number.",
      citations: [
        {
          type: "pull-request",
          label: "PR #196",
          detail: "Merged Nov 28, 2024",
        },
        {
          type: "workflow-run",
          label: "run #588",
          detail: "Benchmark job, Dec 4, 2024",
        },
        { type: "release", label: "v0.5.0", detail: "Dec 5, 2024" },
      ],
    },
  },
  {
    id: "larkql",
    name: "larkql",
    description:
      "Embeddable query engine with a Rust core and generated TypeScript bindings.",
    defaultBranch: "main",
    activeFrom: "2023-11-12",
    activeTo: "2025-04-18",
    inventory: {
      commits: 388,
      pullRequests: 74,
      issues: 91,
      releases: 6,
      workflowRuns: 512,
      files: 9,
      docSections: 11,
    },
    languages: [
      { period: "2024 Q3", shares: { Rust: 78, TypeScript: 18, Nix: 4 } },
      { period: "2024 Q4", shares: { Rust: 75, TypeScript: 21, Nix: 4 } },
      { period: "2025 Q1", shares: { Rust: 72, TypeScript: 24, Nix: 4 } },
      { period: "2025 Q2", shares: { Rust: 70, TypeScript: 26, Nix: 4 } },
    ],
    releases: [
      { version: "v0.6.0", date: "2024-08-02", title: "Pratt parser rewrite" },
      {
        version: "v0.7.0",
        date: "2024-11-15",
        title: "Planner allocation work",
      },
      { version: "v0.8.0", date: "2025-03-06", title: "TypeScript bindings" },
    ],
    pullRequests: [
      {
        number: 110,
        title: "Generate TS bindings from the Rust AST",
        mergedOn: "2025-02-27",
      },
      {
        number: 102,
        title: "Arena-allocate plan nodes",
        mergedOn: "2024-11-08",
      },
      {
        number: 88,
        title: "Replace hand-rolled parser with Pratt parser",
        mergedOn: "2024-07-21",
      },
    ],
    workflows: [
      {
        name: "ci.yml",
        runsSampled: 30,
        passed: 29,
        lastRun: { id: 498, date: "2025-04-18", passed: true },
      },
      {
        name: "bench.yml",
        runsSampled: 12,
        passed: 12,
        lastRun: { id: 471, date: "2025-03-30", passed: true },
      },
    ],
    caseStudy: {
      title: "A query engine that earns its benchmarks",
      excerpt:
        "larkql's planner used to allocate freely and pay for it under load. After moving plan nodes into an arena, criterion benchmarks recorded in CI show allocations per planned query cut roughly in half. The parser rewrite that preceded it closed fourteen long-standing precedence bugs tracked in a single meta-issue. Every figure in this draft points at a benchmark run or a merged pull request.",
      citations: [
        {
          type: "pull-request",
          label: "PR #102",
          detail: "Merged Nov 8, 2024",
        },
        {
          type: "workflow-run",
          label: "run #311",
          detail: "Criterion suite, Nov 9, 2024",
        },
        { type: "issue", label: "issue #61", detail: "Precedence meta-issue" },
      ],
    },
  },
  {
    id: "driftwatch",
    name: "driftwatch",
    description:
      "Command-line tool that detects schema drift in data pipelines. Started in Python, rewritten in Go.",
    defaultBranch: "main",
    activeFrom: "2024-08-09",
    activeTo: "2025-06-14",
    inventory: {
      commits: 143,
      pullRequests: 32,
      issues: 27,
      releases: 0,
      workflowRuns: 210,
      files: 7,
      docSections: 4,
    },
    languages: [
      { period: "2024 Q4", shares: { Python: 96, Shell: 4 } },
      { period: "2025 Q1", shares: { Python: 58, Go: 39, Shell: 3 } },
      { period: "2025 Q2", shares: { Go: 88, Python: 9, Shell: 3 } },
    ],
    releases: [],
    pullRequests: [
      {
        number: 24,
        title: "Contract tests against warehouse fixtures",
        mergedOn: "2025-04-22",
      },
      { number: 21, title: "Port diff core to Go", mergedOn: "2025-03-14" },
      {
        number: 17,
        title: "Stream schemas instead of loading whole files",
        mergedOn: "2025-01-30",
      },
    ],
    workflows: [
      {
        name: "ci.yml",
        runsSampled: 30,
        passed: 27,
        lastRun: { id: 208, date: "2025-06-14", passed: false },
      },
    ],
    caseStudy: {
      title: "Rewriting a CLI without losing its users",
      excerpt:
        "driftwatch began as a Python prototype that took nearly a second to start — noticeable in tight CI loops. The Go rewrite landed behind contract tests that pin behavior against three warehouse fixture schemas, and cold-start dropped from roughly 900 ms to 40 ms. This draft is still being reviewed: the plugin-interface claim below has one linked document and needs more evidence before it can be verified.",
      citations: [
        {
          type: "pull-request",
          label: "PR #21",
          detail: "Merged Mar 14, 2025",
        },
        {
          type: "file",
          label: "testdata/fixtures",
          detail: "Warehouse fixture schemas",
        },
      ],
    },
  },
];

/**
 * Milestones are stored oldest-first per repository; the Timeline component
 * sorts for display. Evidence lists deliberately cover every EvidenceType,
 * ConfidenceState, and ReviewState so the demo exercises the full design
 * system — tests assert this stays true.
 */
export const demoMilestones: Milestone[] = [
  {
    id: "pulseboard-sse",
    repoId: "pulseboard",
    date: "2024-06-14",
    claim:
      "Shipped the streaming incident timeline, replacing 30-second polling with server-sent events.",
    confidence: "fact",
    review: "published",
    evidence: [
      { type: "pull-request", label: "PR #118", detail: "Merged Jun 10, 2024" },
      {
        type: "commit",
        label: "9c4e1f2",
        detail: "Wire SSE transport into board store",
      },
      { type: "release", label: "v0.4.0", detail: "Streaming timeline view" },
      {
        type: "doc-section",
        label: "adr/0007-sse.md",
        detail: "Transport decision record",
      },
    ],
  },
  {
    id: "pulseboard-wasm",
    repoId: "pulseboard",
    date: "2024-12-05",
    claim:
      "Cut p95 board render latency from 1.8 s to 420 ms by moving diffing into a Rust wasm module.",
    confidence: "deterministic",
    review: "verified",
    evidence: [
      { type: "pull-request", label: "PR #196", detail: "Merged Nov 28, 2024" },
      { type: "commit", label: "4f21c9a", detail: "Swap TS differ for wasm" },
      {
        type: "workflow-run",
        label: "run #588",
        detail: "Benchmark job recording both figures",
      },
      { type: "release", label: "v0.5.0", detail: "Rust wasm diff engine" },
    ],
  },
  {
    id: "pulseboard-stable",
    repoId: "pulseboard",
    date: "2025-03-11",
    claim:
      "Reached 1.0 with a frozen plugin API after a three-release-candidate stabilization cycle.",
    confidence: "fact",
    review: "published",
    evidence: [
      { type: "release", label: "v1.0.0", detail: "First stable release" },
      {
        type: "issue",
        label: "issue #171",
        detail: "Stabilization tracking issue",
      },
      {
        type: "doc-section",
        label: "CHANGELOG §1.0.0",
        detail: "API freeze notes",
      },
      { type: "commit", label: "b04d7e1", detail: "Mark plugin API stable" },
    ],
  },
  {
    id: "pulseboard-routing",
    repoId: "pulseboard",
    date: "2025-05-27",
    claim:
      "Introduced ownership-based alert routing so pages reach the team that owns the failing service.",
    confidence: "ai-draft",
    review: "draft",
    evidence: [
      { type: "pull-request", label: "PR #241", detail: "Merged May 20, 2025" },
      { type: "commit", label: "7d3a44b", detail: "Ownership map resolver" },
    ],
  },
  {
    id: "larkql-parser",
    repoId: "larkql",
    date: "2024-08-02",
    claim:
      "Replaced the hand-rolled parser with a Pratt parser, closing 14 long-standing precedence bugs.",
    confidence: "fact",
    review: "published",
    evidence: [
      { type: "pull-request", label: "PR #88", detail: "Merged Jul 21, 2024" },
      {
        type: "issue",
        label: "issue #61",
        detail: "Meta-issue linking all 14 bugs",
      },
      { type: "commit", label: "b8123aa", detail: "Pratt parser core" },
      {
        type: "workflow-run",
        label: "run #240",
        detail: "Full corpus test pass",
      },
      {
        type: "doc-section",
        label: "docs/parser.md",
        detail: "Grammar and precedence tables",
      },
    ],
  },
  {
    id: "larkql-arena",
    repoId: "larkql",
    date: "2024-11-15",
    claim:
      "Halved planner allocations per query, as measured by the criterion benchmarks recorded in CI.",
    confidence: "deterministic",
    review: "verified",
    evidence: [
      { type: "pull-request", label: "PR #102", detail: "Merged Nov 8, 2024" },
      {
        type: "workflow-run",
        label: "run #311",
        detail: "Criterion suite before/after",
      },
      {
        type: "file",
        label: "bench/plan.rs",
        detail: "Benchmark definitions",
      },
    ],
  },
  {
    id: "larkql-bindings",
    repoId: "larkql",
    date: "2025-03-06",
    claim:
      "Published typed TypeScript bindings generated directly from the Rust AST definitions.",
    confidence: "ai-draft",
    review: "needs-evidence",
    evidence: [],
  },
  {
    id: "driftwatch-go",
    repoId: "driftwatch",
    date: "2025-03-14",
    claim:
      "Rewrote the diff core from Python to Go, cutting CLI cold-start from about 900 ms to 40 ms.",
    confidence: "deterministic",
    review: "verified",
    evidence: [
      { type: "pull-request", label: "PR #21", detail: "Merged Mar 14, 2025" },
      { type: "commit", label: "c91d2e0", detail: "Go diff core" },
      {
        type: "workflow-run",
        label: "run #178",
        detail: "Timing harness output",
      },
      {
        type: "doc-section",
        label: "docs/rewrite-notes.md",
        detail: "Measurement method",
      },
    ],
  },
  {
    id: "driftwatch-contract",
    repoId: "driftwatch",
    date: "2025-04-22",
    claim:
      "Added contract tests that pin diff behavior against three warehouse fixture schemas.",
    confidence: "fact",
    review: "verified",
    evidence: [
      { type: "pull-request", label: "PR #24", detail: "Merged Apr 22, 2025" },
      {
        type: "file",
        label: "testdata/fixtures",
        detail: "Fixture schema corpus",
      },
      {
        type: "workflow-run",
        label: "run #189",
        detail: "Contract suite green",
      },
    ],
  },
  {
    id: "driftwatch-plugins",
    repoId: "driftwatch",
    date: "2025-06-02",
    claim:
      "Designed a plugin interface so teams can register custom drift rules.",
    confidence: "ai-draft",
    review: "draft",
    evidence: [
      {
        type: "doc-section",
        label: "rfc/0003-plugins.md",
        detail: "Interface proposal",
      },
    ],
  },
];
