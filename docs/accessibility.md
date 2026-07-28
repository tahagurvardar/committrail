# Accessibility verification

CommitTrail targets WCAG 2.2 AA practices: semantic landmarks and headings,
keyboard operability, visible focus, reduced-motion respect, form labels and
errors, meaningful status text, non-color-only evidence states, and responsive
reflow.

The Playwright release suite runs axe on public and authenticated critical
paths at desktop and mobile Chromium sizes, failing on serious or critical
violations. Color-contrast automation is disabled because canvas/computed-theme
results are not stable in the CI browser; palette contrast is reviewed
manually. Tests also exercise keyboard focus visibility and horizontal
overflow.

Before a release, manually check:

- keyboard-only navigation, skip/order behavior, dialogs, and focus recovery;
- 200% browser zoom and narrow reflow;
- light and dark theme contrast, forced colors, and reduced motion;
- screen-reader names, descriptions, validation announcements, tables, and
  evidence relationships;
- error, loading, empty, disabled, and timeout states.

Automated checks reduce regressions but do not certify conformance. The v1.0.0
release records automated results and truthfully notes that comprehensive
assistive-technology testing remains ongoing.
