import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get("weekStart");

  const [athletes, coaches, trainingTypes, sessions] = await Promise.all([
    prisma.athlete.findMany({
      include: { coach: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.coach.findMany({
      include: { _count: { select: { athletes: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.trainingType.findMany({ orderBy: { name: "asc" } }),
    weekStart ? (async () => {
      const start = new Date(weekStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return prisma.trainingSession.findMany({
        where: { date: { gte: start, lte: end } },
        include: {
          athlete: { select: { id: true, name: true } },
          coach: { select: { id: true, name: true } },
          trainingType: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });
    })() : Promise.resolve([]),
  ]);

  return NextResponse.json({ athletes, coaches, trainingTypes, sessions });
}
