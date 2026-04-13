import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.trainingSession.findUnique({
    where: { id: Number(id) },
    include: {
      athlete: true,
      coach: true,
      trainingType: true,
      wellbeing: true,
      pains: true,
      injuries: true,
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (body.date) body.date = new Date(body.date);
  // Never allow PUT to mark as completed — use /complete endpoint for that
  delete body.completedAt;
  if (body.status === "Concluído") delete body.status;
  const session = await prisma.trainingSession.update({ where: { id: Number(id) }, data: body });
  return NextResponse.json(session);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.trainingSession.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
