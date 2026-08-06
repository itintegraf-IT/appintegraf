import { join } from "path";

export type DefaultPaletovkaTemplate = {
  fixtureFile: string;
  displayName: string;
  sourceFilename: string;
};

export const DEFAULT_PALETOVKA_TEMPLATES: DefaultPaletovkaTemplate[] = [
  {
    fixtureFile: "5p-agency-obalky.xls",
    displayName: "5 P Agency – Obálky",
    sourceFilename: "5p-agency-obalky.xls",
  },
  {
    fixtureFile: "aca-1213.xls",
    displayName: "ACA 1213",
    sourceFilename: "aca-1213.xls",
  },
  {
    fixtureFile: "106-production.xls",
    displayName: "106 Production",
    sourceFilename: "106-production.xls",
  },
  {
    fixtureFile: "astron.xls",
    displayName: "ASTRON",
    sourceFilename: "astron.xls",
  },
];

export function getDefaultTemplateFixturePath(fixtureFile: string): string {
  return join(process.cwd(), "lib", "stitky", "paletovky", "fixtures", fixtureFile);
}
