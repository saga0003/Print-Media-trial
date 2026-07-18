import fs from "node:fs/promises";
import path from "node:path";
import type { StageStore } from "./stage-types";

function resolveDataPath(envName: string, fallback: string): string {
  const configured = process.env[envName]?.trim() || fallback;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export const stageEventsPath = () =>
  resolveDataPath("STAGE_EVENTS_FILE", "data/stage-events.runtime.json");

export const stageReportsPath = () =>
  resolveDataPath("STAGE_REPORTS_FILE", "data/stage-reports.runtime.json");

export function emptyStageStore(): StageStore {
  const now = new Date().toISOString();
  return {
    version: 1,
    generatedAt: now,
    lastSyncedAt: "",
    stages: [],
    events: [],
    snapshots: [],
    sync: {
      fullFrom: "",
      fullTo: "",
      latestMessageId: 0,
      latestMessageDate: "",
    },
  };
}

export async function readStageStore(): Promise<StageStore> {
  try {
    const content = await fs.readFile(stageEventsPath(), "utf8");
    const parsed = JSON.parse(content) as StageStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return emptyStageStore();
    return parsed;
  } catch {
    return emptyStageStore();
  }
}

export async function writeStageStore(store: StageStore): Promise<void> {
  const file = stageEventsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temporary, file);
}

export type SavedStageReport = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
};

export async function readSavedReports(): Promise<SavedStageReport[]> {
  try {
    const content = await fs.readFile(stageReportsPath(), "utf8");
    const parsed = JSON.parse(content) as SavedStageReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeSavedReports(reports: SavedStageReport[]): Promise<void> {
  const file = stageReportsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(reports, null, 2), "utf8");
  await fs.rename(temporary, file);
}
