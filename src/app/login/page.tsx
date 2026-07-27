import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    if (await getSession()) redirect("/dashboard");
  } catch {
    // The form will surface a generic configuration-safe error on submission.
  }
  return (
    <div className="container-page py-16">
      <section className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Return to your private personal workspace.
        </p>
        <AuthForm mode="login" />
        <p className="mt-5 text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-primary underline" href="/register">
            Create an account
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
