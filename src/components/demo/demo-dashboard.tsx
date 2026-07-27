"use client";

import { useState } from "react";

import { CaseStudyPanel } from "@/components/demo/case-study-panel";
import { CiPanel } from "@/components/demo/ci-panel";
import { CoveragePanel } from "@/components/demo/coverage-panel";
import { LanguagePanel } from "@/components/demo/language-panel";
import { ProfilePanel } from "@/components/demo/profile-panel";
import { PullRequestPanel } from "@/components/demo/pr-panel";
import { ReleasePanel } from "@/components/demo/release-panel";
import { RepositoryOverview } from "@/components/demo/repository-overview";
import { RepositorySelector } from "@/components/repository-selector";
import { SectionHeading } from "@/components/section-heading";
import { Timeline } from "@/components/timeline";
import {
  demoDeveloper,
  demoMilestones,
  demoRepositories,
} from "@/lib/demo/data";
import { milestonesForRepo } from "@/lib/demo/derive";

/**
 * Client shell for the demo: holds the selected repository and lays out the
 * presentational panels. All data comes from deterministic fixtures.
 */
export function DemoDashboard() {
  const [selectedId, setSelectedId] = useState(demoRepositories[0].id);
  const repo =
    demoRepositories.find((candidate) => candidate.id === selectedId) ??
    demoRepositories[0];
  const repoMilestones = milestonesForRepo(demoMilestones, repo.id);

  return (
    <div className="space-y-14">
      <section aria-label="Developer profile">
        <ProfilePanel
          developer={demoDeveloper}
          repositoryCount={demoRepositories.length}
          milestones={demoMilestones}
        />
      </section>

      <section aria-labelledby="repositories-heading">
        <SectionHeading
          index="01"
          eyebrow="Repositories"
          id="repositories-heading"
          title="Pick a repository to inspect."
        />
        <RepositorySelector
          repositories={demoRepositories}
          selectedId={repo.id}
          onSelect={setSelectedId}
          className="mt-6"
        />
      </section>

      <section aria-labelledby="overview-heading">
        <SectionHeading
          index="02"
          eyebrow="Overview"
          id="overview-heading"
          title={`What CommitTrail knows about ${repo.name}.`}
        />
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          <RepositoryOverview repo={repo} />
          <CoveragePanel milestones={repoMilestones} />
        </div>
      </section>

      <section aria-labelledby="timeline-heading">
        <SectionHeading
          index="03"
          eyebrow="Engineering timeline"
          id="timeline-heading"
          title="Milestones, newest first."
          description="Each claim shows its origin, review state, and the records that back it. Source links are disabled in the demo."
        />
        <Timeline milestones={repoMilestones} className="mt-8 max-w-3xl" />
      </section>

      <section aria-labelledby="signals-heading">
        <SectionHeading
          index="04"
          eyebrow="Deterministic signals"
          id="signals-heading"
          title="Derived from facts, reproducible on demand."
        />
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          <LanguagePanel languages={repo.languages} />
          <CiPanel workflows={repo.workflows} />
          <ReleasePanel releases={repo.releases} repoName={repo.name} />
          <PullRequestPanel
            pullRequests={repo.pullRequests}
            totalIngested={repo.inventory.pullRequests}
          />
        </div>
      </section>

      <section aria-labelledby="case-study-heading">
        <SectionHeading
          index="05"
          eyebrow="Case study"
          id="case-study-heading"
          title="An AI-assisted draft, waiting on its author."
          description="The model may only cite evidence that exists in the store — and the author decides what happens next."
        />
        <div className="mt-6">
          <CaseStudyPanel caseStudy={repo.caseStudy} />
        </div>
      </section>
    </div>
  );
}
