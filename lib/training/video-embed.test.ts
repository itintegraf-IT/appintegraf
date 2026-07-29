import { describe, expect, it } from "vitest";
import { resolveVideoEmbed } from "@/lib/training/video-embed";

describe("resolveVideoEmbed", () => {
  it("parsuje YouTube watch URL", () => {
    const result = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({
      kind: "iframe",
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("parsuje YouTube youtu.be URL", () => {
    const result = resolveVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(result?.kind).toBe("iframe");
    if (result?.kind === "iframe") {
      expect(result.embedUrl).toContain("dQw4w9WgXcQ");
    }
  });

  it("parsuje Vimeo URL", () => {
    const result = resolveVideoEmbed("https://vimeo.com/123456789");
    expect(result).toEqual({
      kind: "iframe",
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
  });

  it("rozpozná přímý MP4 odkaz", () => {
    const result = resolveVideoEmbed("https://example.com/video.mp4");
    expect(result).toEqual({
      kind: "video",
      src: "https://example.com/video.mp4",
    });
  });

  it("vrátí null pro prázdný řetězec", () => {
    expect(resolveVideoEmbed("")).toBeNull();
  });
});
