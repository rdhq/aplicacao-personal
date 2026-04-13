import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const coachEmail = req.nextUrl.searchParams.get("coachEmail");

  // Find sessions from past days that are NOT completed and NOT cancelled
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: any = {
    date: { lt: today },
    completedAt: null,
    status: { notIn: ["Concluído", "Cancelado"] },
  };

  // If coachEmail provided, filter by coach
  if (coachEmail) {
    const coach = await prisma.coach.findFirst({ where: { email: { equals: coachEmail, mode: "insensitive" } } });
    if (coach) where.coachId = coach.id;
  }

  const pendingSessions = await prisma.trainingSession.findMany({
    where,
    include: {
      athlete: { select: { id: true, name: true } },
      coach: { select: { id: true, name: true } },
      trainingType: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
  });

  const notifications = pendingSessions.map(s => ({
    id: s.id,
    type: "pendencia",
    title: `Treino não concluído`,
    detail: `${s.athlete.name} · ${s.trainingType.name} · ${s.coach.name}`,
    date: s.date.toLocaleDateString("pt-BR"),
    time: s.startTime,
    athleteId: s.athlete.id,
    athleteName: s.athlete.name,
  }));

  return NextResponse.json({
    count: notifications.length,
    notifications,
  });
}
