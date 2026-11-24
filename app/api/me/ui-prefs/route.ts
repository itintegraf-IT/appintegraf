import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  isUserUiPrefKey,
  mergeUserUiPrefs,
  parseUserUiPrefs,
  serializeUserUiPrefs,
  type UserUiPrefKey,
} from "@/lib/user-ui-prefs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { ui_prefs: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  const prefs = parseUserUiPrefs(user.ui_prefs);
  const keyParam = req.nextUrl.searchParams.get("key");
  if (keyParam) {
    if (!isUserUiPrefKey(keyParam)) {
      return NextResponse.json({ error: "Neplatný klíč preference" }, { status: 400 });
    }
    return NextResponse.json({ key: keyParam, value: prefs[keyParam] ?? null });
  }

  return NextResponse.json({ prefs });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON tělo" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.key === "string" && "value" in obj) {
      if (!isUserUiPrefKey(obj.key)) {
        return NextResponse.json({ error: "Neplatný klíč preference" }, { status: 400 });
      }
      patch[obj.key] = obj.value;
    } else if (obj.prefs && typeof obj.prefs === "object" && !Array.isArray(obj.prefs)) {
      Object.assign(patch, obj.prefs as Record<string, unknown>);
    } else {
      return NextResponse.json(
        { error: "Očekáváno { key, value } nebo { prefs: { … } }" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "Neplatné tělo" }, { status: 400 });
  }

  const keys = Object.keys(patch);
  if (keys.length === 0 || !keys.every(isUserUiPrefKey)) {
    return NextResponse.json({ error: "Žádný platný klíč preference" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { ui_prefs: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  const merged = mergeUserUiPrefs(parseUserUiPrefs(user.ui_prefs), patch);
  await prisma.users.update({
    where: { id: userId },
    data: { ui_prefs: serializeUserUiPrefs(merged) },
  });

  const updatedKeys = keys.filter(isUserUiPrefKey) as UserUiPrefKey[];
  return NextResponse.json({
    prefs: merged,
    updated: Object.fromEntries(updatedKeys.map((k) => [k, merged[k] ?? null])),
  });
}
