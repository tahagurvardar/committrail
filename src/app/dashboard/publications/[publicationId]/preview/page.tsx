import Link from "next/link";
import { PublicProject } from "@/components/publishing/public-project";
import { previewPublication } from "@/lib/publishing/publication-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Private publication preview",
  robots: { index: false, follow: false },
};

export default async function PublicationPreviewPage({
  params,
}: {
  params: Promise<{ publicationId: string }>;
}) {
  const { publicationId } = await params;
  const project = await previewPublication(publicationId);
  return (
    <section>
      <div className="container-page pt-6">
        <Link
          href={`/dashboard/publications/${publicationId}`}
          className="text-sm text-primary underline"
        >
          Back to private draft
        </Link>
      </div>
      <PublicProject project={project} preview />
    </section>
  );
}
