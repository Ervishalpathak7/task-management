"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
}

interface AuthResponse {
  user: UserProfile;
}

interface MessageResponse {
  message: string;
  verificationToken?: string;
  resetToken?: string;
}

// ─── Queries ────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<AuthResponse>("/api/v1/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useRegister() {
  return useMutation<
    AuthResponse & MessageResponse,
    Error,
    { email: string; password: string; name: string }
  >({
    mutationFn: (data) =>
      api.post<AuthResponse & MessageResponse>("/api/v1/auth/register", data),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, Error, { email: string; password: string }>({
    mutationFn: (data) => api.post<AuthResponse>("/api/v1/auth/login", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<MessageResponse, Error, void>({
    mutationFn: () => api.post<MessageResponse>("/api/v1/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useVerifyEmail() {
  return useMutation<MessageResponse, Error, { token: string }>({
    mutationFn: (data) =>
      api.post<MessageResponse>("/api/v1/auth/verify-email", data),
  });
}

export function useResendVerification() {
  return useMutation<MessageResponse, Error, { email: string }>({
    mutationFn: (data) =>
      api.post<MessageResponse>("/api/v1/auth/resend-verification", data),
  });
}

export function useForgotPassword() {
  return useMutation<MessageResponse, Error, { email: string }>({
    mutationFn: (data) =>
      api.post<MessageResponse>("/api/v1/auth/forgot-password", data),
  });
}

export function useResetPassword() {
  return useMutation<
    MessageResponse,
    Error,
    { token: string; password: string }
  >({
    mutationFn: (data) =>
      api.post<MessageResponse>("/api/v1/auth/reset-password", data),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, Error, { name: string }>({
    mutationFn: (data) => api.patch<AuthResponse>("/api/v1/auth/me", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
