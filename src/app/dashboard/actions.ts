"use server";

import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireWorkspaceOwner,
  getAuthorizedInstallation,
  getAuthorizedTrackedRepository,
} from "@/lib/auth/authorization";
import { getPrisma } from "@/lib/db/prisma";
import { beginInstallation } from "@/lib/github-app/flow";
import { discoverInstallationRepositories } from "@/lib/github-app/client";
import { synchronizeTrackedRepository } from "@/lib/repositories/sync";
import {
  invalidatePublicationRemoval,
  prepareRepositoryPublicationRemoval,
} from "@/lib/publishing/health-service";

export async function connectGitHubAction() {
  const { session, workspace } = await requireWorkspaceOwner();
  await beginInstallation(workspace.id, session.user.id);
}

export async function trackRepositoryAction(formData: FormData) {
  const installationRecordId = String(formData.get("installationId") ?? "");
  const repositoryId = String(formData.get("repositoryId") ?? "");
  if (!/^\d+$/.test(repositoryId))
    throw new Error("INVALID_REPOSITORY_SELECTION");
  const { installation, workspace, session } =
    await getAuthorizedInstallation(installationRecordId);
  const discovered = await discoverInstallationRepositories(
    installation.installationId,
  );
  const selected = discovered.repositories.find(
    (repository) => repository.id.toString() === repositoryId,
  );
  if (!selected) throw new Error("REPOSITORY_NOT_ACCESSIBLE");
  const tracked = await getPrisma().trackedRepository.upsert({
    where: {
      workspaceId_githubRepositoryId: {
        workspaceId: workspace.id,
        githubRepositoryId: selected.id,
      },
    },
    update: {
      githubInstallationId: installation.id,
      ownerLogin: selected.owner,
      name: selected.name,
      fullName: selected.fullName,
      visibility: selected.visibility,
      defaultBranch: selected.defaultBranch,
      archived: selected.archived,
      fork: selected.fork,
      trackingStatus: "ACTIVE",
    },
    create: {
      workspaceId: workspace.id,
      githubInstallationId: installation.id,
      githubRepositoryId: selected.id,
      ownerLogin: selected.owner,
      name: selected.name,
      fullName: selected.fullName,
      visibility: selected.visibility,
      defaultBranch: selected.defaultBranch,
      archived: selected.archived,
      fork: selected.fork,
      sourceType: "INSTALLATION",
    },
  });
  await getPrisma().auditEvent.create({
    data: {
      workspaceId: workspace.id,
      userId: session.user.id,
      type: "repository.tracking.started",
      metadata: { trackedRepositoryId: tracked.id },
    },
  });
  await synchronizeTrackedRepository({
    trackedRepositoryId: tracked.id,
    workspaceId: workspace.id,
    userId: session.user.id,
    mode: "INITIAL",
  });
  redirect(`/dashboard/repositories/${tracked.id}`);
}

export async function syncRepositoryAction(formData: FormData) {
  const id = String(formData.get("trackedRepositoryId") ?? "");
  const { repository, workspace, session } =
    await getAuthorizedTrackedRepository(id);
  await synchronizeTrackedRepository({
    trackedRepositoryId: repository.id,
    workspaceId: workspace.id,
    userId: session.user.id,
    mode: "MANUAL",
  });
  revalidatePath(`/dashboard/repositories/${id}`);
}

