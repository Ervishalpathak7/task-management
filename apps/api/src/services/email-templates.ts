import type { EmailPayload } from "./email.service.js";

const APP_NAME = "Task Management";

export function verificationEmail(
  to: string,
  token: string,
  baseUrl: string,
): EmailPayload {
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `${APP_NAME} — Verify your email`,
    text: [
      `Welcome to ${APP_NAME}!`,
      "",
      "Please verify your email address by clicking the link below:",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours.",
      "",
      "If you did not create an account, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <h2>Welcome to ${APP_NAME}!</h2>
      <p>Please verify your email address by clicking the button below:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Verify Email</a></p>
      <p style="color:#666;font-size:14px;">This link expires in 24 hours.</p>
      <p style="color:#666;font-size:14px;">If you did not create an account, you can safely ignore this email.</p>
    `,
  };
}

export function passwordResetEmail(
  to: string,
  token: string,
  baseUrl: string,
): EmailPayload {
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `${APP_NAME} — Reset your password`,
    text: [
      "You requested a password reset.",
      "",
      "Click the link below to set a new password:",
      "",
      resetUrl,
      "",
      "This link expires in 15 minutes.",
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <h2>Password Reset</h2>
      <p>Click the button below to set a new password:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a></p>
      <p style="color:#666;font-size:14px;">This link expires in 15 minutes.</p>
      <p style="color:#666;font-size:14px;">If you did not request this, you can safely ignore this email.</p>
    `,
  };
}

export function taskAssignmentEmail(
  to: string,
  assignerName: string,
  taskTitle: string,
  taskId: string,
  baseUrl: string,
): EmailPayload {
  const taskUrl = `${baseUrl}/dashboard/groups?task=${encodeURIComponent(taskId)}`;
  return {
    to,
    subject: `${APP_NAME} — You've been assigned a task`,
    text: [
      `${assignerName} assigned you a task: "${taskTitle}"`,
      "",
      "View and accept the task:",
      "",
      taskUrl,
      "",
      "You must accept the task before it becomes active.",
    ].join("\n"),
    html: `
      <h2>New Task Assignment</h2>
      <p><strong>${assignerName}</strong> assigned you a task: <strong>${taskTitle}</strong></p>
      <p><a href="${taskUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Task</a></p>
      <p style="color:#666;font-size:14px;">You must accept the task before it becomes active.</p>
    `,
  };
}
