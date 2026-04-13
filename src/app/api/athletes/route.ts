import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const where = status ? { isEnabled: status === "ativo" } : {};
  const athletes = await prisma.athlete.findMany({
    where,
    include: { coach: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(athletes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const athlete = await prisma.athlete.create({ data: body });
  return NextResponse.json(athlete, { status: 201 });
}
