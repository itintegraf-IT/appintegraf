export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_MODULE_IDS = [
  "system",
  "contacts",
  "equipment",
  "calendar",
  "ukoly",
  "personalistika",
  "contracts",
  "planovani",
  "vyroba",
  "iml",
  "materialy",
  "kiosk",
  "training",
  "audit",
] as const;

export type BackupModuleId = (typeof BACKUP_MODULE_IDS)[number];

export type BackupTableSource = "prisma" | "raw";

export type BackupTableDef = {
  /** Název souboru JSON bez přípony (data/{name}.json) */
  name: string;
  source: BackupTableSource;
  /** Prisma model accessor, např. users */
  prismaModel?: string;
  /** SQL název tabulky pro raw dotazy */
  sqlTable?: string;
  /** Sloupce s BLOB – export do blobs/, v JSON reference _blob */
  blobColumns?: string[];
};

export type BackupFileUploadModule = {
  module: string;
  uploadSubdir: string;
};

export type BackupModuleDef = {
  id: BackupModuleId;
  label: string;
  description?: string;
  tables: BackupTableDef[];
  /** file_uploads.module hodnoty v tomto modulu */
  fileUploadModules?: BackupFileUploadModule[];
  /** Relativní podsložky v files/ (mimo file_uploads) */
  extraUploadDirs?: string[];
  dependsOn?: BackupModuleId[];
};

export type BackupManifestTable = {
  name: string;
  rowCount: number;
};

export type BackupManifest = {
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  createdByUserId: number;
  modules: BackupModuleId[];
  tables: BackupManifestTable[];
  warnings: string[];
};

export type BackupExportOptions = {
  modules: BackupModuleId[];
  createdByUserId: number;
};

export type BackupImportOptions = {
  modules: BackupModuleId[];
  zipPath: string;
  userId: number;
};

export type BackupImportResult = {
  ok: boolean;
  modulesRestored: BackupModuleId[];
  errors: string[];
  tablesImported: BackupManifestTable[];
};

export const BLOB_REF_KEY = "_blob";
