"use client";

import { authClient } from "@/lib/auth/auth-client";

export function SignOutButton() {
  return (
    <button
      className="rounded-md border px-3 py-2 text-sm"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/");
      }}
    >
      Sign out
    </button>
  );
}
