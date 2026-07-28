import { describe, expect, it } from "vitest";
import {
  autoMapMaterialColumns,
  autoMapQuestionColumns,
  buildMaterialsFromCsv,
  buildQuestionsFromCsv,
  groupMaterials,
  parseCorrectAnswers,
  parseCsvRaw,
  parseQuestionsCsv,
  QUESTIONS_CSV_TEMPLATE,
} from "@/lib/training/csv-import";

describe("parseQuestionsCsv", () => {
  it("naparsuje šablonu bez chyb", () => {
    const result = parseQuestionsCsv(QUESTIONS_CSV_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      category: "BEZP",
      correct_answer: "A",
      correct_answers: "A",
      difficulty: "snadn_",
    });
    expect(result.rows[1].correct_answers).toBe("A,B");
  });

  it("podporuje čárku jako oddělovač a BOM", () => {
    const csv =
      "\uFEFFkategorie,otazka,moznost_a,moznost_b,spravna_odpoved\n" +
      "IT,Otázka?,Ano,Ne,B\n";
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].correct_answer).toBe("B");
    expect(result.rows[0].option_c).toBeNull();
  });

  it("hlásí chybějící povinné sloupce v hlavičce", () => {
    const result = parseQuestionsCsv("otazka;moznost_a\nNěco;Ano\n");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain("mapování");
  });

  it("validuje jednotlivé řádky a čísluje je podle souboru", () => {
    const csv = [
      "kategorie;otazka;moznost_a;moznost_b;moznost_c;moznost_d;spravna_odpoved;obtiznost",
      ";Chybí kategorie;A;B;;;A;",
      "IT;Správná je C, ale C chybí;A;B;;;C;",
      "IT;Neznámá obtížnost;A;B;;;A;extrémní",
      "IT;Validní řádek;A;B;C;;C;těžká",
    ].join("\n");
    const result = parseQuestionsCsv(csv);
    expect(result.totalRows).toBe(4);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].line).toBe(5);
    expect(result.rows[0].difficulty).toBe("t__k_");
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toMatchObject({ line: 2 });
    expect(result.errors[1].message).toContain("možnost C je prázdná");
    expect(result.errors[2].message).toContain("obtížnost");
  });

  it("zvládá uvozovky s oddělovačem uvnitř hodnoty", () => {
    const csv =
      "kategorie;otazka;moznost_a;moznost_b;spravna_odpoved;vysvetleni\n" +
      'IT;"Otázka; se středníkem";Ano;Ne;A;"Vysvětlení s ""uvozovkami"""\n';
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].question).toBe("Otázka; se středníkem");
    expect(result.rows[0].explanation).toBe('Vysvětlení s "uvozovkami"');
  });
});

describe("parseCorrectAnswers", () => {
  it("normalizuje různé zápisy více odpovědí", () => {
    expect(parseCorrectAnswers("A")).toEqual(["A"]);
    expect(parseCorrectAnswers("A, B")).toEqual(["A", "B"]);
    expect(parseCorrectAnswers("d,b")).toEqual(["B", "D"]);
    expect(parseCorrectAnswers("B;D")).toEqual(["B", "D"]);
    expect(parseCorrectAnswers("A,A")).toEqual(["A"]);
  });

  it("odmítne neplatné hodnoty", () => {
    expect(parseCorrectAnswers("")).toBeNull();
    expect(parseCorrectAnswers("E")).toBeNull();
    expect(parseCorrectAnswers("A,X")).toBeNull();
  });
});

