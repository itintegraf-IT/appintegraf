import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "totp_login";
const TTL = "5m";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET není nastaven");
  }
  return new TextEncoder().encode(secret);
}

export async function createLoginChallenge(params: {
  userId: number;
  passwordVersion: number;
}): Promise<string> {
  return new SignJWT({
    purpose: PURPOSE,
    userId: params.userId,
    passwordVersion: params.passwordVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getSecretKey());
}

export async function verifyLoginChallenge(
  token: string
): Promise<{ userId: number; passwordVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== PURPOSE) {
      return null;
    }
    const userId = payload.userId;
    const passwordVersion = payload.passwordVersion;
    if (typeof userId !== "number" || typeof passwordVersion !== "number") {
      return null;
    }
    return { userId, passwordVersion };
  } catch {
    return null;
  }
}
