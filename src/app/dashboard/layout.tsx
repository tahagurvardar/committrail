import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSession } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

const links = [
  ["/dashboard", "Overview"],
  ["/dashboard/repositories", "Repositories"],
  ["/dashboard/profile", "Public profile"],
  ["/dashboard/publications", "Publications"],
  ["/dashboard/outputs", "Outputs"],
  ["/dashboard/github", "GitHub"],
  ["/dashboard/settings", "Settings"],
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession("/dashboard");
  return (
    <div className="container-page py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <nav aria-label="Workspace">
          <ul className="flex flex-wrap gap-1">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <span className="max-w-48 truncate text-sm text-muted-foreground">
            {session.user.email}
          </span>
          <SignOutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
