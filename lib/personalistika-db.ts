import { prisma } from "@/lib/db";

let initPromise: Promise<void> | null = null;

async function addColumnIfMissing(table: string, column: string, ddl: string): Promise<void> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    table,
    column
  )) as { cnt: number }[];
  const exists = Number(rows[0]?.cnt ?? 0) > 0;
  if (!exists) {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export type CandidateApplicationStatus =
  | "new"
  | "in_review"
  | "invited"
  | "rejected"
  | "accepted";

export type CandidateSource = "kiosk" | "web" | "internal";

export type CandidateApplicationRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position_id: number | null;
  position_name: string | null;
  notes: string | null;
  status: CandidateApplicationStatus;
  source: CandidateSource;
  valid_from: Date | null;
  valid_to: Date | null;
  submitted_by_user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CandidatePositionRow = {
  id: number;
  name: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export async function ensurePersonalistikaTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS hr_positions (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(150) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_hr_positions_name (name),
          KEY idx_hr_positions_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS hr_candidate_applications (
          id INT NOT NULL AUTO_INCREMENT,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(150) NOT NULL,
          phone VARCHAR(40) NULL,
          position_id INT NULL,
          position_name VARCHAR(150) NULL,
          notes TEXT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'new',
          source VARCHAR(20) NOT NULL DEFAULT 'web',
          valid_from DATE NULL,
          valid_to DATE NULL,
          submitted_by_user_id INT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent TEXT NULL,
          details_json LONGTEXT NULL,
          consent_given TINYINT(1) NOT NULL DEFAULT 0,
          consent_date DATE NULL,
          attachment_path VARCHAR(500) NULL,
          attachment_original_name VARCHAR(255) NULL,
          attachment_mime VARCHAR(100) NULL,
          attachment_size INT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_hr_candidate_status (status),
          KEY idx_hr_candidate_created (created_at),
          KEY idx_hr_candidate_position_id (position_id),
          CONSTRAINT fk_hr_candidate_position FOREIGN KEY (position_id) REFERENCES hr_positions (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await addColumnIfMissing("hr_candidate_applications", "details_json", "details_json LONGTEXT NULL");
      await addColumnIfMissing("hr_candidate_applications", "consent_given", "consent_given TINYINT(1) NOT NULL DEFAULT 0");
      await addColumnIfMissing("hr_candidate_applications", "consent_date", "consent_date DATE NULL");
      await addColumnIfMissing("hr_candidate_applications", "attachment_path", "attachment_path VARCHAR(500) NULL");
      await addColumnIfMissing("hr_candidate_applications", "attachment_original_name", "attachment_original_name VARCHAR(255) NULL");
      await addColumnIfMissing("hr_candidate_applications", "attachment_mime", "attachment_mime VARCHAR(100) NULL");
      await addColumnIfMissing("hr_candidate_applications", "attachment_size", "attachment_size INT NULL");
    })();
  }
  await initPromise;
}

export function normalizeCandidateStatus(input: string | null | undefined): CandidateApplicationStatus {
  const val = String(input ?? "").trim().toLowerCase();
  if (val === "in_review") return "in_review";
  if (val === "invited") return "invited";
  if (val === "rejected") return "rejected";
  if (val === "accepted") return "accepted";
  return "new";
}

export function normalizeCandidateSource(input: string | null | undefined): CandidateSource {
  const val = String(input ?? "").trim().toLowerCase();
  if (val === "kiosk") return "kiosk";
  if (val === "internal") return "internal";
  return "web";
}
