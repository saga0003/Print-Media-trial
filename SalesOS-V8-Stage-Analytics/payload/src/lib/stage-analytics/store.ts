import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SavedStageReport, StageEvent, StageLeadSnapshot, StageSyncState } from './types';

const defaultSyncState: StageSyncState = {
  schemaVersion: 1,
  lastFullSyncAt: null,
  lastIncrementalSyncAt: null,
  lastTrackingDate: null,
  lastLeadWriteDate: null,
  eventCount: 0,
  leadCount: 0,
};

function resolveRuntimePath(envName: string, fallback: string): string {
  return path.resolve(process.cwd(), process.env[envName] || fallback);
}

const paths = {
  events: () => resolveRuntimePath('STAGE_EVENTS_FILE', 'data/stage-events.runtime.json'),
  leads: () => resolveRuntimePath('STAGE_LEADS_FILE', 'data/stage-leads.runtime.json'),
  sync: () => resolveRuntimePath('STAGE_SYNC_FILE', 'data/stage-sync.runtime.json'),
  reports: () => resolveRuntimePath('STAGE_REPORTS_FILE', 'data/stage-reports.runtime.json'),
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temporary, filePath);
}

let eventsMemory: StageEvent[] | null = null;
let leadsMemory: StageLeadSnapshot[] | null = null;
let syncMemory: StageSyncState | null = null;
let reportsMemory: SavedStageReport[] | null = null;

export async function loadStageEvents(force = false): Promise<StageEvent[]> {
  if (!force && eventsMemory) return eventsMemory;
  eventsMemory = await readJson<StageEvent[]>(paths.events(), []);
  return eventsMemory;
}

export async function saveStageEvents(events: StageEvent[]): Promise<void> {
  eventsMemory = events;
  await writeJsonAtomic(paths.events(), events);
}

export async function loadStageLeads(force = false): Promise<StageLeadSnapshot[]> {
  if (!force && leadsMemory) return leadsMemory;
  leadsMemory = await readJson<StageLeadSnapshot[]>(paths.leads(), []);
  return leadsMemory;
}

export async function saveStageLeads(leads: StageLeadSnapshot[]): Promise<void> {
  leadsMemory = leads;
  await writeJsonAtomic(paths.leads(), leads);
}

export async function loadStageSyncState(force = false): Promise<StageSyncState> {
  if (!force && syncMemory) return syncMemory;
  syncMemory = await readJson<StageSyncState>(paths.sync(), defaultSyncState);
  return syncMemory;
}

export async function saveStageSyncState(state: StageSyncState): Promise<void> {
  syncMemory = state;
  await writeJsonAtomic(paths.sync(), state);
}

export async function loadSavedStageReports(force = false): Promise<SavedStageReport[]> {
  if (!force && reportsMemory) return reportsMemory;
  reportsMemory = await readJson<SavedStageReport[]>(paths.reports(), []);
  return reportsMemory;
}

export async function saveSavedStageReports(reports: SavedStageReport[]): Promise<void> {
  reportsMemory = reports;
  await writeJsonAtomic(paths.reports(), reports);
}

export function clearStageMemoryCache(): void {
  eventsMemory = null;
  leadsMemory = null;
  syncMemory = null;
  reportsMemory = null;
}
