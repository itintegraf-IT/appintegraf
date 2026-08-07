import {
  BACKUP_MODULE_IDS,
  type BackupModuleDef,
  type BackupModuleId,
  type BackupTableDef,
} from "@/lib/backup/types";

const prisma = (name: string, blobColumns?: string[]): BackupTableDef => ({
  name,
  source: "prisma",
  prismaModel: name,
  blobColumns,
});

const raw = (name: string, sqlTable?: string): BackupTableDef => ({
  name,
  source: "raw",
  sqlTable: sqlTable ?? name,
});

export const BACKUP_MODULES: Record<BackupModuleId, BackupModuleDef> = {
  system: {
    id: "system",
    label: "Systém",
    description: "Uživatelé, role, oddělení, nastavení, typy smluv",
    tables: [
      prisma("roles"),
      prisma("departments"),
      prisma("users"),
      prisma("user_roles"),
      prisma("user_secondary_departments"),
      prisma("system_settings"),
      prisma("shared_mails"),
      prisma("user_shared_mails"),
      prisma("calendar_department_approvers"),
      prisma("resource_vehicle_approvers"),
      prisma("contract_types"),
      prisma("contract_workflow_steps"),
    ],
  },
  contacts: {
    id: "contacts",
    label: "Kontakty",
    description: "Tagy a importy kontaktů (uživatelé jsou v modulu Systém)",
    dependsOn: ["system"],
    tables: [prisma("contact_tags"), prisma("person_tags"), prisma("contact_imports")],
  },
  equipment: {
    id: "equipment",
    label: "Majetek",
    dependsOn: ["system"],
    tables: [
      prisma("equipment_categories"),
      prisma("equipment_rooms"),
      prisma("equipment_floor_plans"),
      prisma("equipment_items"),
      prisma("equipment_user_category_access"),
      prisma("equipment_location_history"),
      prisma("equipment_qr_pool"),
      prisma("equipment_inventories"),
      prisma("equipment_inventory_lines"),
      prisma("equipment_assignments"),
      prisma("equipment_transfers"),
      prisma("equipment_requests"),
      prisma("equipment_request_workflow_log"),
      prisma("helpdesk_tickets"),
      prisma("helpdesk_comments"),
      prisma("file_uploads"),
    ],
    extraUploadDirs: ["equipment"],
  },
  calendar: {
    id: "calendar",
    label: "Kalendář",
    dependsOn: ["system"],
    tables: [
      prisma("calendar_events"),
      prisma("calendar_event_participants"),
      prisma("calendar_approvals"),
      prisma("calendar_resources"),
      prisma("resource_reservations"),
      prisma("user_deputies"),
    ],
  },
  ukoly: {
    id: "ukoly",
    label: "Úkoly",
    dependsOn: ["system"],
    tables: [prisma("ukoly"), prisma("ukoly_departments")],
    extraUploadDirs: ["ukoly"],
  },
  makety: {
    id: "makety",
    label: "Makety a grafika",
    dependsOn: ["system"],
    tables: [prisma("makety"), prisma("makety_departments"), prisma("makety_comments")],
    fileUploadModules: [{ module: "makety", uploadSubdir: "makety" }],
  },
  personalistika: {
    id: "personalistika",
    label: "Personalistika",
    dependsOn: ["system"],
    tables: [
      raw("hr_positions"),
      raw("hr_candidate_applications"),
      raw("hr_part_timers"),
      prisma("file_uploads"),
    ],
    fileUploadModules: [{ module: "personalistika", uploadSubdir: "personalistika" }],
    extraUploadDirs: ["personalistika-public"],
  },
  contracts: {
    id: "contracts",
    label: "Evidence smluv",
    dependsOn: ["system"],
    tables: [prisma("contracts"), prisma("contract_approvals"), prisma("file_uploads")],
    fileUploadModules: [{ module: "contracts", uploadSubdir: "contracts" }],
  },
  planovani: {
    id: "planovani",
    label: "Plánování výroby",
    dependsOn: ["system"],
    tables: [
      prisma("planovani_codebook_options"),
      prisma("planovani_company_days"),
      prisma("planovani_machine_work_hours"),
      prisma("planovani_machine_schedule_exceptions"),
      prisma("planovani_blocks"),
      prisma("planovani_audit_log"),
    ],
  },
  vyroba: {
    id: "vyroba",
    label: "Výroba",
    description: "Pouze databáze – soubory na síťové cestě VYROBA_OUTPUT_PATH nejsou součástí zálohy",
    dependsOn: ["system"],
    tables: [
      prisma("vyroba_settings"),
      prisma("vyroba_job_config"),
      prisma("vyroba_employees"),
      prisma("vyroba_box_state"),
      prisma("vyroba_audit"),
    ],
  },
  materialy: {
    id: "materialy",
    label: "Katalog materiálů",
    tables: [
      prisma("material_categories"),
      prisma("material_subcategories"),
      prisma("materials"),
      prisma("file_uploads"),
    ],
    fileUploadModules: [{ module: "materialy", uploadSubdir: "materialy" }],
  },
  iml: {
    id: "iml",
    label: "IML",
    dependsOn: ["system", "materialy"],
    tables: [
      prisma("iml_pantone_colors"),
      prisma("iml_foils"),
      prisma("iml_box_types"),
      prisma("iml_die_cuts"),
      prisma("iml_custom_fields"),
      prisma("iml_customers"),
      prisma("iml_customer_emails"),
      prisma("iml_customer_contacts"),
      prisma("iml_customer_shipping_addresses"),
      prisma("iml_products", ["image_data", "pdf_data"]),
      prisma("iml_product_colors"),
      prisma("iml_product_files", ["pdf_data"]),
      prisma("iml_inquiries"),
      prisma("iml_inquiry_items"),
      prisma("iml_orders"),
      prisma("iml_order_items"),
      prisma("file_uploads"),
    ],
    fileUploadModules: [{ module: "iml_customers", uploadSubdir: "iml-customers" }],
  },
  kiosk: {
    id: "kiosk",
    label: "Kiosk monitory",
    tables: [prisma("presentations"), prisma("slides")],
    extraUploadDirs: ["kiosk"],
  },
  training: {
    id: "training",
    label: "IT školení",
    dependsOn: ["system"],
    tables: [
      prisma("question_categories"),
      prisma("questions"),
      prisma("question_imports"),
      prisma("learning_materials"),
      prisma("user_groups"),
      prisma("user_group_members"),
      prisma("tests"),
      prisma("test_questions"),
      prisma("test_assignments"),
      prisma("test_attempts"),
      prisma("test_answers"),
    ],
  },
  audit: {
    id: "audit",
    label: "Audit log",
    description: "Může být velmi rozsáhlý",
    tables: [prisma("audit_log")],
  },
};

