import { NextResponse } from "next/server";
import { syncStageHistory } from "@/lib/v8/stage-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
      from?: string;
      to?: string;
    };
    const result = await syncStageHistory({
      force: Boolean(body.force),
      from: body.from || undefined,
      to: body.to || undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Stage history sync failed",
      },
      { status: 500 },
    );
  }
}
