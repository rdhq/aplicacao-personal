// Compute monitoring metrics from training sessions server-side

type SessionData = {
  pse: number;
  duration: number;
  completedAt: Date | null;
  wellbeing: {
    sleepQuality: string | null;
    sleepHours: string | null;
    energy: string | null;
    stress: string | null;
    nutrition: string | null;
    water: string | null;
    pain: string | null;
    fatigue: string | null;
    mood: string | null;
    motivation: string | null;
  } | null;
};

const scaleMap: Record<string, Record<string, number>> = {
  sleepQuality: { "Péssima": 10, "Ruim": 30, "Normal": 50, "Boa": 75, "Excelente": 95 },
  sleepHours: { "Menos de 5h": 15, "5-6h": 45, "7-8h": 80, "Mais de 8h": 95 },
  energy: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
  stress: { "Muito baixo": 95, "Baixo": 75, "Moderado": 50, "Alto": 30, "Muito alto": 10 },
  nutrition: { "Muito ruim": 10, "Ruim": 30, "Regular": 50, "Boa": 75, "Muito boa": 95 },
  water: { "Menos de 1L": 15, "1-2L": 45, "2-3L": 75, "Mais de 3L": 95 },
  pain: { "Muito forte": 10, "Forte": 30, "Moderada": 50, "Leve": 75, "Sem dor": 95 },
  fatigue: { "Muito intensa": 10, "Intensa": 30, "Moderada": 50, "Leve": 75, "Sem fadiga": 95 },
  mood: { "Péssimo": 10, "Ruim": 30, "Regular": 50, "Bom": 75, "Excelente": 95 },
  motivation: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
};

function score(key: string, val: string | null): number {
  if (!val) return 50;
  return scaleMap[key]?.[val] ?? 50;
}

export function computeMonitoring(sessions: SessionData[], plannedCount: number) {
  const completed = sessions.filter((s) => s.completedAt);

  // Load metrics
  const loads = completed.map((s) => s.pse * (s.duration || 50));
  const totalLoad = loads.reduce((a, b) => a + b, 0);
  const recentLoads = loads.slice(0, 4);
  const acuteLoad = recentLoads.length ? Math.round(recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length) : 0;

  // Chronic load from older sessions (or use acute if not enough data)
  const olderLoads = loads.slice(4, 12);
  const chronicLoad = olderLoads.length
    ? Math.round(olderLoads.reduce((a, b) => a + b, 0) / olderLoads.length)
    : acuteLoad || 1;

  const acwr = chronicLoad > 0 ? +((acuteLoad / chronicLoad).toFixed(2)) : 1.0;

  // Monotony & strain
  let monotony = 1.0;
  let strain = 0;
  if (recentLoads.length > 1) {
    const mean = recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length;
    const stdDev = Math.sqrt(recentLoads.reduce((sum, l) => sum + (l - mean) ** 2, 0) / recentLoads.length);
    monotony = stdDev > 0 ? +(mean / stdDev).toFixed(1) : 1.0;
    strain = Math.round(totalLoad * monotony);
  }

  // Wellbeing from most recent completed session
  let wellbeingScore = 75;
  let sleepScore = 75;
  let fatigueScore = 30;

  const latestWithWellbeing = completed.find((s) => s.wellbeing);
  if (latestWithWellbeing?.wellbeing) {
    const w = latestWithWellbeing.wellbeing;
    const allScores = [
      score("sleepQuality", w.sleepQuality), score("sleepHours", w.sleepHours),
      score("energy", w.energy), score("stress", w.stress),
      score("nutrition", w.nutrition), score("water", w.water),
      score("pain", w.pain), score("fatigue", w.fatigue),
      score("mood", w.mood), score("motivation", w.motivation),
    ];
    wellbeingScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    sleepScore = Math.round((score("sleepQuality", w.sleepQuality) + score("sleepHours", w.sleepHours)) / 2);
    fatigueScore = Math.round(100 - score("fatigue", w.fatigue));
  }

  const riskLevel = acwr > 1.3 ? "alto" : acwr < 0.8 ? "ok" : "atenção";

  return {
    acwr, monotony, strain,
    plannedLoad: plannedCount * 200,
    completedLoad: totalLoad,
    wellbeing: wellbeingScore,
    sleep: sleepScore,
    fatigue: fatigueScore,
    weeklyLoads: recentLoads,
    weeklyPse: completed.slice(0, 4).map((s) => s.pse),
    acuteLoad, chronicLoad,
    totalMinutes: completed.reduce((sum, s) => sum + (s.duration || 0), 0),
    sessionsCompleted: completed.length,
    sessionsPlanned: plannedCount,
    riskLevel,
  };
}
