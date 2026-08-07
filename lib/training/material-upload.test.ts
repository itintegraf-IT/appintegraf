import { describe, expect, it } from "vitest";
import { contentDisposition, inferUploadMime, isAllowedUploadMime } from "@/lib/training/material-upload";

describe("contentDisposition", () => {
  it("použije ASCII fallback pro český název souboru", () => {
    const header = contentDisposition("Školení_IT_bezpečnosti.mp4", true);
    expect(header).toMatch(/^inline; filename="[^"]*"; filename\*=UTF-8''/);
    expect(header).not.toMatch(/filename="[^"]*[ěščřžýáíéúůďťňŠ]/);
    expect(header).toContain(encodeURIComponent("Školení_IT_bezpečnosti.mp4"));
  });

  it("attachment pro stažení", () => {
    expect(contentDisposition("video.mp4", false)).toContain("attachment");
  });
});

describe("inferUploadMime", () => {
  it("odhadne mp4 z přípony", () => {
    expect(inferUploadMime("video.mp4", "")).toBe("video/mp4");
    expect(inferUploadMime("video.mp4", "application/octet-stream")).toBe("video/mp4");
  });

  it("odhadne pdf z přípony", () => {
    expect(inferUploadMime("prezentace.pdf", "")).toBe("application/pdf");
  });
});

describe("isAllowedUploadMime", () => {
  it("povolí mp4 i bez MIME z prohlížeče", () => {
    expect(isAllowedUploadMime("video", "", "skoleni.mp4")).toBe(true);
  });
});
