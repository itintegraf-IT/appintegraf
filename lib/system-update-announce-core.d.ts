export type ReleaseItem = {
  modules: string[];
  text: string;
};

export type ReleaseNote = {
  id: string;
  date?: string;
  title: string;
  items: ReleaseItem[];
};

export type ReleaseNotesFile = {
  releases: ReleaseNote[];
};

export function validateReleaseNotes(
  value: unknown
): { ok: true; data: ReleaseNotesFile } | { ok: false; error: string };

export function parseReleaseNotesJson(
  raw: string
): { ok: true; data: ReleaseNotesFile } | { ok: false; error: string };

export function rolesGrantModuleRead(
  roles: { name: string | null; module_access: unknown }[],
  module: string
): boolean;

export function userSeesReleaseItem(
  item: ReleaseItem,
  roles: { name: string | null; module_access: unknown }[]
): boolean;

export function buildReleaseMessageForUser(
  release: ReleaseNote,
  roles: { name: string | null; module_access: unknown }[]
): string | null;

export function announcePendingReleases(
  prisma: import("@prisma/client").PrismaClient,
  opts: {
    releases: ReleaseNote[];
    gitSha?: string | null;
    dryRun?: boolean;
    force?: boolean;
    databaseLabel?: string | null;
    log?: (msg: string) => void;
  }
): Promise<{
  announced: { releaseId: string; recipientCount: number }[];
  totalRecipients: number;
  skipped: number;
  zeroRecipientIds?: string[];
}>;
