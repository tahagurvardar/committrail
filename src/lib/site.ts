export const siteConfig = {
  name: "CommitTrail",
  tagline: "Turn GitHub history into evidence-backed engineering stories.",
  description:
    "CommitTrail reads the repository history you already have — commits, pull requests, releases, and CI runs — and helps you turn it into reviewed, evidence-linked engineering milestones and case studies.",
  /** Expected home of this repository. Not linked in the app during Phase 0. */
  repositoryUrl: "https://github.com/tahagurvardar/committrail",
  phaseLabel: "Phase 0 · Product foundation",
  nav: [
    { label: "Product", href: "/about" },
    { label: "Methodology", href: "/methodology" },
    { label: "Demo", href: "/demo" },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
