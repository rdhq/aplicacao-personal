import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athleteId = Number(id);
  const startDate = req.nextUrl.searchParams.get("start");
  const endDate = req.nextUrl.searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: { coach: { select: { name: true } } },
  });

  if (!athlete) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // All sessions in date range
  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId, date: { gte: start, lte: end } },
    include: {
      trainingType: { select: { name: true } },
      coach: { select: { name: true } },
      wellbeing: true,
      pains: true,
      injuries: true,
    },
    orderBy: { date: "asc" },
  });

  const completed = sessions.filter((s) => s.completedAt);
  const pending = sessions.filter((s) => !s.completedAt && s.status !== "Cancelado");
  const cancelled = sessions.filter((s) => s.status === "Cancelado");

  // Totals
  const totalSessions = sessions.length;
  const totalCompleted = completed.length;
  const totalMinutes = completed.reduce((sum, s) => sum + (s.duration || 50), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
  const totalLoad = completed.reduce((sum, s) => sum + (s.pseActual || s.psePlanned) * (s.duration || 50), 0);
  const avgPse = completed.length ? Math.round(completed.reduce((sum, s) => sum + (s.pseActual || s.psePlanned), 0) / completed.length * 10) / 10 : 0;
  const completionRate = totalSessions ? Math.round((totalCompleted / totalSessions) * 100) : 0;

  // Training types breakdown
  const typeBreakdown: Record<string, number> = {};
  completed.forEach((s) => {
    const name = s.trainingType.name;
    typeBreakdown[name] = (typeBreakdown[name] || 0) + 1;
  });

  // Coach breakdown
  const coachBreakdown: Record<string, number> = {};
  completed.forEach((s) => {
    const name = s.coach.name;
    coachBreakdown[name] = (coachBreakdown[name] || 0) + 1;
  });

  // Weekly load chart
  const weeklyData: Record<string, { load: number; sessions: number; minutes: number }> = {};
  completed.forEach((s) => {
    const d = new Date(s.date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    if (!weeklyData[key]) weeklyData[key] = { load: 0, sessions: 0, minutes: 0 };
    weeklyData[key].load += (s.pseActual || s.psePlanned) * (s.duration || 50);
    weeklyData[key].sessions += 1;
    weeklyData[key].minutes += s.duration || 50;
  });

  // Wellbeing summary
  const wellbeingLogs = completed.filter((s) => s.wellbeing).map((s) => s.wellbeing!);
  const wellbeingSummary = {
    total: wellbeingLogs.length,
    sleepQuality: countValues(wellbeingLogs.map((w) => w.sleepQuality)),
    energy: countValues(wellbeingLogs.map((w) => w.energy)),
    stress: countValues(wellbeingLogs.map((w) => w.stress)),
    mood: countValues(wellbeingLogs.map((w) => w.mood)),
    fatigue: countValues(wellbeingLogs.map((w) => w.fatigue)),
    pain: countValues(wellbeingLogs.map((w) => w.pain)),
    nutrition: countValues(wellbeingLogs.map((w) => w.nutrition)),
    motivation: countValues(wellbeingLogs.map((w) => w.motivation)),
  };

  // Pains & injuries
  const allPains = completed.flatMap((s) => s.pains);
  const allInjuries = completed.flatMap((s) => s.injuries);
  const painAreas: Record<string, number> = {};
  allPains.forEach((p) => { painAreas[p.area] = (painAreas[p.area] || 0) + 1; });
  const injuryTypes: Record<string, number> = {};
  allInjuries.forEach((i) => { injuryTypes[i.type] = (injuryTypes[i.type] || 0) + 1; });

  return NextResponse.json({
    athlete: { id: athlete.id, name: athlete.name, email: athlete.email, age: athlete.age, position: athlete.position, coach: athlete.coach?.name },
    period: { start: startDate, end: endDate },
    summary: {
      totalSessions, totalCompleted, totalPending: pending.length, totalCancelled: cancelled.length,
      totalMinutes, totalHours, totalLoad, avgPse, completionRate,
    },
    typeBreakdown,
    coachBreakdown,
    weeklyData,
    wellbeingSummary,
    pains: { total: allPains.length, byArea: painAreas, details: allPains },
    injuries: { total: allInjuries.length, byType: injuryTypes, details: allInjuries },
    sessions: sessions.map((s) => ({
      id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime,
      type: s.trainingType.name, coach: s.coach.name, status: s.status,
      pse: s.pseActual || s.psePlanned, duration: s.duration,
    })),
  });
}

function countValues(arr: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  arr.forEach((v) => { if (v) counts[v] = (counts[v] || 0) + 1; });
  return counts;
}
