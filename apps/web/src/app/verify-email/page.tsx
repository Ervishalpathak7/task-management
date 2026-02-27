"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useVerifyEmail, useResendVerification } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const verifyEmail = useVerifyEmail();
  const resend = useResendVerification();
  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "idle"
  >("idle");
  const [error, setError] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setStatus("verifying");
      verifyEmail.mutate(
        { token },
        {
          onSuccess: () => setStatus("success"),
          onError: (err: Error) => {
            setStatus("error");
            if (err instanceof ApiError) {
              setError(err.problem.detail);
            } else {
              setError("Verification failed");
            }
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleResend() {
    if (!resendEmail) return;
    try {
      await resend.mutateAsync({ email: resendEmail });
      setResendSuccess(true);
    } catch {
      setError("Failed to resend verification email");
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card card">
        {status === "verifying" && (
          <>
            <h1>Verifying email...</h1>
            <div
              className="loading-page"
              style={{ minHeight: "auto", padding: "24px 0" }}
            >
              <div className="spinner" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <h1>Email verified!</h1>
            <p>Your email has been verified. You can now sign in.</p>
            <Link href="/login" className="btn btn-primary btn-block">
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1>Verification failed</h1>
            <div className="alert alert-error">{error}</div>
            <p>The link may have expired. Request a new one below.</p>
          </>
        )}

        {(status === "idle" || status === "error") && (
          <div className="mt-4">
            <h2
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                marginBottom: "12px",
                color: "var(--color-text-heading)",
              }}
            >
              Resend verification
            </h2>
            {resendSuccess ? (
              <div className="alert alert-success">
                If an unverified account exists, a new verification email has
                been sent.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <input
                    className="form-input"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleResend}
                  disabled={resend.isPending || !resendEmail}
                >
                  {resend.isPending
                    ? "Sending..."
                    : "Resend verification email"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
