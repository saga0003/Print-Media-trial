import { NextResponse } from "next/server";
import {
  readSavedReports,
  writeSavedReports,
  type SavedStageReport,
} from "@/lib/v8/stage-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, reports: await readSavedReports() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      config?: Record<string, unknown>;
    };
    const name = body.name?.trim();
    if (!name || !body.config) {
      return NextResponse.json({ ok: false, error: "Name and config are required" }, { status: 400 });
    }

    const reports = await readSavedReports();
    const now = new Date().toISOString();
    const id = body.id || `stage-report-${Date.now()}`;
    const existing = reports.find((report) => report.id === id);
    const report: SavedStageReport = {
      id,
      name,
      config: body.config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const next = [...reports.filter((item) => item.id !== id), report].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    await writeSavedReports(next);
    return NextResponse.json({ ok: true, report, reports: next });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  const reports = (await readSavedReports()).filter((report) => report.id !== id);
  await writeSavedReports(reports);
  return NextResponse.json({ ok: true, reports });
}
