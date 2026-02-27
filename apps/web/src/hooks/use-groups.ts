"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────

interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface GroupMember {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string };
  joinedAt: string;
}

interface GroupWithMembers extends GroupResult {
  members: GroupMember[];
}

interface GroupListResponse {
  groups: GroupResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface GroupResponse {
  group: GroupWithMembers;
}

interface CreateGroupResponse {
  group: GroupResult;
}

// ─── Queries ────────────────────────────────────────────────

export function useGroups(page = 1, limit = 20) {
  return useQuery<GroupListResponse>({
    queryKey: ["groups", page, limit],
    queryFn: () =>
      api.get<GroupListResponse>("/api/v1/groups", { page, limit }),
    staleTime: 30_000,
  });
}

export function useGroup(groupId: string) {
  return useQuery<GroupResponse>({
    queryKey: ["groups", groupId],
    queryFn: () => api.get<GroupResponse>(`/api/v1/groups/${groupId}`),
    enabled: !!groupId,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation<
    CreateGroupResponse,
    Error,
    { name: string; description?: string }
  >({
    mutationFn: (data) => api.post<CreateGroupResponse>("/api/v1/groups", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    CreateGroupResponse,
    Error,
    { name?: string; description?: string }
  >({
    mutationFn: (data) =>
      api.patch<CreateGroupResponse>(`/api/v1/groups/${groupId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useAddMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string },
    Error,
    { userId: string; role?: string }
  >({
    mutationFn: (data) =>
      api.post<{ message: string }>(`/api/v1/groups/${groupId}/members`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, { userId: string }>({
    mutationFn: (data) =>
      api.delete<{ message: string }>(
        `/api/v1/groups/${groupId}/members/${data.userId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}
