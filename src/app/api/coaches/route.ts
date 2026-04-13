import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const coaches = await prisma.coach.findMany({
    include: { _count: { select: { athletes: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(coaches);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const coach = await prisma.coach.create({ data: body });
  return NextResponse.json(coach, { status: 201 });
}
