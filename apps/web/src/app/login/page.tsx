"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await login.mutateAsync({ email, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.problem.detail);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card card">
        <h1>Welcome back</h1>
        <p>Sign in to your account</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={login.isPending}
          >
            {login.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/forgot-password">Forgot password?</Link>
          <div className="mt-2">
            Don&apos;t have an account? <Link href="/register">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
