"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading, isError } = useCurrentUser();
  const logout = useLogout();

  // Redirect to login if not authenticated
  if (isError) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  const user = data?.user;

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">📋 TaskMgmt</div>

        <Link
          href="/dashboard"
          className={`sidebar-link ${pathname === "/dashboard" ? "active" : ""}`}
        >
          ⬛ Dashboard
        </Link>
        <Link
          href="/dashboard/groups"
          className={`sidebar-link ${pathname.startsWith("/dashboard/groups") ? "active" : ""}`}
        >
          👥 Groups
        </Link>

        <div style={{ flex: 1 }} />

        {user && (
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--color-text-heading)",
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                marginBottom: "8px",
              }}
            >
              {user.email}
            </div>
            {user.status === "UNVERIFIED" && (
              <div
                className="alert alert-info"
                style={{ marginBottom: "8px", padding: "8px 12px" }}
              >
                Email not verified. <Link href="/verify-email">Verify now</Link>
              </div>
            )}
            <button
              className="btn btn-secondary btn-sm btn-block"
              onClick={handleLogout}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        )}
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}
