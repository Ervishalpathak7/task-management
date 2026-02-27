"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useGroup } from "@/hooks/use-groups";
import {
  useGroupTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useAcceptTask,
  useAssignTask,
  useDeleteTask,
} from "@/hooks/use-tasks";
import { useCurrentUser } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const STATUS_BADGE: Record<string, string> = {
  PENDING_ACCEPTANCE: "badge-pending",
  OPEN: "badge-open",
  IN_PROGRESS: "badge-in-progress",
  COMPLETED: "badge-completed",
  CLOSED: "badge-closed",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_ACCEPTANCE: "Pending",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

const NEXT_STATUS: Record<string, string[]> = {
  PENDING_ACCEPTANCE: ["OPEN", "CLOSED"],
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["COMPLETED", "OPEN", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
};

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { data: userData } = useCurrentUser();
  const { data: groupData, isLoading: groupLoading } = useGroup(groupId);
  const [taskPage, setTaskPage] = useState(1);
  const { data: taskData, isLoading: tasksLoading } = useGroupTasks(
    groupId,
    taskPage,
    20,
  );

  const createTask = useCreateTask();
  const [showCreate, setShowCreate] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [error, setError] = useState("");

  // Task detail modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createTask.mutateAsync({
        title: taskTitle,
        description: taskDesc || undefined,
        groupId,
        assigneeId: taskAssignee || undefined,
      });
      setShowCreate(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.problem.detail);
      } else {
        setError("Failed to create task");
      }
    }
  }

  if (groupLoading) {
    return (
      <div className="flex items-center gap-2" style={{ padding: "40px 0" }}>
        <div className="spinner" />
        <span className="text-muted">Loading group...</span>
      </div>
    );
  }

  const group = groupData?.group;
  if (!group) {
    return (
      <div className="card text-center" style={{ padding: "40px" }}>
        <p className="text-muted">Group not found.</p>
        <Link href="/dashboard/groups" className="btn btn-secondary mt-4">
          Back to groups
        </Link>
      </div>
    );
  }

  const currentUserId = userData?.user?.id;
  const members = group.members ?? [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/dashboard/groups"
              style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}
            >
              ← Groups
            </Link>
          </div>
          <h1 style={{ marginTop: "8px" }}>{group.name}</h1>
          {group.description && (
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "0.9375rem",
                marginTop: "4px",
              }}
            >
              {group.description}
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Task
        </button>
      </div>

      {/* Members bar */}
      <div
        className="card"
        style={{ marginBottom: "24px", padding: "16px 20px" }}
      >
        <div className="flex items-center justify-between">
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--color-text-heading)",
            }}
          >
            Members ({members.length})
          </span>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {members.map((m) => (
              <span
                key={m.userId}
                className="badge badge-open"
                style={{ fontSize: "0.6875rem" }}
              >
                {m.user.name} ({m.role})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Create task modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Task</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label" htmlFor="ct-title">
                  Title
                </label>
                <input
                  id="ct-title"
                  className="form-input"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ct-desc">
                  Description
                </label>
                <input
                  id="ct-desc"
                  className="form-input"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ct-assignee">
                  Assign to (optional)
                </label>
                <select
                  id="ct-assignee"
                  className="form-input"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => m.userId !== currentUserId)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name} ({m.user.email})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createTask.isPending}
                >
                  {createTask.isPending ? "Creating..." : "Create Task"}
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

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          groupId={groupId}
          currentUserId={currentUserId ?? ""}
          members={members}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Tasks list */}
      {tasksLoading ? (
        <div className="flex items-center gap-2" style={{ padding: "24px 0" }}>
          <div className="spinner" />
          <span className="text-muted">Loading tasks...</span>
        </div>
      ) : taskData?.tasks.length === 0 ? (
        <div className="card text-center" style={{ padding: "48px 24px" }}>
          <p className="text-muted mb-4">
            No tasks yet. Create your first task.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + Create Task
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-2">
            {taskData?.tasks.map((task) => (
              <div
                key={task.id}
                className="card task-card"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="card-header">
                  <h3>{task.title}</h3>
                  <span className={`badge ${STATUS_BADGE[task.status] ?? ""}`}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </div>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                  {task.assigneeId && (
                    <span style={{ color: "var(--color-primary)" }}>
                      Assigned
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {taskData && taskData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                className="btn btn-secondary btn-sm"
                disabled={taskPage <= 1}
                onClick={() => setTaskPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="text-muted" style={{ fontSize: "0.875rem" }}>
                Page {taskPage} of {taskData.pagination.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={taskPage >= taskData.pagination.totalPages}
                onClick={() => setTaskPage((p) => p + 1)}
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

// ─── Task Detail Modal ─────────────────────────────────────

interface TaskDetailModalProps {
  taskId: string;
  groupId: string;
  currentUserId: string;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; email: string; name: string };
  }>;
  onClose: () => void;
}

function TaskDetailModal({
  taskId,
  groupId,
  currentUserId,
  members,
  onClose,
}: TaskDetailModalProps) {
  const { data: taskData, isLoading } = useGroupTasks(groupId);
  const updateStatus = useUpdateTaskStatus(taskId);
  const acceptTask = useAcceptTask(taskId);
  const assignTask = useAssignTask(taskId);
  const deleteTask = useDeleteTask(taskId);
  const [assigneeId, setAssigneeId] = useState("");
  const [actionError, setActionError] = useState("");

  const task = taskData?.tasks.find((t) => t.id === taskId);

  if (isLoading || !task) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = task.createdById === currentUserId;
  const isAssignee = task.assigneeId === currentUserId;
  const transitions = NEXT_STATUS[task.status] ?? [];

  async function handleStatusChange(status: string) {
    setActionError("");
    try {
      await updateStatus.mutateAsync({ status });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.problem.detail);
      }
    }
  }

  async function handleAccept() {
    setActionError("");
    try {
      await acceptTask.mutateAsync();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.problem.detail);
      }
    }
  }

  async function handleAssign() {
    if (!assigneeId) return;
    setActionError("");
    try {
      await assignTask.mutateAsync({ assigneeId });
      setAssigneeId("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.problem.detail);
      }
    }
  }

  async function handleDelete() {
    setActionError("");
    try {
      await deleteTask.mutateAsync();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.problem.detail);
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px" }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "16px" }}
        >
          <h2 style={{ margin: 0 }}>{task.title}</h2>
          <span className={`badge ${STATUS_BADGE[task.status] ?? ""}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>

        {task.description && (
          <p style={{ color: "var(--color-text-muted)", marginBottom: "16px" }}>
            {task.description}
          </p>
        )}

        {actionError && <div className="alert alert-error">{actionError}</div>}

        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-muted)",
            marginBottom: "16px",
          }}
        >
          <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
          {task.acceptedAt && (
            <div>Accepted: {new Date(task.acceptedAt).toLocaleString()}</div>
          )}
        </div>

        {/* Accept button for assignee */}
        {isAssignee && task.status === "PENDING_ACCEPTANCE" && (
          <button
            className="btn btn-primary btn-block mb-4"
            onClick={handleAccept}
            disabled={acceptTask.isPending}
          >
            {acceptTask.isPending ? "Accepting..." : "Accept Task"}
          </button>
        )}

        {/* Status transitions */}
        {transitions.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Change status</label>
            <div
              className="flex gap-2"
              style={{ flexWrap: "wrap", marginTop: "6px" }}
            >
              {transitions.map((status) => (
                <button
                  key={status}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleStatusChange(status)}
                  disabled={updateStatus.isPending}
                >
                  → {STATUS_LABELS[status] ?? status}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assign (creator only) */}
        {isCreator && (
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Assign task</label>
            <div className="flex gap-2" style={{ marginTop: "6px" }}>
              <select
                className="form-input"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Select member...</option>
                {members
                  .filter((m) => m.userId !== currentUserId)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                    </option>
                  ))}
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAssign}
                disabled={!assigneeId || assignTask.isPending}
              >
                Assign
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex gap-2 justify-between"
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          {isCreator && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
