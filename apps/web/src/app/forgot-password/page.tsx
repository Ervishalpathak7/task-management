"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useForgotPassword } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await forgotPassword.mutateAsync({ email });
    setSuccess(true);
  }

  return (
    <div className="auth-layout">
      <div className="auth-card card">
        <h1>Reset password</h1>
        <p>Enter your email to receive a reset link</p>

        {success ? (
          <>
            <div className="alert alert-success">
              If an account exists with that email, a password reset link has
              been sent.
            </div>
            <Link href="/login" className="btn btn-secondary btn-block">
              Back to login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="fp-email">
                Email
              </label>
              <input
                id="fp-email"
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? "Sending..." : "Send reset link"}
            </button>

            <div className="auth-footer">
              <Link href="/login">Back to login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
