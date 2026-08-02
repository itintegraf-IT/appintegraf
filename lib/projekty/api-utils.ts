import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { prisma, withAudit, type AuditContext } from "./prisma";
import { errorStatus, isAppError } from "./errors";
import { logger } from "./logger";

type Handler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

export function withApiError<Args extends unknown[]>(handler: Handler<Args>): Handler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (isAppError(err)) {
        return NextResponse.json({ error: err.message }, { status: errorStatus(err.code) });
      }
      logger.error("[api] neočekávaná chyba", err as Error);
      return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
    }
  };
}

export function getPrismaAudited(userId: number | null, context?: AuditContext): PrismaClient {
  return withAudit(prisma, userId, context);
}
