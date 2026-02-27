"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useGroups, useCreateGroup } from "@/hooks/use-groups";
import { ApiError } from "@/lib/api-client";

export default function GroupsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGroups(page, 20);
  const createGroup = useCreateGroup();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createGroup.mutateAsync({
        name,
        description: description || undefined,
      });
      setShowCreate(false);
      setName("");
      setDescription("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.problem.detail);
      } else {
        setError("Failed to create group");
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Groups</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Group
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Group</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="cg-name">
                  Group name
                </label>
                <input
                  id="cg-name"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineering Team"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cg-desc">
                  Description
                </label>
                <input
                  id="cg-desc"
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createGroup.isPending}
                >
                  {createGroup.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group list */}
      {isLoading ? (
        <div className="flex items-center gap-2" style={{ padding: "40px 0" }}>
          <div className="spinner" />
          <span className="text-muted">Loading groups...</span>
        </div>
      ) : data?.groups.length === 0 ? (
        <div className="card text-center" style={{ padding: "60px 24px" }}>
          <p className="text-muted mb-4">
            No groups found. Create your first group to start organizing tasks.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + Create Group
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-2">
            {data?.groups.map((group) => (
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

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="text-muted" style={{ fontSize: "0.875rem" }}>
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
