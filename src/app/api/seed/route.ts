import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import rawData from "@/data.json";
import { getCurrentMonday, dayOfWeekKey } from "@/lib/date-utils";

export async function POST() {
  // Clear all data
  await prisma.injuryRecord.deleteMany();
  await prisma.painRecord.deleteMany();
  await prisma.wellbeingLog.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.trainingType.deleteMany();

  // Seed coaches
  const coaches = await Promise.all(
    (rawData as any).coaches.map((c: any) =>
      prisma.coach.create({
        data: {
          name: c.name,
          email: c.email,
          phone: c.phone || null,
          role: c.role || "Personal Trainer",
          color: c.color || "#6B7280",
          isEnabled: c.isEnabled ?? true,
        },
      })
    )
  );
  const coachMap = new Map(coaches.map((c) => [c.name, c.id]));

  // Seed training types
  const types = await Promise.all(
    (rawData as any).trainingTypes.map((t: any) =>
      prisma.trainingType.create({
        data: {
          name: t.name,
          category: "Geral",
          isEnabled: t.isEnabled ?? true,
          isDefault: false,
        },
      })
    )
  );
  const typeMap = new Map(types.map((t) => [t.name, t.id]));

  // Seed athletes
  const athletes = await Promise.all(
    (rawData as any).athletes.map((a: any, idx: number) => {
      const coachNames = Array.from(coachMap.keys());
      const coachName = coachNames[idx % coachNames.length];
      return prisma.athlete.create({
        data: {
          name: a.name,
          email: a.email,
          phone: a.phone || null,
          age: a.age || 25,
          position: a.position || "Atleta",
          goal: a.goal || null,
          weight: a.weight ? `${a.weight} kg` : null,
          height: a.height ? `${a.height} m` : null,
          isEnabled: a.isEnabled ?? true,
          coachId: coachMap.get(coachName) || null,
        },
      });
    })
  );
  const athleteMap = new Map(athletes.map((a) => [a.name, a.id]));

  // Seed sessions for current week + next week using allSchedulesByWeek data
  const dayKeys = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monday = getCurrentMonday();

  // Get the first week of mock data as template
  const allByWeek = (rawData as any).allSchedulesByWeek || {};
  const weekKeys = Object.keys(allByWeek);
  const templateWeek = weekKeys.length > 0 ? allByWeek[weekKeys[0]] : [];

  // Create sessions for current week
  for (const s of templateWeek) {
    const dayIdx = dayKeys.indexOf(s.day);
    if (dayIdx === -1) continue;

    const sessionDate = new Date(monday);
    sessionDate.setDate(monday.getDate() + dayIdx);

    // Find athlete and coach by name (fuzzy match)
    const athleteName = s.athlete;
    let athleteId = athleteMap.get(athleteName);
    if (!athleteId) {
      const firstName = athleteName.split(" ")[0];
      for (const [name, id] of athleteMap) {
        if (name.includes(firstName)) { athleteId = id; break; }
      }
    }
    if (!athleteId) athleteId = athletes[0]?.id;

    let coachId = coachMap.get(s.coach);
    if (!coachId) coachId = coaches[0]?.id;

    let typeId = typeMap.get(s.type);
    if (!typeId) typeId = types[0]?.id;

    if (!athleteId || !coachId || !typeId) continue;

    await prisma.trainingSession.create({
      data: {
        date: sessionDate,
        startTime: s.time,
        endTime: s.endTime || (() => {
          const [h, m] = s.time.split(":").map(Number);
          const total = h * 60 + m + 50;
          return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        })(),
        athleteId,
        coachId,
        trainingTypeId: typeId,
        status: s.status === "Concluído" ? "Concluído" : "Confirmado",
        location: s.location || "Academia",
        psePlanned: s.pse || 4,
        completedAt: s.status === "Concluído" ? sessionDate : null,
        duration: 50,
      },
    });
  }

  // Also seed next week with same template
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const templateWeek2 = weekKeys.length > 1 ? allByWeek[weekKeys[1]] : templateWeek;

  for (const s of templateWeek2) {
    const dayIdx = dayKeys.indexOf(s.day);
    if (dayIdx === -1) continue;

    const sessionDate = new Date(nextMonday);
    sessionDate.setDate(nextMonday.getDate() + dayIdx);

    const athleteName = s.athlete;
    let athleteId = athleteMap.get(athleteName);
    if (!athleteId) {
      const firstName = athleteName.split(" ")[0];
      for (const [name, id] of athleteMap) {
        if (name.includes(firstName)) { athleteId = id; break; }
      }
    }
    if (!athleteId) athleteId = athletes[0]?.id;

    let coachId = coachMap.get(s.coach);
    if (!coachId) coachId = coaches[0]?.id;

    let typeId = typeMap.get(s.type);
    if (!typeId) typeId = types[0]?.id;

    if (!athleteId || !coachId || !typeId) continue;

    await prisma.trainingSession.create({
      data: {
        date: sessionDate,
        startTime: s.time,
        endTime: s.endTime || (() => {
          const [h, m] = s.time.split(":").map(Number);
          const total = h * 60 + m + 50;
          return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        })(),
        athleteId,
        coachId,
        trainingTypeId: typeId,
        status: "Pendente",
        location: s.location || "Academia",
        psePlanned: s.pse || 4,
        duration: 50,
      },
    });
  }

  const counts = {
    coaches: coaches.length,
    athletes: athletes.length,
    trainingTypes: types.length,
    sessions: await prisma.trainingSession.count(),
  };

  return NextResponse.json({ ok: true, seeded: counts });
}
