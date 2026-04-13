import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const targetId = req.nextUrl.searchParams.get("targetId");

  const where: any = {};
  if (type) where.type = type;
  if (targetId) where.targetId = Number(targetId);

  const reports = await prisma.savedReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, targetId: true, targetName: true, periodStart: true, periodEnd: true, createdAt: true },
  });
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const report = await prisma.savedReport.create({
    data: {
      type: body.type,
      targetId: body.targetId,
      targetName: body.targetName,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      data: JSON.stringify(body.data),
    },
  });
  return NextResponse.json(report, { status: 201 });
}
