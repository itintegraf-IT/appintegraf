import { prisma } from "@/lib/db";
import { loadReleaseNotes } from "@/lib/release-notes";
import { announcePendingReleases } from "@/lib/system-update-announce-core.mjs";

export type AnnounceSystemUpdatesOptions = {
  cwd?: string;
  gitSha?: string | null;
  dryRun?: boolean;
  force?: boolean;
  log?: (msg: string) => void;
};

/**
 * Rozešle nezveřejněné položky z data/release-notes.json do zvonku (type system_update).
 * Každý uživatel dostane jen body relevantní k jeho modulům (prázdné modules = globální).
 */
export async function announcePendingSystemUpdates(
  opts: AnnounceSystemUpdatesOptions = {}
) {
  const notes = await loadReleaseNotes(opts.cwd);
  return announcePendingReleases(prisma, {
    releases: notes.releases,
    gitSha: opts.gitSha,
    dryRun: opts.dryRun,
    force: opts.force,
    log: opts.log,
  });
}
