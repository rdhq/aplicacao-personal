import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const types = await prisma.trainingType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = await prisma.trainingType.create({ data: body });
  return NextResponse.json(type, { status: 201 });
}
