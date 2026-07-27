import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <div className="container-page py-20 text-center">
      <h1 className="text-3xl font-semibold">Account data deleted</h1>
      <p className="mt-3 text-muted-foreground">
        Your local CommitTrail account and workspace data were removed. No
        GitHub uninstall request was made.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary underline">
        Return home
      </Link>
    </div>
  );
}
