import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json();

  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update session as completed
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      status: "Concluído",
      completedAt: new Date(),
      pseActual: body.pseActual ?? session.psePlanned,
      psr: body.psr ?? 0,
      duration: body.duration ?? 50,
      summary: body.summary ?? "",
      trainingTypeId: body.trainingTypeId ?? session.trainingTypeId,
    },
  });

  // Save wellbeing - filter empty strings to null
  if (body.wellbeing) {
    const wb: any = {};
    for (const [k, v] of Object.entries(body.wellbeing)) {
      wb[k] = (v && v !== "") ? v : null;
    }
    const hasData = Object.values(wb).some(v => v !== null);
    if (hasData) {
      try {
        // Try upsert first
        await prisma.wellbeingLog.upsert({
          where: { sessionId },
          create: { sessionId, athleteId: session.athleteId, ...wb },
          update: wb,
        });
      } catch {
        // Fallback to raw SQL if Prisma model fails
        try {
          const existing = await prisma.$queryRaw`SELECT id FROM "WellbeingLog" WHERE "sessionId" = ${sessionId}`;
          if ((existing as any[]).length > 0) {
            await prisma.$executeRaw`UPDATE "WellbeingLog" SET "sleepQuality" = ${wb.sleepQuality}, "sleepHours" = ${wb.sleepHours}, "energy" = ${wb.energy}, "stress" = ${wb.stress}, "nutrition" = ${wb.nutrition}, "water" = ${wb.water}, "pain" = ${wb.pain}, "fatigue" = ${wb.fatigue}, "mood" = ${wb.mood}, "motivation" = ${wb.motivation} WHERE "sessionId" = ${sessionId}`;
          } else {
            await prisma.$executeRaw`INSERT INTO "WellbeingLog" ("sessionId", "athleteId", "sleepQuality", "sleepHours", "energy", "stress", "nutrition", "water", "pain", "fatigue", "mood", "motivation", "createdAt") VALUES (${sessionId}, ${session.athleteId}, ${wb.sleepQuality}, ${wb.sleepHours}, ${wb.energy}, ${wb.stress}, ${wb.nutrition}, ${wb.water}, ${wb.pain}, ${wb.fatigue}, ${wb.mood}, ${wb.motivation}, NOW())`;
          }
        } catch {}
      }
    }
  }

  // Save pains
  if (body.pains?.length) {
    await prisma.painRecord.deleteMany({ where: { sessionId } });
    await prisma.painRecord.createMany({
      data: body.pains.map((p: { area: string; intensity?: string; side?: string; moment?: string }) => ({
        sessionId,
        athleteId: session.athleteId,
        area: p.area,
        intensity: p.intensity,
        side: p.side,
        moment: p.moment,
      })),
    });
  }

  // Save injuries
  if (body.injuries?.length) {
    await prisma.injuryRecord.deleteMany({ where: { sessionId } });
    await prisma.injuryRecord.createMany({
      data: body.injuries.map((i: { type: string; area?: string; side?: string; grade?: string }) => ({
        sessionId,
        athleteId: session.athleteId,
        type: i.type,
        area: i.area,
        side: i.side,
        grade: i.grade,
      })),
    });
  }

  const updated = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      athlete: { select: { id: true, name: true } },
      coach: { select: { id: true, name: true } },
      trainingType: { select: { id: true, name: true } },
      wellbeing: true,
      pains: true,
      injuries: true,
    },
  });

  return NextResponse.json(updated);
}
