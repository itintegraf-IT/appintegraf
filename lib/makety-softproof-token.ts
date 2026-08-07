import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET není nastaven");
  }
  return new TextEncoder().encode(secret);
}

const PURPOSE = "makety_softproof";
const DEFAULT_TTL_HOURS = 7 * 24;

export type SoftproofTokenPayload = {
  purpose: typeof PURPOSE;
  maketaId: number;
  fileId: number;
};

export async function signSoftproofToken(params: {
  maketaId: number;
  fileId: number;
  ttlHours?: number;
}): Promise<string> {
  const hours = params.ttlHours ?? DEFAULT_TTL_HOURS;
  return new SignJWT({
    purpose: PURPOSE,
    maketaId: params.maketaId,
    fileId: params.fileId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(getSecretKey());
}

export async function verifySoftproofToken(
  token: string
): Promise<SoftproofTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== PURPOSE) return null;
    const maketaId = Number(payload.maketaId);
    const fileId = Number(payload.fileId);
    if (!Number.isFinite(maketaId) || !Number.isFinite(fileId)) return null;
    return { purpose: PURPOSE, maketaId, fileId };
  } catch {
    return null;
  }
}
