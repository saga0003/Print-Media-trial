import { NextResponse } from "next/server";
import { analyseStageStore } from "@/lib/v8/stage-analytics";
import { readStageStore } from "@/lib/v8/stage-store";
import type { StageAnalyticsFilters, StageCohort } from "@/lib/v8/stage-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cohorts = new Set<StageCohort>([
  "all",
  "admitted",
  "cleared_not_admitted",
  "payment_pending_not_allotted",
  "visited_not_exam",
  "lost_after_visit",
]);

const responseCache = new Map<string, { expires: number; value: unknown }>();

function parseFilters(url: URL): StageAnalyticsFilters {
  const cohortValue = url.searchParams.get("cohort") || "all";
  const granularityValue = url.searchParams.get("granularity") || "month";
  return {
    from: url.searchParams.get("from") || "",
    to: url.searchParams.get("to") || "",
    academicYear: url.searchParams.get("academicYear") || "ALL",
    institute: url.searchParams.get("institute") || "ALL",
    grade: url.searchParams.get("grade") || "ALL",
    product: url.searchParams.get("product") || "ALL",
    salesperson: url.searchParams.get("salesperson") || "ALL",
    cohort: cohorts.has(cohortValue as StageCohort) ? (cohortValue as StageCohort) : "all",
    stages: (url.searchParams.get("stages") || "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean),
    granularity:
      granularityValue === "day" || granularityValue === "week" ? granularityValue : "month",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseFilters(url);
    const cacheKey = JSON.stringify(filters);
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ ok: true, cached: true, data: cached.value });
    }

    const store = await readStageStore();
    if (store.events.length === 0) {
      return NextResponse.json({
        ok: true,
        cached: false,
        needsSync: true,
        data: analyseStageStore(store, filters),
      });
    }

    const data = analyseStageStore(store, filters);
    responseCache.set(cacheKey, { expires: Date.now() + 60_000, value: data });
    if (responseCache.size > 100) {
      const first = responseCache.keys().next().value as string | undefined;
      if (first) responseCache.delete(first);
    }
    return NextResponse.json({ ok: true, cached: false, needsSync: false, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Stage analytics failed",
      },
      { status: 500 },
    );
  }
}
