import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.users.count();
    return NextResponse.json({
      success: true,
      database: "connected",
      usersCount: userCount,
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        database: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
