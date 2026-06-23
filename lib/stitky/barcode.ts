import bwipjs from "bwip-js/node";

/** Generuje PNG buffer CODE128 (GS1-128 data string z Oriflame). */
export async function generateCode128Png(text: string): Promise<Buffer> {
  if (!text.trim()) {
    throw new Error("Prázdná data čárového kódu");
  }

  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 2,
    height: 12,
    includetext: false,
    paddingwidth: 2,
    paddingheight: 2,
  });

  return png;
}
