import { requireWorkspaceOwner } from "@/lib/auth/authorization";
import { deleteAccountAction } from "@/app/dashboard/actions";

export default async function SettingsPage() {
  const { session } = await requireWorkspaceOwner();
  return (
    <section>
      <p className="text-sm font-medium text-primary">Account lifecycle</p>
      <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
      <article className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Account</h2>
        <p className="mt-2 text-sm">{session.user.email}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Email is a login identifier. Phase 2 does not send verification or
          password-reset email.
        </p>
      </article>
      <article className="mt-5 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Export your CommitTrail data</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Versioned JSON includes owned workspace facts and excludes
          credentials, sessions, OAuth material, and tokens.
        </p>
        <a
          href="/api/export"
          className="mt-4 inline-block rounded-md border px-3 py-2 text-sm"
        >
          Download JSON export
        </a>
      </article>
      <article className="mt-5 rounded-xl border border-red-500/40 bg-card p-5">
        <h2 className="font-semibold">Delete account and local data</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This transaction removes your account, sessions, workspace,
          connections, snapshots, evidence, and sync history. It does not
          uninstall the GitHub App on GitHub.
        </p>
        <form
          action={deleteAccountAction}
          className="mt-4 flex flex-wrap gap-2"
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Type DELETE MY ACCOUNT
            <input
              name="confirmation"
              required
              pattern="DELETE MY ACCOUNT"
              className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <button className="self-end rounded-md border border-red-500/50 px-3 py-2 text-sm">
            Delete account
          </button>
        </form>
      </article>
    </section>
  );
}
