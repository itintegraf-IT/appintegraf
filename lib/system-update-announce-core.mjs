/**
 * Sdílené jádro: parse release-notes + rozesílání system_update notifikací.
 * Používá scripts/announce-release.mjs i lib/system-update-notify.ts.
 */

/** @typedef {{ modules: string[], text: string }} ReleaseItem */
/** @typedef {{ id: string, date?: string, title: string, items: ReleaseItem[] }} ReleaseNote */
/** @typedef {{ releases: ReleaseNote[] }} ReleaseNotesFile */

/**
 * @param {unknown} value
 * @returns {{ ok: true, data: ReleaseNotesFile } | { ok: false, error: string }}
 */
export function validateReleaseNotes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Kořen musí být objekt s polem releases." };
  }
  const root = /** @type {Record<string, unknown>} */ (value);
  if (!Array.isArray(root.releases)) {
    return { ok: false, error: "Chybí pole releases (pole)." };
  }

  const seenIds = new Set();
  for (let i = 0; i < root.releases.length; i++) {
    const rel = root.releases[i];
    if (!rel || typeof rel !== "object" || Array.isArray(rel)) {
      return { ok: false, error: `releases[${i}] musí být objekt.` };
    }
    const r = /** @type {Record<string, unknown>} */ (rel);
    if (typeof r.id !== "string" || !r.id.trim()) {
      return { ok: false, error: `releases[${i}].id musí být neprázdný string.` };
    }
    if (seenIds.has(r.id)) {
      return { ok: false, error: `Duplicitní release id: ${r.id}` };
    }
    seenIds.add(r.id);
    if (typeof r.title !== "string" || !r.title.trim()) {
      return { ok: false, error: `releases[${i}].title musí být neprázdný string.` };
    }
    if (r.date != null && typeof r.date !== "string") {
      return { ok: false, error: `releases[${i}].date musí být string nebo vynecháno.` };
    }
    if (!Array.isArray(r.items) || r.items.length === 0) {
      return { ok: false, error: `releases[${i}].items musí být neprázdné pole.` };
    }
    for (let j = 0; j < r.items.length; j++) {
      const item = r.items[j];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { ok: false, error: `releases[${i}].items[${j}] musí být objekt.` };
      }
      const it = /** @type {Record<string, unknown>} */ (item);
      if (typeof it.text !== "string" || !it.text.trim()) {
        return { ok: false, error: `releases[${i}].items[${j}].text musí být neprázdný string.` };
      }
      if (!Array.isArray(it.modules)) {
        return { ok: false, error: `releases[${i}].items[${j}].modules musí být pole stringů (prázdné = globální).` };
      }
      for (const m of it.modules) {
        if (typeof m !== "string" || !m.trim()) {
          return { ok: false, error: `releases[${i}].items[${j}].modules obsahuje neplatnou hodnotu.` };
        }
      }
    }
  }

  return { ok: true, data: /** @type {ReleaseNotesFile} */ (value) };
}

/**
 * @param {string} raw
 * @returns {{ ok: true, data: ReleaseNotesFile } | { ok: false, error: string }}
 */
