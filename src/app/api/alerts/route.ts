import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") || "week"; // week, month, all

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  if (period === "week") {
    startDate = new Date(now);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - ((dow + 6) % 7));
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
  } else {
    startDate = new Date(2020, 0, 1);
  }

  const [recentPains, recentInjuries] = await Promise.all([
    prisma.painRecord.findMany({
      where: { date: { gte: startDate } },
      include: { athlete: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.injuryRecord.findMany({
      where: { date: { gte: startDate } },
      include: { athlete: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  // Completion rate this week
  const weekStart = new Date(now);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((dow + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [weekTotal, weekCompleted] = await Promise.all([
    prisma.trainingSession.count({ where: { date: { gte: weekStart, lte: weekEnd } } }),
    prisma.trainingSession.count({ where: { date: { gte: weekStart, lte: weekEnd }, completedAt: { not: null } } }),
  ]);
  const completionRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  // Build alerts
  const alerts: Array<{ id: number; name: string; athleteId: number; type: string; detail: string; area: string; date: string; rawDate: Date }> = [];

  for (const p of recentPains) {
    alerts.push({
      id: p.id, name: p.athlete.name, athleteId: p.athlete.id, type: "dor",
      detail: `${p.area}${p.intensity ? ` · ${p.intensity}` : ""}${p.side ? ` · ${p.side}` : ""}`,
      area: p.area, date: p.date.toLocaleDateString("pt-BR"), rawDate: p.date,
    });
  }

  for (const i of recentInjuries) {
    alerts.push({
      id: i.id, name: i.athlete.name, athleteId: i.athlete.id, type: "lesão",
      detail: `${i.type}${i.area ? ` · ${i.area}` : ""}${i.grade ? ` · ${i.grade}` : ""}`,
      area: i.area || i.type, date: i.date.toLocaleDateString("pt-BR"), rawDate: i.date,
    });
  }

  alerts.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  // Ranking: athletes with most alerts
  const ranking: Record<string, { name: string; athleteId: number; pains: number; injuries: number; total: number }> = {};
  for (const a of alerts) {
    if (!ranking[a.name]) ranking[a.name] = { name: a.name, athleteId: a.athleteId, pains: 0, injuries: 0, total: 0 };
    if (a.type === "dor") ranking[a.name].pains++;
    else ranking[a.name].injuries++;
    ranking[a.name].total++;
  }
  const rankingList = Object.values(ranking).sort((a, b) => b.total - a.total);

  // Areas ranking
  const areaRanking: Record<string, number> = {};
  for (const a of alerts) {
    areaRanking[a.area] = (areaRanking[a.area] || 0) + 1;
  }
  const areaList = Object.entries(areaRanking).sort((a, b) => b[1] - a[1]).map(([area, count]) => ({ area, count }));

  return NextResponse.json({
    total: alerts.length,
    painCount: recentPains.length,
    injuryCount: recentInjuries.length,
    completionRate,
    athletes: alerts.map(({ rawDate, ...rest }) => rest),
    ranking: rankingList,
    areas: areaList,
  });
}
