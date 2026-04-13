import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coachId = Number(id);
  const startDate = req.nextUrl.searchParams.get("start");
  const endDate = req.nextUrl.searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = await prisma.trainingSession.findMany({
    where: { coachId, date: { gte: start, lte: end } },
    include: {
      athlete: { select: { id: true, name: true } },
      trainingType: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  const completed = sessions.filter((s) => s.completedAt);
  const totalMinutes = completed.reduce((sum, s) => sum + (s.duration || 50), 0);

  // Athletes served
  const athleteMap: Record<number, { name: string; sessions: number; minutes: number }> = {};
  completed.forEach((s) => {
    if (!athleteMap[s.athlete.id]) athleteMap[s.athlete.id] = { name: s.athlete.name, sessions: 0, minutes: 0 };
    athleteMap[s.athlete.id].sessions += 1;
    athleteMap[s.athlete.id].minutes += s.duration || 50;
  });

  // Training types
  const typeBreakdown: Record<string, number> = {};
  completed.forEach((s) => { typeBreakdown[s.trainingType.name] = (typeBreakdown[s.trainingType.name] || 0) + 1; });

  // Daily breakdown
  const dailyData: Record<string, { sessions: number; minutes: number }> = {};
  completed.forEach((s) => {
    const key = new Date(s.date).toISOString().split("T")[0];
    if (!dailyData[key]) dailyData[key] = { sessions: 0, minutes: 0 };
    dailyData[key].sessions += 1;
    dailyData[key].minutes += s.duration || 50;
  });

  // Weekly
  const weeklyData: Record<string, { sessions: number; minutes: number; athletes: Set<number> }> = {};
  completed.forEach((s) => {
    const d = new Date(s.date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    if (!weeklyData[key]) weeklyData[key] = { sessions: 0, minutes: 0, athletes: new Set() };
    weeklyData[key].sessions += 1;
    weeklyData[key].minutes += s.duration || 50;
    weeklyData[key].athletes.add(s.athlete.id);
  });

  const weeklyDataSerialized = Object.fromEntries(
    Object.entries(weeklyData).map(([k, v]) => [k, { sessions: v.sessions, minutes: v.minutes, athletes: v.athletes.size }])
  );

  return NextResponse.json({
    coach: { id: coach.id, name: coach.name, email: coach.email, role: coach.role },
    period: { start: startDate, end: endDate },
    summary: {
      totalSessions: sessions.length,
      totalCompleted: completed.length,
      totalPending: sessions.filter((s) => !s.completedAt && s.status !== "Cancelado").length,
      totalCancelled: sessions.filter((s) => s.status === "Cancelado").length,
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      uniqueAthletes: Object.keys(athleteMap).length,
      completionRate: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
    },
    athletes: Object.values(athleteMap).sort((a, b) => b.sessions - a.sessions),
    typeBreakdown,
    weeklyData: weeklyDataSerialized,
    dailyData,
  });
}
