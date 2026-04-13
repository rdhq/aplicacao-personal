import { prisma } from "@/lib/prisma";
import { computeMonitoring } from "@/lib/monitoring";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athleteId = Number(id);

  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId },
    include: { wellbeing: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const plannedCount = await prisma.trainingSession.count({
    where: { athleteId, completedAt: null },
  });

  const data = sessions.map((s) => ({
    pse: s.pseActual ?? s.psePlanned,
    duration: s.duration ?? 50,
    completedAt: s.completedAt,
    wellbeing: s.wellbeing,
  }));

  const monitoring = computeMonitoring(data, plannedCount);
  return NextResponse.json(monitoring);
}
