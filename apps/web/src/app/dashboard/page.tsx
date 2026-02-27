"use client";

import Link from "next/link";
import { useGroups } from "@/hooks/use-groups";
import { useCurrentUser } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { data: userData } = useCurrentUser();
  const { data: groupData, isLoading } = useGroups(1, 5);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {userData?.user?.status === "UNVERIFIED" && (
        <div className="alert alert-info">
          Your email is not verified. Some features may be restricted.{" "}
          <Link href="/verify-email">Verify your email</Link>
        </div>
      )}

      <div className="grid grid-3">
        <div className="card">
          <h3
            style={{ color: "var(--color-text-heading)", marginBottom: "4px" }}
          >
            Welcome back
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            {userData?.user?.name ?? "User"}
          </p>
        </div>

        <div className="card">
          <h3
            style={{ color: "var(--color-text-heading)", marginBottom: "4px" }}
          >
            Groups
          </h3>
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-primary)",
            }}
          >
            {groupData?.pagination.total ?? 0}
          </p>
        </div>

        <Link
          href="/dashboard/groups"
          className="card"
          style={{ textDecoration: "none" }}
        >
          <h3
            style={{ color: "var(--color-text-heading)", marginBottom: "4px" }}
          >
            Quick Actions
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            View groups & tasks →
          </p>
        </Link>
      </div>

      <div style={{ marginTop: "32px" }}>
        <div className="page-header">
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--color-text-heading)",
            }}
          >
            Recent Groups
          </h2>
          <Link href="/dashboard/groups" className="btn btn-secondary btn-sm">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div
            className="flex items-center gap-2"
            style={{ padding: "24px 0" }}
          >
            <div className="spinner" />
            <span className="text-muted">Loading groups...</span>
          </div>
        ) : groupData?.groups.length === 0 ? (
          <div className="card text-center" style={{ padding: "40px" }}>
            <p className="text-muted">
              No groups yet. Create your first group to get started.
            </p>
            <Link href="/dashboard/groups" className="btn btn-primary mt-4">
              Create a group
            </Link>
          </div>
        ) : (
          <div className="grid grid-2">
            {groupData?.groups.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/groups/${group.id}`}
                className="card task-card"
                style={{ textDecoration: "none" }}
              >
                <h3>{group.name}</h3>
                <p>{group.description ?? "No description"}</p>
                <div className="task-meta">
                  <span>
                    Created {new Date(group.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
