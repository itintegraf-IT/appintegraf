import { describe, expect, it } from "vitest";
import { buildQrPayload, extractQrUrlCode, isTestLabelEnvironment, resolveQrBaseUrl } from "./qr-url";

describe("resolveQrBaseUrl", () => {
  it.each([
    [{ AUTH_URL: "https://appintegraf.integraf.cz" }, "https://appintegraf.integraf.cz"],
    [{ AUTH_URL: "https://appintegraf.integraf.cz/" }, "https://appintegraf.integraf.cz"],
    [{ AUTH_URL: "http://192.168.10.210:3011" }, "http://192.168.10.210:3011"],
    [{ AUTH_URL: "https://appintegraf.integraf.cz/api/auth" }, "https://appintegraf.integraf.cz"],
    [{ AUTH_URL: "http://localhost:3000" }, null],
    [{ AUTH_URL: "http://127.0.0.1:3000" }, null],
    [{ AUTH_URL: "http://[::1]:3000" }, null],
    [{ AUTH_URL: "http://0.0.0.0:3000" }, null],
    [{ AUTH_URL: "nesmysl" }, null],
    [{ AUTH_URL: "ftp://appintegraf.integraf.cz" }, null],
    [{ AUTH_URL: "   " }, null],
    [{}, null],
  ] as const)("%j → %s", (env, expected) => {
    expect(resolveQrBaseUrl(env)).toBe(expected);
  });

  it("dá přednost EQUIPMENT_QR_BASE_URL před AUTH_URL", () => {
    expect(
      resolveQrBaseUrl({ EQUIPMENT_QR_BASE_URL: "http://192.168.1.20:3100", AUTH_URL: "https://appintegraf.integraf.cz" })
    ).toBe("http://192.168.1.20:3100");
  });

  it("neplatné EQUIPMENT_QR_BASE_URL přeskočí a použije AUTH_URL", () => {
    expect(
      resolveQrBaseUrl({ EQUIPMENT_QR_BASE_URL: "http://localhost:3100", AUTH_URL: "https://appintegraf.integraf.cz" })
    ).toBe("https://appintegraf.integraf.cz");
  });
});

describe("buildQrPayload", () => {
  const base = "https://appintegraf.integraf.cz";

  it("s adresou aplikace vrátí odkaz na /q", () => {
    expect(buildQrPayload("item", "123456789012", base)).toBe("https://appintegraf.integraf.cz/q/123456789012");
    expect(buildQrPayload("room", "RM-084092796419", base)).toBe("https://appintegraf.integraf.cz/q/RM-084092796419");
  });

  it("kód v odkazu zakóduje", () => {
    expect(buildQrPayload("item", "A B/C", base)).toBe("https://appintegraf.integraf.cz/q/A%20B%2FC");
  });

  it("bez adresy aplikace vrátí starý textový formát", () => {
    expect(buildQrPayload("item", "123456789012", null)).toBe("INTEGRAF:EQ:123456789012");
    expect(buildQrPayload("room", "RM-084092796419", null)).toBe("INTEGRAF:RM:RM-084092796419");
  });
});

describe("extractQrUrlCode", () => {
  it.each([
    ["https://appintegraf.integraf.cz/q/123456789012", "123456789012"],
    ["http://192.168.10.210:3011/q/RM-084092796419", "RM-084092796419"],
    ["HTTPS://APPINTEGRAF.INTEGRAF.CZ/Q/123456789012", "123456789012"],
    ["https://appintegraf.integraf.cz/q/123456789012/", "123456789012"],
    ["https://appintegraf.integraf.cz/q/123456789012?utm=x", "123456789012"],
    ["https://appintegraf.integraf.cz/q/123456789012#detail", "123456789012"],
    ["https://appintegraf.integraf.cz/q/RM%2D084092796419", "RM-084092796419"],
    ["  https://jiny-server.example/q/123456789012  ", "123456789012"],
  ] as const)("%s → %s", (raw, code) => {
    expect(extractQrUrlCode(raw)).toBe(code);
  });

  it.each([
    ["https://appintegraf.integraf.cz/q/"],
    ["https://appintegraf.integraf.cz/q"],
    ["https://appintegraf.integraf.cz/equipment/123"],
    ["https://appintegraf.integraf.cz/q/123/456"],
    ["https://appintegraf.integraf.cz/q/%E0%A4%A"],
    ["INTEGRAF:EQ:123456789012"],
    ["123456789012"],
    [""],
  ] as const)("%s → null", (raw) => {
    expect(extractQrUrlCode(raw)).toBeNull();
  });
});

describe("isTestLabelEnvironment", () => {
  it.each([
    [{ APP_ENV: "test" }, true],
    [{ APP_ENV: " TEST " }, true],
    [{ APP_ENV: "production" }, false],
    [{}, false],
  ] as const)("%j → %s", (env, expected) => {
    expect(isTestLabelEnvironment(env)).toBe(expected);
  });
});
