import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const type = await prisma.trainingType.update({ where: { id: Number(id) }, data: body });
  return NextResponse.json(type);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);

  try {
    // Check if any sessions use this type
    const sessionsCount = await prisma.trainingSession.count({ where: { trainingTypeId: typeId } });

    if (sessionsCount > 0) {
      // Find or create a "Geral" fallback type
      let fallback = await prisma.trainingType.findFirst({ where: { name: "Livre" } });
      if (!fallback) {
        fallback = await prisma.trainingType.findFirst({ where: { id: { not: typeId } } });
      }
      if (fallback) {
        await prisma.trainingSession.updateMany({
          where: { trainingTypeId: typeId },
          data: { trainingTypeId: fallback.id },
        });
      }
    }

    await prisma.trainingType.delete({ where: { id: typeId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao excluir" }, { status: 500 });
  }
}