export function parseReleaseNotesJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `Neplatný JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  return validateReleaseNotes(parsed);
}

function isModuleAccessFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}

function parseModuleAccessJson(raw) {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

function maketyGrantsRead(decoded) {
  const raw = typeof decoded.makety === "string" ? decoded.makety.toLowerCase() : "";
  if (["read", "write", "admin", "vyroba", "grafika"].includes(raw)) return true;
  return (
    isModuleAccessFlag(decoded.makety_vyroba) ||
    isModuleAccessFlag(decoded.makety_grafika) ||
    isModuleAccessFlag(decoded.makety_zadavatel_maketa) ||
    isModuleAccessFlag(decoded.makety_zadavatel_grafika) ||
    isModuleAccessFlag(decoded.makety_schvalovatel_prepress) ||
    isModuleAccessFlag(decoded.makety_schvalovatel_final) ||
    isModuleAccessFlag(decoded.makety_sprava_vzorku) ||
    isModuleAccessFlag(decoded.makety_prohlizec_klienta)
  );
}

function stitkyGrantsRead(decoded) {
  const raw = typeof decoded.stitky === "string" ? decoded.stitky.toLowerCase() : "";
  if (["read", "write", "admin"].includes(raw)) return true;
  return isModuleAccessFlag(decoded.stitky_tiskar) || isModuleAccessFlag(decoded.stitky_mistr);
}

/**
 * @param {{ name: string | null, module_access: unknown }[]} roles
 * @param {string} module
 */
export function rolesGrantModuleRead(roles, module) {
  for (const role of roles) {
    if (role.name?.toLowerCase() === "admin") return true;

    const decoded = parseModuleAccessJson(role.module_access);
    if (decoded == null) continue;

    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const record = /** @type {Record<string, unknown>} */ (decoded);
      if (module === "makety" && maketyGrantsRead(record)) return true;
      if (module === "stitky" && stitkyGrantsRead(record)) return true;

      const perm = record[module];
      if (perm === true) return true;
      if (typeof perm === "string") {
        const p = perm.toLowerCase();
        if (["read", "write", "admin"].includes(p)) return true;
        if (module === "planovani" && p === "tiskar") return true;
      }
    }

    if (Array.isArray(decoded)) {
      const moduleLower = module.toLowerCase();
      for (const item of decoded) {
        if (typeof item !== "string") continue;
        const itemLower = item.toLowerCase().trim();
        if (
          itemLower === moduleLower ||
          itemLower === `${moduleLower}.view` ||
          itemLower === `${moduleLower}.read` ||
          itemLower === `${moduleLower}.write` ||
          itemLower === `${moduleLower}.add` ||
          itemLower === `${moduleLower}.edit` ||
          itemLower === `${moduleLower}.delete`
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * @param {ReleaseItem} item
 * @param {{ name: string | null, module_access: unknown }[]} roles
 */
export function userSeesReleaseItem(item, roles) {
  const modules = (item.modules || [])
    .map((m) => String(m).trim())
    .filter(Boolean)
    .filter((m) => m !== "*");
  if (modules.length === 0) return true;
  return modules.some((m) => rolesGrantModuleRead(roles, m));
}

/**
 * @param {ReleaseNote} release
 * @param {{ name: string | null, module_access: unknown }[]} roles
 * @returns {string | null}
 */
export function buildReleaseMessageForUser(release, roles) {
  const lines = [];
  for (const item of release.items) {
    if (!userSeesReleaseItem(item, roles)) continue;
    lines.push(`• ${item.text.trim()}`);
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   releases: ReleaseNote[],
 *   gitSha?: string | null,
 *   dryRun?: boolean,
 *   force?: boolean,
 *   databaseLabel?: string | null,
 *   log?: (msg: string) => void,
 * }} opts
 */
export async function announcePendingReleases(prisma, opts) {
  const log = opts.log || (() => {});
  const dryRun = Boolean(opts.dryRun);
  const force = Boolean(opts.force);
  const gitSha = opts.gitSha?.slice(0, 64) || null;

  if (opts.databaseLabel) {
    log(`Databáze: ${opts.databaseLabel}`);
  }

  const releaseIds = opts.releases.map((r) => r.id);

  if (force && releaseIds.length > 0 && !dryRun) {
    const deleted = await prisma.system_release_announcements.deleteMany({
      where: { release_id: { in: releaseIds } },
    });
    log(`--force: smazáno ${deleted.count} záznam(ů) idempotence.`);
  } else if (force && dryRun) {
    log("--force (dry-run): idempotence by se smazala před odesláním.");
  }

  const already = await prisma.system_release_announcements.findMany({
    select: { release_id: true },
  });
  const announced = new Set(already.map((r) => r.release_id));

  const pending = opts.releases.filter((r) => !announced.has(r.id));
  if (pending.length === 0) {
    log("Žádné nové release k oznámení.");
    return { announced: [], totalRecipients: 0, skipped: opts.releases.length };
  }

  const users = await prisma.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }] },
    select: {
      id: true,
      role_id: true,
      user_roles: { select: { module_access: true, roles: { select: { name: true } } } },
      roles: { select: { name: true, permissions: true } },
    },
  });

  log(`Aktivní uživatelé: ${users.length}; pending release: ${pending.map((r) => r.id).join(", ")}`);

  /** @type {Map<number, { name: string | null, module_access: unknown }[]>} */
  const rolesByUser = new Map();
  for (const u of users) {
    if (u.user_roles.length > 0) {
      rolesByUser.set(
        u.id,
        u.user_roles.map((ur) => ({
          name: ur.roles.name,
          module_access: ur.module_access,
        }))
      );
    } else if (u.roles) {
      rolesByUser.set(u.id, [
        { name: u.roles.name, module_access: u.roles.permissions },
      ]);
    } else {
      rolesByUser.set(u.id, []);
    }
  }

  /** @type {{ releaseId: string, recipientCount: number }[]} */
  const results = [];
  let totalRecipients = 0;
  /** @type {string[]} */
  const zeroRecipientIds = [];

  for (const release of pending) {
    /** @type {{ user_id: number, title: string, message: string, type: string, link: string | null }[]} */
    const rows = [];
    for (const u of users) {
      const roles = rolesByUser.get(u.id) || [];
      const message = buildReleaseMessageForUser(release, roles);
      if (!message) continue;
      rows.push({
        user_id: u.id,
        title: release.title.trim().slice(0, 255),
        message,
        type: "system_update",
        link: "/",
      });
    }

    log(`Release ${release.id}: ${rows.length} příjemců${dryRun ? " (dry-run)" : ""}`);

    if (rows.length === 0) {
      zeroRecipientIds.push(release.id);
      log(
        `Release ${release.id}: 0 příjemců — idempotence se NEUKLÁDÁ (zkuste znovu / zkontrolujte uživatele).`
      );
      continue;
    }

    if (!dryRun) {
      await prisma.notifications.createMany({ data: rows });
      await prisma.system_release_announcements.create({
        data: {
          release_id: release.id,
          git_sha: gitSha,
          recipient_count: rows.length,
        },
      });
    }

    results.push({ releaseId: release.id, recipientCount: rows.length });
    totalRecipients += rows.length;
  }

  if (zeroRecipientIds.length > 0 && results.length === 0) {
    const err = new Error(
      `Žádní příjemci pro release: ${zeroRecipientIds.join(", ")} (aktivních uživatelů: ${users.length}).`
    );
    /** @type {Error & { code?: string }} */ (err).code = "NO_RECIPIENTS";
    throw err;
  }

  return {
    announced: results,
    totalRecipients,
    skipped: announced.size,
    zeroRecipientIds,
  };
}
