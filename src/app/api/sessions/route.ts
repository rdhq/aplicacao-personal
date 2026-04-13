import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get("weekStart");
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const sessions = await prisma.trainingSession.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      athlete: { select: { id: true, name: true } },
      coach: { select: { id: true, name: true } },
      trainingType: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await prisma.trainingSession.create({
    data: {
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      athleteId: body.athleteId,
      coachId: body.coachId,
      trainingTypeId: body.trainingTypeId,
      status: body.status || "Confirmado",
      location: body.location || "Academia",
      psePlanned: body.psePlanned || 4,
      duration: body.duration,
    },
    include: {
      athlete: { select: { id: true, name: true } },
      coach: { select: { id: true, name: true } },
      trainingType: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(session, { status: 201 });
}