export async function retryDeadIngestionJobAction(formData: FormData) {
  const repositoryId = String(formData.get("trackedRepositoryId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const { repository, workspace, session } =
    await getAuthorizedTrackedRepository(repositoryId);
  const prisma = getPrisma();
  const dead = await prisma.ingestionJob.findFirst({
    where: {
      id: jobId,
      workspaceId: workspace.id,
      trackedRepositoryId: repository.id,
      status: "DEAD",
    },
  });
  if (!dead) throw new Error("INGESTION_JOB_NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dead.deduplicationKey}))`;
    const active = await tx.ingestionJob.findFirst({
      where: {
        deduplicationKey: dead.deduplicationKey,
        status: { in: ["PENDING", "RUNNING"] },
      },
    });
    if (active) throw new Error("INGESTION_JOB_ALREADY_ACTIVE");
    await tx.ingestionJob.create({
      data: {
        workspaceId: workspace.id,
        trackedRepositoryId: repository.id,
        githubInstallationId: dead.githubInstallationId,
        kind: dead.kind,
        deduplicationKey: dead.deduplicationKey,
        minimalPayload: JSON.parse(
          JSON.stringify(dead.minimalPayload),
        ) as Prisma.InputJsonValue,
        maximumAttempts: dead.maximumAttempts,
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        type: "ingestion.dead_job.retried",
        metadata: {
          historicalJobId: dead.id,
          trackedRepositoryId: repository.id,
        },
      },
    });
  });
  revalidatePath(`/dashboard/repositories/${repository.id}`);
}

export async function disconnectGitHubAction(formData: FormData) {
  if (formData.get("confirmation") !== "DISCONNECT")
    throw new Error("CONFIRMATION_REQUIRED");
  const installationId = String(formData.get("installationId") ?? "");
  const { installation, workspace, session } =
    await getAuthorizedInstallation(installationId);
  const removedPublications = await getPrisma().$transaction(async (tx) => {
    const repositories = await tx.trackedRepository.findMany({
      where: {
        workspaceId: workspace.id,
        githubInstallationId: installation.id,
      },
      select: { id: true },
    });
    const invalidation = await prepareRepositoryPublicationRemoval(
      tx,
      { workspaceId: workspace.id, userId: session.user.id },
      repositories.map((repository) => repository.id),
    );
    await tx.projectPublication.updateMany({
      where: {
        workspaceId: workspace.id,
        trackedRepositoryId: {
          in: repositories.map((repository) => repository.id),
        },
      },
      data: { currentPublishedRevisionId: null },
    });
    await tx.projectPublication.deleteMany({
      where: {
        workspaceId: workspace.id,
        trackedRepositoryId: {
          in: repositories.map((repository) => repository.id),
        },
      },
    });
    await tx.portfolioOutput.updateMany({
      where: {
        workspaceId: workspace.id,
        trackedRepositoryId: {
          in: repositories.map((repository) => repository.id),
        },
      },
      data: { currentRevisionId: null },
    });
    await tx.portfolioOutput.deleteMany({
      where: {
        workspaceId: workspace.id,
        trackedRepositoryId: {
          in: repositories.map((repository) => repository.id),
        },
      },
    });
    await tx.gitHubConnectionAttempt.deleteMany({
      where: { workspaceId: workspace.id },
    });
    await tx.gitHubInstallation.delete({ where: { id: installation.id } });
    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        type: "github.connection.disconnected",
      },
    });
    return invalidation;
  });
  invalidatePublicationRemoval(removedPublications);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/github");
  revalidatePath("/dashboard/repositories");
}

export async function deleteAccountAction(formData: FormData) {
  if (formData.get("confirmation") !== "DELETE MY ACCOUNT")
    throw new Error("CONFIRMATION_REQUIRED");
  const { session } = await requireWorkspaceOwner();
  const prisma = getPrisma();
  const removedPublications = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { ownerUserId: session.user.id },
      include: {
        publicProfile: { select: { slug: true } },
        projectPublications: { select: { slug: true } },
      },
    });
    await tx.auditEvent.create({
      data: { userId: session.user.id, type: "account.deletion.requested" },
    });
    if (workspace) {
      await tx.projectPublication.updateMany({
        where: { workspaceId: workspace.id },
        data: { currentPublishedRevisionId: null },
      });
      await tx.projectPublication.deleteMany({
        where: { workspaceId: workspace.id },
      });
      await tx.portfolioOutput.updateMany({
        where: { workspaceId: workspace.id },
        data: { currentRevisionId: null },
      });
      await tx.portfolioOutput.deleteMany({
        where: { workspaceId: workspace.id },
      });
      await tx.publicProfile.deleteMany({
        where: { workspaceId: workspace.id },
      });
    }
    await tx.user.delete({ where: { id: session.user.id } });
    return {
      profileSlugs: workspace?.publicProfile
        ? [workspace.publicProfile.slug]
        : [],
      projectSlugs:
        workspace?.projectPublications.map((publication) => publication.slug) ??
        [],
    };
  });
  invalidatePublicationRemoval(removedPublications);
  redirect("/account-deleted");
}
