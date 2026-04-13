import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athleteId = Number(id);

  // Current week Monday
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // This week's sessions
  const weekSessions = await prisma.trainingSession.findMany({
    where: { athleteId, date: { gte: monday, lte: sunday } },
    include: { wellbeing: true },
    orderBy: { date: "asc" },
  });

  const completed = weekSessions.filter(s => s.completedAt);
  const totalSessions = weekSessions.length;
  const completedCount = completed.length;

  // Weekly load
  const weekLoad = completed.reduce((sum, s) => sum + (s.pseActual || s.psePlanned) * (s.duration || 50), 0);
  const totalMinutes = completed.reduce((sum, s) => sum + (s.duration || 50), 0);
  const avgPse = completedCount > 0 ? +(completed.reduce((sum, s) => sum + (s.pseActual || s.psePlanned), 0) / completedCount).toFixed(1) : 0;
  const adherence = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  // Last 4 weeks for evolution chart
  const fourWeeksAgo = new Date(monday);
  fourWeeksAgo.setDate(monday.getDate() - 28);

  const last4WeeksSessions = await prisma.trainingSession.findMany({
    where: { athleteId, completedAt: { not: null }, date: { gte: fourWeeksAgo, lte: sunday } },
    select: { date: true, pseActual: true, psePlanned: true, duration: true },
    orderBy: { date: "asc" },
  });

  // Group by week
  const weeklyLoads: number[] = [];
  const weeklyPse: number[] = [];
  for (let w = 0; w < 4; w++) {
    const wStart = new Date(monday);
    wStart.setDate(monday.getDate() - (3 - w) * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    wEnd.setHours(23, 59, 59, 999);

    const wSessions = last4WeeksSessions.filter(s => s.date >= wStart && s.date <= wEnd);
    const wLoad = wSessions.reduce((sum, s) => sum + (s.pseActual || s.psePlanned) * (s.duration || 50), 0);
    const wPse = wSessions.length > 0 ? +(wSessions.reduce((sum, s) => sum + (s.pseActual || s.psePlanned), 0) / wSessions.length).toFixed(1) : 0;
    weeklyLoads.push(wLoad);
    weeklyPse.push(wPse);
  }

  // ACWR
  const acuteLoad = weeklyLoads[3] || 0; // current week
  const chronicLoad = weeklyLoads.slice(0, 3).length > 0
    ? Math.round(weeklyLoads.slice(0, 3).reduce((a, b) => a + b, 0) / weeklyLoads.slice(0, 3).length)
    : acuteLoad || 1;
  const acwr = chronicLoad > 0 ? +((acuteLoad / chronicLoad).toFixed(2)) : 1.0;

  // Monotony & strain
  let monotony = 1.0, strain = 0;
  if (weeklyLoads.length > 1) {
    const mean = weeklyLoads.reduce((a, b) => a + b, 0) / weeklyLoads.length;
    const stdDev = Math.sqrt(weeklyLoads.reduce((sum, l) => sum + (l - mean) ** 2, 0) / weeklyLoads.length);
    monotony = stdDev > 0 ? +(mean / stdDev).toFixed(1) : 1.0;
    strain = Math.round(weekLoad * monotony);
  }

  const riskLevel = acwr > 1.3 ? "alto" : acwr < 0.8 ? "ok" : acwr > 1.1 || acwr < 0.85 ? "atenção" : "ok";

  // Wellbeing from latest completed session
  let wellbeing = 75, sleep = 75, fatigue = 30;
  const latestWb = completed.reverse().find(s => s.wellbeing)?.wellbeing;
  if (latestWb) {
    const wbScores: Record<string, Record<string, number>> = {
      sleepQuality: { "Péssima": 10, "Ruim": 30, "Normal": 50, "Boa": 75, "Excelente": 95 },
      energy: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
      stress: { "Muito baixo": 95, "Baixo": 75, "Moderado": 50, "Alto": 30, "Muito alto": 10 },
      pain: { "Muito forte": 10, "Forte": 30, "Moderada": 50, "Leve": 75, "Sem dor": 95 },
      fatigue: { "Muito intensa": 10, "Intensa": 30, "Moderada": 50, "Leve": 75, "Sem fadiga": 95 },
      mood: { "Péssimo": 10, "Ruim": 30, "Regular": 50, "Bom": 75, "Excelente": 95 },
    };
    const scores = [
      wbScores.sleepQuality?.[latestWb.sleepQuality || ""] || 50,
      wbScores.energy?.[latestWb.energy || ""] || 50,
      wbScores.stress?.[latestWb.stress || ""] || 50,
      wbScores.pain?.[latestWb.pain || ""] || 50,
      wbScores.fatigue?.[latestWb.fatigue || ""] || 50,
      wbScores.mood?.[latestWb.mood || ""] || 50,
    ];
    wellbeing = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    sleep = wbScores.sleepQuality?.[latestWb.sleepQuality || ""] || 50;
    fatigue = 100 - (wbScores.fatigue?.[latestWb.fatigue || ""] || 50);
  }

  return NextResponse.json({
    weekLoad, avgPse, totalMinutes, completedCount, totalSessions, adherence,
    acwr, acuteLoad, chronicLoad, monotony, strain, riskLevel,
    weeklyLoads, weeklyPse,
    wellbeing, sleep, fatigue,
  });
}
