import Link from "next/link";
import { savePublicProfileAction } from "./actions";
import { getAuthorizedPublicProfile } from "@/lib/publishing/profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardProfilePage() {
  const { profile, session } = await getAuthorizedPublicProfile();
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            Deliberate publishing
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Public profile</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Only the plain-text fields below become public. Your account email,
            workspace identifier, and GitHub installation identity are never
            included automatically.
          </p>
        </div>
        {profile?.visibility === "PUBLIC" ? (
          <Link
            href={`/profiles/${profile.slug}`}
            className="rounded-md border px-3 py-2 text-sm"
          >
            View public profile
          </Link>
        ) : null}
      </div>
      <form
        action={savePublicProfileAction}
        className="mt-8 max-w-3xl space-y-5"
      >
        {profile ? (
          <input type="hidden" name="expectedVersion" value={profile.version} />
        ) : null}
        <label className="block text-sm" htmlFor="profile-slug">
          Profile slug
          <input
            id="profile-slug"
            name="slug"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={profile?.slug ?? ""}
            readOnly={Boolean(profile?.firstPublishedAt)}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 read-only:bg-muted"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Lowercase letters, numbers, and single hyphens. Permanent after the
            first publication.
          </span>
        </label>
        <label className="block text-sm" htmlFor="profile-name">
          Public display name
          <input
            id="profile-name"
            name="displayName"
            required
            maxLength={80}
            defaultValue={profile?.displayName ?? session.user.name}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm" htmlFor="profile-headline">
          Headline
          <input
            id="profile-headline"
            name="headline"
            required
            maxLength={140}
            defaultValue={profile?.headline ?? ""}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm" htmlFor="profile-biography">
          Short biography
          <textarea
            id="profile-biography"
            name="biography"
            required
            maxLength={600}
            rows={6}
            defaultValue={profile?.biography ?? ""}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm" htmlFor="profile-location">
            Location (optional)
            <input
              id="profile-location"
              name="locationText"
              maxLength={100}
              defaultValue={profile?.locationText ?? ""}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm" htmlFor="profile-visibility">
            Visibility
            <select
              id="profile-visibility"
              name="visibility"
              defaultValue={profile?.visibility ?? "PRIVATE"}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            >
              <option value="PRIVATE">PRIVATE</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
          </label>
        </div>
        <label className="block text-sm" htmlFor="profile-website">
          Personal website (optional HTTPS)
          <input
            id="profile-website"
            name="personalWebsiteUrl"
            type="url"
            maxLength={500}
            defaultValue={profile?.personalWebsiteUrl ?? ""}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm" htmlFor="profile-github">
          GitHub profile (optional HTTPS)
          <input
            id="profile-github"
            name="githubProfileUrl"
            type="url"
            maxLength={500}
            defaultValue={profile?.githubProfileUrl ?? ""}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <aside className="rounded-xl border bg-card p-4 text-sm">
          Setting this profile to PRIVATE immediately hides the profile and all
          of its project routes, including UNLISTED links. Project revisions and
          private history remain available in the dashboard.
        </aside>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Save profile
        </button>
      </form>
    </section>
  );
}
