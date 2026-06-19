import { MAX_LABEL_ROWS } from "@/lib/stitky/constants";

export type LabelRowInput = {
  rowIndex: number;
  quantity?: number | null;
  packSize?: number | null;
  text1?: string | null;
  text2?: string | null;
  text3?: string | null;
  prefix?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  barcodeType?: string | null;
};

export type OrderInput = {
  orderNumber: string;
  templateKey: string;
  notes?: string | null;
  rows: LabelRowInput[];
};

function isDigitsOnly(value: string): boolean {
  return /^\d+$/.test(value);
}

function rowIsActive(row: LabelRowInput): boolean {
  return (
    row.quantity != null ||
    row.packSize != null ||
    Boolean(row.text1?.trim()) ||
    Boolean(row.text2?.trim()) ||
    Boolean(row.text3?.trim()) ||
    Boolean(row.prefix?.trim()) ||
    Boolean(row.rangeFrom?.trim()) ||
    Boolean(row.rangeTo?.trim())
  );
}

/** Přepis S_800_Kontrola_zadani — vrací všechny chyby najednou. */
export function validateOrderInput(input: OrderInput): string[] {
  const errors: string[] = [];

  if (!input.orderNumber?.trim()) {
    errors.push("V buňce B2 chybí zadané Číslo zakázky");
  }

  if (!input.templateKey?.trim()) {
    errors.push("Na řádku 3 ve Sloupci 11, není vybrána šablona pro štítky");
  }

  const activeRows = input.rows.filter(rowIsActive);
  if (activeRows.length === 0) {
    errors.push("Zakázka neobsahuje žádné štítky");
  }

  for (const row of input.rows) {
    if (!rowIsActive(row)) continue;

    const n = row.rowIndex;

    if (row.quantity == null || row.quantity <= 0) {
      errors.push(`Na řádku ${n} chybí zadané Množství`);
      continue;
    }

    if (row.packSize == null || row.packSize <= 0) {
      errors.push(`Na řádku ${n} chybí zadané Balení`);
      continue;
    }

    if (row.quantity < row.packSize) {
      errors.push(`Na řádku ${n} je Množství menší než Počet ks v balení`);
    }

    const hasText =
      Boolean(row.text1?.trim()) || Boolean(row.text2?.trim()) || Boolean(row.text3?.trim());
    if (!hasText) {
      errors.push(`Na řádku ${n} není vyplněn ani jeden Text`);
    }

    const rangeFrom = row.rangeFrom?.trim() ?? "";
    const rangeTo = row.rangeTo?.trim() ?? "";

    if (rangeFrom && !isDigitsOnly(rangeFrom)) {
      errors.push(`Na řádku ${n}: Počátek číselné řady musí obsahovat pouze číslice`);
    }
    if (rangeTo && !isDigitsOnly(rangeTo)) {
      errors.push(`Na řádku ${n}: Konec číselné řady musí obsahovat pouze číslice`);
    }

    if (!rangeFrom && rangeTo) {
      errors.push(`Na řádku ${n} chybí vyplněn Počátek číselné řady`);
    }
    if (rangeFrom && !rangeTo) {
      errors.push(`Na řádku ${n} chybí vyplněn Konec číselné řady`);
    }

    if (rangeFrom && rangeTo) {
      const od = parseInt(rangeFrom, 10);
      const do_ = parseInt(rangeTo, 10);
      if (od > do_) {
        errors.push(`Na řádku ${n} je Konec číselné řady menší než Počátek`);
      } else if (do_ - od + 1 !== row.quantity) {
        errors.push(`Na řádku ${n} neodpovídá zadané MNOŽSTVÍ a ROZSAH ŘADY`);
      }
    }
  }

  return errors;
}

export function normalizeRowsFromForm(raw: LabelRowInput[]): LabelRowInput[] {
  const byIndex = new Map<number, LabelRowInput>();
  for (const row of raw) {
    if (row.rowIndex >= 1 && row.rowIndex <= MAX_LABEL_ROWS) {
      byIndex.set(row.rowIndex, row);
    }
  }
  return Array.from({ length: MAX_LABEL_ROWS }, (_, i) => {
    const idx = i + 1;
    return (
      byIndex.get(idx) ?? {
        rowIndex: idx,
        quantity: null,
        packSize: null,
        text1: null,
        text2: null,
        text3: null,
        prefix: null,
        rangeFrom: null,
        rangeTo: null,
        barcodeType: null,
      }
    );
  });
}

export function activeRowsOnly(rows: LabelRowInput[]): LabelRowInput[] {
  return rows.filter(rowIsActive);
}
