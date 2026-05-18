import { describe, it, expect, beforeAll } from "vitest";
import { generateSecret, generateSync, verifySync } from "otplib";
import {
  encryptTotpSecret,
  decryptTotpSecret,
} from "@/lib/totp-crypto";
import {
  generateBackupCodePlain,
  normalizeBackupCode,
} from "@/lib/totp-backup-codes";
import { verifyTotpCode } from "@/lib/totp";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-totp-unit-tests";
});

describe("totp-crypto", () => {
  it("roundtrips secret encryption", () => {
    const plain = generateSecret();
    const enc = encryptTotpSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptTotpSecret(enc)).toBe(plain);
  });
});

describe("totp verify", () => {
  it("accepts valid code for secret", async () => {
    const secret = generateSecret();
    const token = generateSync({ secret });
    const ok = await verifyTotpCode(secret, token);
    expect(ok).toBe(true);
  });

  it("rejects invalid code", async () => {
    const ok = await verifyTotpCode(generateSecret(), "000000");
    expect(ok).toBe(false);
  });
});

describe("backup codes", () => {
  it("generates formatted code", () => {
    const code = generateBackupCodePlain();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("normalizes input", () => {
    expect(normalizeBackupCode(" abcd-efgh ")).toBe("ABCD-EFGH");
  });
});

describe("otplib sync", () => {
  it("verifySync matches generateSync", () => {
    const secret = generateSecret();
    const token = generateSync({ secret });
    const result = verifySync({ secret, token, epochTolerance: 30 });
    expect(result.valid).toBe(true);
  });
});
