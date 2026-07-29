export type VideoEmbedResult =
  | { kind: "iframe"; embedUrl: string; provider: "youtube" | "vimeo" }
  | { kind: "video"; src: string }
  | { kind: "link"; href: string };

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    const embedMatch = url.pathname.match(/^\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
    const shortsMatch = url.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
  }
  return null;
}

function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const match = url.pathname.match(/\/(\d+)/);
  return match?.[1] ?? null;
}

/** Převede URL videa na embed nebo přímý zdroj pro přehrávač. */
export function resolveVideoEmbed(rawUrl: string): VideoEmbedResult | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      return {
        kind: "iframe",
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      };
    }

    const vimeoId = extractVimeoId(url);
    if (vimeoId) {
      return {
        kind: "iframe",
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      };
    }

    if (/\.(mp4|webm)(\?|$)/i.test(url.pathname)) {
      return { kind: "video", src: trimmed };
    }

    return { kind: "link", href: trimmed };
  } catch {
    return null;
  }
}
