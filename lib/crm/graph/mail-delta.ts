import { graphFetch } from "./client";
import { getGraphPageSize } from "./config";

export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  sender?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  isDraft?: boolean;
  conversationId?: string;
}

interface DeltaResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface DeltaResult {
  messages: GraphMessage[];
  newDeltaLink: string | null;
}

const BASE = "https://graph.microsoft.com/v1.0";
const SELECT_INBOX =
  "id,internetMessageId,subject,bodyPreview,receivedDateTime,from,toRecipients,ccRecipients,internetMessageHeaders,isDraft,conversationId";
const SELECT_SENT =
  "id,internetMessageId,subject,bodyPreview,sentDateTime,from,sender,toRecipients,ccRecipients,internetMessageHeaders,conversationId";

export async function fetchInboxDelta(userId: number, deltaLink: string | null): Promise<DeltaResult> {
  const pageSize = getGraphPageSize();
  const startUrl =
    deltaLink ??
    `${BASE}/me/mailFolders/inbox/messages/delta?$select=${SELECT_INBOX}&$top=${pageSize}`;
  return fetchDeltaPages(userId, startUrl);
}

export async function fetchSentDelta(userId: number, deltaLink: string | null): Promise<DeltaResult> {
  const pageSize = getGraphPageSize();
  const startUrl =
    deltaLink ??
    `${BASE}/me/mailFolders/SentItems/messages/delta?$select=${SELECT_SENT}&$top=${pageSize}`;
  return fetchDeltaPages(userId, startUrl);
}

async function fetchDeltaPages(userId: number, firstUrl: string): Promise<DeltaResult> {
  const messages: GraphMessage[] = [];
  let nextUrl: string | null = firstUrl;
  let deltaLink: string | null = null;
  let pageCount = 0;
  const MAX_PAGES = 20;

  while (nextUrl && pageCount < MAX_PAGES) {
    const page: DeltaResponse = await graphFetch<DeltaResponse>(userId, nextUrl);
    messages.push(...page.value);
    nextUrl = page["@odata.nextLink"] ?? null;
    deltaLink = page["@odata.deltaLink"] ?? deltaLink;
    pageCount++;
  }

  return { messages, newDeltaLink: deltaLink };
}
