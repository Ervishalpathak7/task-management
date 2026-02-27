import { getLogger } from "../lib/logger.js";

// ─── Provider-agnostic interface ────────────────────────────

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
}

// ─── Console provider (dev/test — logs emails to stdout) ────

export class ConsoleEmailProvider implements EmailProvider {
  send(payload: EmailPayload): Promise<void> {
    const logger = getLogger();
    logger.info(
      {
        to: payload.to,
        subject: payload.subject,
        textLength: payload.text.length,
      },
      "EMAIL SENT (console provider)",
    );
    logger.debug({ emailBody: payload.text }, "Email body");
    return Promise.resolve();
  }
}

// ─── Noop provider (when ENABLE_EMAIL is off) ───────────────

export class NoopEmailProvider implements EmailProvider {
  send(_payload: EmailPayload): Promise<void> {
    // Intentionally does nothing
    return Promise.resolve();
  }
}

// ─── Factory ────────────────────────────────────────────────

let _provider: EmailProvider | undefined;

export function initEmailProvider(type: "console" | "noop"): void {
  switch (type) {
    case "console":
      _provider = new ConsoleEmailProvider();
      break;
    case "noop":
      _provider = new NoopEmailProvider();
      break;
  }
}

export function getEmailProvider(): EmailProvider {
  if (!_provider) {
    throw new Error(
      "Email provider not initialized. Call initEmailProvider() first.",
    );
  }
  return _provider;
}
