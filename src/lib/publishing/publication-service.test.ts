import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (callback: () => unknown) => callback,
}));
vi.mock("@/lib/auth/authorization", () => ({
  requireWorkspaceOwner: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: vi.fn() }));

describe("publication snapshot rendering", () => {
  it("uses the same public view model for preview and persisted revisions", async () => {
    const { buildPublicationSnapshot, buildPublicProjectView } =
      await import("./publication-service");
    const publishedAt = new Date("2026-07-28T00:00:00.000Z");
    const preview = buildPublicationSnapshot(
      {
        id: "private-publication-id",
        slug: "safe-project",
        title: "Safe project",
        summary: "A reviewed project.",
        roleText: "Maintainer",
        projectPeriodText: "2026",
        technologyLabels: ["TypeScript"],
        problemText: "A bounded problem.",
        approachText: "A reviewed approach.",
        outcomeText: "A factual outcome.",
        repositoryDisclosurePolicy: "IDENTITY_REDACTED",
        visibility: "UNLISTED",
        healthState: "CURRENT",
        profile: {
          slug: "safe-author",
          displayName: "Safe Author",
          headline: "Engineer",
          biography: "Evidence-backed work.",
          locationText: null,
          personalWebsiteUrl: null,
          githubProfileUrl: null,
        },
      } as never,
      {
        repository: {
          id: "private-repository-id",
          visibility: "private",
          ownerLogin: "never-public",
          name: "never-public",
          fullName: "never-public/never-public",
        },
        includesPrivateSource: true,
        privateForbiddenValues: ["never-public"],
        claims: [
          {
            id: "private-claim-id",
            statement: "Implemented a reviewed workflow.",
            statementHash: "a".repeat(64),
            origin: "AI_ASSISTED",
            verifiedAt: new Date("2026-07-27T00:00:00.000Z"),
            humanEdited: true,
            evidence: [
              {
                id: "private-evidence-id",
                evidenceType: "commit",
                occurredAt: new Date("2026-07-26T00:00:00.000Z"),
                originalTitle: "never public",
                normalizedContentHash: "b".repeat(64),
                mode: "PRIVATE_SOURCE_REDACTED",
                publicTitle: "Private repository evidence",
                includeOccurredAt: false,
                canonicalPublicSourceUrl: null,
                publicProvenanceText:
                  "Source evidence belongs to a private repository and is not publicly accessible.",
              },
            ],
          },
        ],
      },
      publishedAt,
      1,
    );
    const persisted = buildPublicProjectView({
      slug: preview.slug,
      healthState: "CURRENT",
      currentPublishedRevision: {
        title: preview.title,
        summary: preview.summary,
        roleText: preview.role,
        projectPeriodText: preview.period,
        technologyLabels: preview.technologies,
        problemText: preview.problem,
        approachText: preview.approach,
        outcomeText: preview.outcome,
        repositoryDisclosurePolicy: preview.repositoryDisclosurePolicy,
        publicRepositoryLabel: preview.publicRepositoryLabel,
        publicRepositoryUrl: preview.publicRepositoryUrl,
        authorSlug: preview.author.slug,
        authorDisplayName: preview.author.displayName,
        authorHeadline: preview.author.headline,
        authorBiography: preview.author.biography,
        authorLocationText: preview.author.location,
        authorPersonalWebsiteUrl: preview.author.personalWebsiteUrl,
        authorGithubProfileUrl: preview.author.githubProfileUrl,
        visibility: preview.visibility,
        publishedAt,
        revisionNumber: 1,
        contentHash: preview.contentHash,
        claimSnapshots: preview.claims.map((claim, position) => ({
          publicClaimIdentifier: claim.identifier,
          statement: claim.statement,
          claimOrigin: claim.origin,
          verifiedAt: new Date(claim.verifiedAt),
          humanEdited: claim.humanEdited,
          position,
          evidenceSnapshots: claim.evidence.map(
            (evidence, evidencePosition) => ({
              publicDisclosureIdentifier: evidence.identifier,
              evidenceType: evidence.type,
              publicTitle: evidence.title,
              occurredAt: evidence.occurredAt
                ? new Date(evidence.occurredAt)
                : null,
              disclosureMode: evidence.disclosureMode,
              canonicalPublicSourceUrl: evidence.sourceUrl,
              publicProvenanceText: evidence.provenance,
              position: evidencePosition,
            }),
          ),
        })),
      } as never,
    });
    expect(persisted).toEqual(preview);
    expect(JSON.stringify(preview)).not.toContain("never-public");
    expect(JSON.stringify(preview)).not.toContain("private-claim-id");
  });
});