export function getModuleDef(id: BackupModuleId): BackupModuleDef {
  return BACKUP_MODULES[id];
}

export function getAllModuleDefs(): BackupModuleDef[] {
  return BACKUP_MODULE_IDS.map((id) => BACKUP_MODULES[id]);
}

export function normalizeModuleIds(input: string[]): BackupModuleId[] {
  const set = new Set<BackupModuleId>();
  for (const id of input) {
    if ((BACKUP_MODULE_IDS as readonly string[]).includes(id)) {
      set.add(id as BackupModuleId);
    }
  }
  return [...set];
}

/** Tabulky v pořadí pro import (závislosti FK) */
export function getTablesForModules(modules: BackupModuleId[]): BackupTableDef[] {
  const seen = new Set<string>();
  const result: BackupTableDef[] = [];
  for (const modId of modules) {
    const mod = BACKUP_MODULES[modId];
    for (const table of mod.tables) {
      if (table.name === "file_uploads") {
        if (seen.has("file_uploads")) continue;
      }
      if (!seen.has(table.name)) {
        seen.add(table.name);
        result.push(table);
      }
    }
  }
  return result;
}

/** Pořadí pro mazání (opačné importu) */
export function getTablesForDelete(modules: BackupModuleId[]): BackupTableDef[] {
  return [...getTablesForModules(modules)].reverse();
}

export function getModuleWarnings(selected: BackupModuleId[]): string[] {
  const warnings: string[] = [];
  const set = new Set(selected);
  for (const modId of selected) {
    const mod = BACKUP_MODULES[modId];
    for (const dep of mod.dependsOn ?? []) {
      if (!set.has(dep)) {
        warnings.push(
          `Modul „${mod.label}“ obvykle vyžaduje také „${BACKUP_MODULES[dep].label}“ (${dep}).`
        );
      }
    }
  }
  if (selected.includes("vyroba")) {
    warnings.push(
      "Modul Výroba nezálohuje generované CSV/TXT na síťové cestě VYROBA_OUTPUT_PATH."
    );
  }
  return warnings;
}

export function getFileUploadModulesForExport(
  modules: BackupModuleId[]
): { module: string; uploadSubdir: string }[] {
  const out: { module: string; uploadSubdir: string }[] = [];
  const seen = new Set<string>();
  for (const modId of modules) {
    for (const fu of BACKUP_MODULES[modId].fileUploadModules ?? []) {
      if (!seen.has(fu.module)) {
        seen.add(fu.module);
        out.push(fu);
      }
    }
  }
  return out;
}

export function getExtraUploadDirs(modules: BackupModuleId[]): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();
  for (const modId of modules) {
    for (const d of BACKUP_MODULES[modId].extraUploadDirs ?? []) {
      if (!seen.has(d)) {
        seen.add(d);
        dirs.push(d);
      }
    }
  }
  return dirs;
}

export function moduleIncludesTable(
  modules: BackupModuleId[],
  tableName: string
): boolean {
  return getTablesForModules(modules).some((t) => t.name === tableName);
}

export function getFileUploadFilterForModule(
  modId: BackupModuleId
): string[] | null {
  const mods = BACKUP_MODULES[modId].fileUploadModules?.map((f) => f.module) ?? [];
  return mods.length > 0 ? mods : null;
}
