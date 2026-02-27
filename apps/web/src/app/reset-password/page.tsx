"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useResetPassword } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const resetPassword = useResetPassword();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, password });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.problem.detail);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-card card">
          <h1>Password reset!</h1>
          <p>
            Your password has been reset. You can now sign in with your new
            password.
          </p>
          <Link href="/login" className="btn btn-primary btn-block">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card card">
        <h1>Set new password</h1>
        <p>Enter your new password below</p>

        {error && <div className="alert alert-error">{error}</div>}

        {!token && (
          <div className="alert alert-error">
            No reset token found. Please{" "}
            <Link href="/forgot-password">request a new reset link</Link>.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="rp-password">
              New password
            </label>
            <input
              id="rp-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rp-confirm">
              Confirm password
            </label>
            <input
              id="rp-confirm"
              className="form-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Retype password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={resetPassword.isPending || !token}
          >
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
