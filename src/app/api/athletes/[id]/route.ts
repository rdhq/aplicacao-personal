import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await prisma.athlete.findUnique({
    where: { id: Number(id) },
    include: {
      coach: { select: { name: true } },
      sessions: {
        include: { trainingType: true, coach: { select: { name: true } }, wellbeing: true, pains: true, injuries: true },
        orderBy: { date: "desc" },
        take: 50,
      },
      pains: { orderBy: { date: "desc" }, take: 20 },
      injuries: { orderBy: { date: "desc" }, take: 20 },
    },
  });
  if (!athlete) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(athlete);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const athlete = await prisma.athlete.update({ where: { id: Number(id) }, data: body });
  return NextResponse.json(athlete);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.athlete.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
