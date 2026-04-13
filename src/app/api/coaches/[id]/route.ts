import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const coach = await prisma.coach.update({ where: { id: Number(id) }, data: body });
  return NextResponse.json(coach);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coachId = Number(id);

  try {
    // Find another coach to reassign sessions/athletes
    const fallback = await prisma.coach.findFirst({ where: { id: { not: coachId } } });

    if (fallback) {
      await prisma.trainingSession.updateMany({ where: { coachId }, data: { coachId: fallback.id } });
      await prisma.athlete.updateMany({ where: { coachId }, data: { coachId: fallback.id } });
    }

    await prisma.coach.delete({ where: { id: coachId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao excluir" }, { status: 500 });
  }
}
