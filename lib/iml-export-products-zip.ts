import * as archiverRoot from "archiver";
import { PassThrough } from "stream";
import type { ProductExportAssetFile } from "@/lib/iml-export-products-assets";

type ZipArchiveInstance = {
  pipe: (dest: PassThrough) => void;
  append: (source: string | Buffer, data: { name: string }) => unknown;
  on: (event: "error", listener: (err: Error) => void) => void;
  finalize: () => Promise<void>;
};

function createZipArchive(): ZipArchiveInstance {
  const { ZipArchive } = archiverRoot as unknown as {
    ZipArchive: new (options?: { zlib?: { level?: number } }) => ZipArchiveInstance;
  };
  return new ZipArchive({ zlib: { level: 6 } });
}

export async function buildProductExportZip(input: {
  tableBuffer: Buffer;
  tableFilename: string;
  assets: ProductExportAssetFile[];
  manifest?: {
    exportedAt: string;
    rowCount: number;
    assetCount: number;
    includePrint?: boolean;
    includeSoftproof?: boolean;
  };
}): Promise<{ buffer: Buffer; filename: string }> {
  const stamp = new Date().toISOString().slice(0, 10);
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archive = createZipArchive();
  archive.pipe(pass);

  archive.append(input.tableBuffer, { name: input.tableFilename });

  for (const asset of input.assets) {
    archive.append(asset.buffer, { name: asset.zipPath });
  }

  if (input.manifest) {
    archive.append(JSON.stringify(input.manifest, null, 2), { name: "manifest.json" });
  }

  const done = new Promise<void>((resolve, reject) => {
    pass.on("finish", () => resolve());
    pass.on("error", reject);
    archive.on("error", reject);
  });

  await archive.finalize();
  await done;

  return {
    buffer: Buffer.concat(chunks),
    filename: `iml-produkty-${stamp}.zip`,
  };
}
