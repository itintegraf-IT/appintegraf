import { NextResponse } from "next/server";
import { errorStatus, isAppError } from "./errors";

type Handler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

export function withApiError<Args extends unknown[]>(handler: Handler<Args>): Handler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (isAppError(err)) {
        return NextResponse.json({ error: err.message }, { status: errorStatus(err.code) });
      }
      console.error("[crm-api] neočekávaná chyba", err);
      return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
    }
  };
}