describe("formát vzorových souborů uživatele", () => {
  it("čárkový soubor s posunutou hlavičkou (ID sloupec bez hlavičky) a multi-odpověďmi", () => {
    // Napodobuje IT_Bezpecnost_Testove_Otazky_150.csv: hlavička 8 sloupců, data 9
    const csv = [
      "Okruh,Otazka,Moznost_a,Moznost_b,Moznost_c,Možnost_d,Spravna_odpoved,Vysvetleni",
      '1,Phishing,Co je to phishing?,Metoda soc. inženýrství,Napadení firewallu,Šifrování dat,Skenování serveru,A,"Phishing je podvodná technika."',
      '2,Phishing,Typické znaky phishingu? (2 správné),Naléhavá výzva,Podezřelá adresa,Oficiální podpis,Bez odkazů,"A, B",Časový tlak a falešný odesílatel.',
    ].join("\n");

    const raw = parseCsvRaw(csv)!;
    const mapping = autoMapQuestionColumns(raw);
    // Posun o +1 kvůli ID sloupci v datech
    expect(mapping.category).toBe(1);
    expect(mapping.question).toBe(2);
    expect(mapping.correct_answer).toBe(7);

    const result = buildQuestionsFromCsv(raw, mapping);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].category).toBe("Phishing");
    expect(result.rows[1].correct_answers).toBe("A,B");
    expect(result.rows[1].correct_answer).toBe("A");
  });

  it("středníkový soubor s multi-odpověďmi bez uvozovek", () => {
    // Napodobuje test_it_bezpecnost_nahodne.csv
    const csv = [
      "Kategorie;Otazka;Moznost_a;Moznost_b;Moznost_C;Moznost_d;Spravna_odpoved",
      "Phishing;Jak poznáte phishing?;Logo firmy;Tlak na akci;Pracovní doba;Neobvyklý odesílatel;B,D",
    ].join("\n");
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].correct_answers).toBe("B,D");
  });

  it("víceřádkové hodnoty v uvozovkách", () => {
    const csv =
      "kategorie;otazka;moznost_a;moznost_b;spravna_odpoved\n" +
      'IT;"Otázka\npřes dva řádky";Ano;Ne;A\n' +
      "IT;Druhá otázka;Ano;Ne;B\n";
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].question).toBe("Otázka\npřes dva řádky");
  });
});

describe("import materiálů", () => {
  const materialCsv = [
    "ID,Okruh,Téma / Kapitola,Klíčový pojem / Pravidlo,Podrobné vysvětlení,Praktický příklad",
    "1,Phishing,Co je Phishing,Phishing (Rybáření),Podvodná technika…,Falešný e-mail z banky.",
    "2,Phishing,Typy phishingu,Spear Phishing,Cílený útok…,E-mail pro účetní.",
    "3,Ransomware,Co je Ransomware,Šifrovací malware,Zašifruje soubory…,Přípona .locked.",
  ].join("\n");

  it("automaticky namapuje sloupce (ID mimo obsah)", () => {
    const raw = parseCsvRaw(materialCsv)!;
    const mapping = autoMapMaterialColumns(raw);
    expect(mapping.category).toBe(1);
    expect(mapping.title).toBe(2);
    expect(mapping.content).toEqual([3, 4, 5]);
  });

  it("sestaví materiály po řádcích s popisky sloupců", () => {
    const raw = parseCsvRaw(materialCsv)!;
    const mapping = autoMapMaterialColumns(raw);
    const result = buildMaterialsFromCsv(raw, mapping);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].title).toBe("Co je Phishing");
    expect(result.rows[0].content).toContain("Klíčový pojem / Pravidlo:\nPhishing (Rybáření)");
  });

  it("seskupí materiály podle kategorie", () => {
    const raw = parseCsvRaw(materialCsv)!;
    const result = buildMaterialsFromCsv(raw, autoMapMaterialColumns(raw));
    const grouped = groupMaterials(result.rows, "category");
    expect(grouped).toHaveLength(2);
    const phishing = grouped.find((g) => g.category === "Phishing")!;
    expect(phishing.content).toContain("## Co je Phishing");
    expect(phishing.content).toContain("## Typy phishingu");
  });

  it("hlásí chybějící mapování názvu", () => {
    const raw = parseCsvRaw(materialCsv)!;
    const result = buildMaterialsFromCsv(raw, {
      category: null,
      title: null,
      content: [3],
      source: null,
    });
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain("Název");
  });
});
