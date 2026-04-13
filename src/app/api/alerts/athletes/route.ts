import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Batch queries instead of per-athlete
  const [athletes, recentPains, recentInjuries, recentWellbeing] = await Promise.all([
    prisma.athlete.findMany({ where: { isEnabled: true }, select: { id: true, name: true, position: true } }),
    prisma.painRecord.groupBy({ by: ["athleteId"], where: { date: { gte: thirtyDaysAgo } }, _count: true }),
    prisma.injuryRecord.groupBy({ by: ["athleteId"], where: { date: { gte: thirtyDaysAgo } }, _count: true }),
    prisma.wellbeingLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { athleteId: true, sleepQuality: true, energy: true, stress: true, pain: true, fatigue: true, mood: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const painMap = new Map(recentPains.map(p => [p.athleteId, p._count]));
  const injuryMap = new Map(recentInjuries.map(i => [i.athleteId, i._count]));

  // Get latest wellbeing per athlete
  const wbMap = new Map<number, any>();
  for (const wb of recentWellbeing) {
    if (!wbMap.has(wb.athleteId)) wbMap.set(wb.athleteId, wb);
  }

  const wbScores: Record<string, Record<string, number>> = {
    sleepQuality: { "Péssima": 10, "Ruim": 30, "Normal": 50, "Boa": 75, "Excelente": 95 },
    energy: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
    stress: { "Muito baixo": 95, "Baixo": 75, "Moderado": 50, "Alto": 30, "Muito alto": 10 },
    pain: { "Muito forte": 10, "Forte": 30, "Moderada": 50, "Leve": 75, "Sem dor": 95 },
    fatigue: { "Muito intensa": 10, "Intensa": 30, "Moderada": 50, "Leve": 75, "Sem fadiga": 95 },
    mood: { "Péssimo": 10, "Ruim": 30, "Regular": 50, "Bom": 75, "Excelente": 95 },
  };

  const results = athletes.map(athlete => {
    const pains = painMap.get(athlete.id) || 0;
    const injuries = injuryMap.get(athlete.id) || 0;
    const wb = wbMap.get(athlete.id);

    let wellbeingScore = 75;
    if (wb) {
      const scores = [
        wbScores.sleepQuality?.[wb.sleepQuality || ""] || 50,
        wbScores.energy?.[wb.energy || ""] || 50,
        wbScores.stress?.[wb.stress || ""] || 50,
        wbScores.pain?.[wb.pain || ""] || 50,
        wbScores.fatigue?.[wb.fatigue || ""] || 50,
        wbScores.mood?.[wb.mood || ""] || 50,
      ];
      wellbeingScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    let risk = "ok";
    if (injuries > 0 || wellbeingScore < 40) {
      risk = "alto";
    } else if (pains > 0 || wellbeingScore < 60) {
      risk = "atenção";
    }

    return {
      id: athlete.id, name: athlete.name, position: athlete.position,
      risk, wellbeing: wellbeingScore,
      recentPains: pains, recentInjuries: injuries,
    };
  });

  const atRisk = results.filter(a => a.risk !== "ok");

  return NextResponse.json({
    total: atRisk.length,
    atencao: atRisk.filter(a => a.risk === "atenção").length,
    alto: atRisk.filter(a => a.risk === "alto").length,
    athletes: atRisk.sort((a, b) => (a.risk === "alto" ? 0 : 1) - (b.risk === "alto" ? 0 : 1)),
  });
}
