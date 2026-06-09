import type { GraphMessage } from "./mail-delta";

export interface ParsedMessage {
  externalId: string;
  direction: "incoming" | "outgoing";
  date: Date;
  subject: string;
  preview: string;
  fromEmail: string;
  fromName?: string;
  recipientEmails: string[];
}

const NOREPLY_PATTERNS = [/^noreply@/i, /^no-reply@/i, /^notifications?@/i, /^donotreply@/i, /^mailer-daemon@/i];

export function parseMessageToActivity(msg: GraphMessage, mailboxEmail: string): ParsedMessage | null {
  if (msg.isDraft) return null;

  const fromEmail = msg.from?.emailAddress?.address?.toLowerCase();
  if (!fromEmail) return null;

  if (NOREPLY_PATTERNS.some((re) => re.test(fromEmail))) return null;

  const headers = msg.internetMessageHeaders ?? [];
  const headerMap = new Map(headers.map((h) => [h.name.toLowerCase(), h.value]));
  if (headerMap.has("list-unsubscribe")) return null;
  const autoSubmitted = headerMap.get("auto-submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return null;
  if (headerMap.has("x-auto-response-suppress")) return null;

  const dateStr = msg.sentDateTime ?? msg.receivedDateTime;
  if (!dateStr) return null;

  const recipients = [...(msg.toRecipients ?? []), ...(msg.ccRecipients ?? [])]
    .map((r) => r.emailAddress?.address?.toLowerCase())
    .filter((a): a is string => Boolean(a));

  const mailbox = mailboxEmail.toLowerCase();
  const direction: "incoming" | "outgoing" = fromEmail === mailbox ? "outgoing" : "incoming";

  return {
    externalId: msg.internetMessageId ?? msg.id,
    direction,
    date: new Date(dateStr),
    subject: msg.subject ?? "(bez předmětu)",
    preview: msg.bodyPreview ?? "",
    fromEmail,
    fromName: msg.from?.emailAddress?.name,
    recipientEmails: recipients,
  };
}
