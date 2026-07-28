"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { safeReturnPath } from "@/lib/auth/safe-return-path";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    if (password.length < 12 || password.length > 128) {
      setError("Password must contain between 12 and 128 characters.");
      setPending(false);
      return;
    }
    const result =
      mode === "register"
        ? await authClient.signUp.email({
            email,
            password,
            name: name || email.split("@")[0],
          })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(
        "We could not complete that request. Check your details and try again.",
      );
      setPending(false);
      return;
    }
    const returnTo = search.get("returnTo");
    router.push(safeReturnPath(returnTo));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" aria-describedby="auth-note">
      {mode === "register" && (
        <label className="grid gap-2 text-sm font-medium">
          Display name
          <input
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            className="h-11 rounded-md border bg-background px-3"
          />
        </label>
      )}
      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          className="h-11 rounded-md border bg-background px-3"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          className="h-11 rounded-md border bg-background px-3"
        />
        <span className="text-xs font-normal text-muted-foreground">
          12–128 characters.
        </span>
      </label>
      {error && (
        <p
          id="auth-error"
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm"
        >
          {error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending
          ? "Please wait…"
          : mode === "register"
            ? "Create account"
            : "Sign in"}
      </button>
      <p id="auth-note" className="text-xs leading-5 text-muted-foreground">
        Email is used as a login identifier. CommitTrail does not send
        verification or password-reset emails in Phase 2.
      </p>
    </form>
  );
}
