"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────

interface TaskResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  groupId: string;
  createdById: string;
  assigneeId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskListResponse {
  tasks: TaskResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TaskResponse {
  task: TaskResult;
}

// ─── Queries ────────────────────────────────────────────────

export function useGroupTasks(groupId: string, page = 1, limit = 20) {
  return useQuery<TaskListResponse>({
    queryKey: ["tasks", groupId, page, limit],
    queryFn: () =>
      api.get<TaskListResponse>(`/api/v1/groups/${groupId}/tasks`, {
        page,
        limit,
      }),
    enabled: !!groupId,
    staleTime: 15_000,
  });
}

export function useTask(taskId: string) {
  return useQuery<TaskResponse>({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => api.get<TaskResponse>(`/api/v1/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation<
    TaskResponse,
    Error,
    {
      title: string;
      description?: string;
      groupId: string;
      assigneeId?: string;
    }
  >({
    mutationFn: (data) => api.post<TaskResponse>("/api/v1/tasks", data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.groupId],
      });
    },
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    TaskResponse,
    Error,
    { title?: string; description?: string }
  >({
    mutationFn: (data) =>
      api.patch<TaskResponse>(`/api/v1/tasks/${taskId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTaskStatus(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<TaskResponse, Error, { status: string }>({
    mutationFn: (data) =>
      api.patch<TaskResponse>(`/api/v1/tasks/${taskId}/status`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useAcceptTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<TaskResponse, Error, void>({
    mutationFn: () => api.post<TaskResponse>(`/api/v1/tasks/${taskId}/accept`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useAssignTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<TaskResponse, Error, { assigneeId: string }>({
    mutationFn: (data) =>
      api.post<TaskResponse>(`/api/v1/tasks/${taskId}/assign`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () =>
      api.delete<{ message: string }>(`/api/v1/tasks/${taskId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
