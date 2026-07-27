import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  try {
    if (await getSession()) redirect("/dashboard");
  } catch {}
  return (
    <div className="container-page py-16">
      <section className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Account data stays private and workspace-scoped.
        </p>
        <AuthForm mode="register" />
        <p className="mt-5 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link className="text-primary underline" href="/login">
            Sign in
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
