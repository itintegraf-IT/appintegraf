import { describe, expect, it } from "vitest";
import { inferUploadMime, isAllowedUploadMime } from "@/lib/training/material-upload";

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
