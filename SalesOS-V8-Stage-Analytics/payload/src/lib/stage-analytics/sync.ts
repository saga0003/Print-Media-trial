import { chunkIds, many2oneId, many2oneName, StageOdooClient, type OdooDomain } from './odoo-client';
import { loadStageEvents, loadStageLeads, loadStageSyncState, saveStageEvents, saveStageLeads, saveStageSyncState } from './store';
import type { StageEvent, StageLeadSnapshot, StageSyncState } from './types';

const TRACKING_FIELDS = [
  'id',
  'field_id',
  'old_value_char',
  'new_value_char',
  'old_value_integer',
  'new_value_integer',
  'mail_message_id',
  'create_date',
];

const MESSAGE_FIELDS = ['id', 'res_id', 'date', 'author_id', 'model'];
const LEAD_FIELDS = [
  'id',
  'name',
  'contact_name',
  'phone',
  'email_from',
  'stage_id',
  'user_id',
  'team_id',
  'source_id',
  'create_date',
  'write_date',
  'expected_revenue',
  'activity_date_deadline',
  'description',
  'lead_properties',
];

const EXACT_STAGE_ORDER = [
  'New',
  'Unanswered/Not Attended',
  'Awaiting Decision',
  '1st Call',
  '2nd Call',
  '3rd Call',
  'Follow Up Post NEET Results',
  'Appointment Scheduled to Visit the School',
  'Visited School',
  'Written Entrance Exam',
  'Re-Test',
  'Entrance Exam Cleared',
  'Seat Confirmed: Payment Pending',
  'Seat Allotted',
  'Seat Rejected',
  'Entrance Exam Failed',
  'Wrong Lead',
  'Consult Management',
  'Duplicates',
  'Not Interested',
  'Rejection Approved',
  'Final Check',
  'Withdrawn',
];

export { EXACT_STAGE_ORDER };

function asString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return asString(object.display_name ?? object.name ?? object.label ?? object.value ?? '');
  }
  return String(value);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function flattenProperties(value: unknown, parent = '', target: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value)) {
    for (const item of value) flattenProperties(item, parent, target);
    return target;
  }
  if (!value || typeof value !== 'object') {
    if (parent && value !== undefined) target[parent] = value;
    return target;
  }

  const object = value as Record<string, unknown>;
  const label = asString(object.label ?? object.name ?? object.title ?? object.display_name);
  const directValue = object.value ?? object.values ?? object.answer ?? object.text;
  if (label && directValue !== undefined) target[normalizeKey(label)] = directValue;

  for (const [key, child] of Object.entries(object)) {
    if (['label', 'name', 'title', 'display_name', 'value', 'values', 'answer', 'text'].includes(key)) continue;
    const next = parent ? `${parent} ${key}` : key;
    if (child && typeof child === 'object') flattenProperties(child, next, target);
    else target[normalizeKey(next)] = child;
  }
  return target;
}

function propertyValue(properties: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(properties);
  for (const alias of aliases) {
    const exact = entries.find(([key]) => normalizeKey(key) === normalizeKey(alias));
    if (exact) return asString(exact[1]);
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const partial = entries.find(([key]) => normalizeKey(key).includes(normalizedAlias));
    if (partial) return asString(partial[1]);
  }
  return '';
}

function canonicalStage(value: string): string {
  const normalized = normalizeKey(value);
  const exact = EXACT_STAGE_ORDER.find((stage) => normalizeKey(stage) === normalized);
  if (exact) return exact;
  const aliases: Array<[RegExp, string]> = [
    [/appointment.*visit/, 'Appointment Scheduled to Visit the School'],
    [/visited.*school|campus.*visit|walk.?in/, 'Visited School'],
    [/written.*entrance|entrance.*written|took.*exam/, 'Written Entrance Exam'],
    [/entrance.*cleared|exam.*cleared/, 'Entrance Exam Cleared'],
    [/payment.*pending|seat.*confirmed/, 'Seat Confirmed: Payment Pending'],
    [/seat.*allotted|admission.*confirmed/, 'Seat Allotted'],
    [/re.?test/, 'Re-Test'],
    [/not.*interested/, 'Not Interested'],
    [/duplicate/, 'Duplicates'],
    [/withdraw/, 'Withdrawn'],
  ];
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? value.trim();
}

function isoOrEmpty(value: unknown): string {
  const text = asString(value);
  if (!text) return '';
  const normalized = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function leadSnapshot(row: Record<string, unknown>): StageLeadSnapshot {
  const properties = flattenProperties(row.lead_properties ?? {});
  return {
    id: Number(row.id),
    name: asString(row.name) || `Lead ${row.id}`,
    contactName: asString(row.contact_name),
    phone: asString(row.phone),
    email: asString(row.email_from),
    currentStage: canonicalStage(many2oneName(row.stage_id) || 'Unknown'),
    salespersonId: many2oneId(row.user_id),
    salesperson: many2oneName(row.user_id) || 'Unassigned',
    team: many2oneName(row.team_id),
    academicYear: propertyValue(properties, ['Academic Year']),
    institute: propertyValue(properties, ['Institute']),
    grade: propertyValue(properties, ['Grade Looking for', 'Grade']),
    programme: propertyValue(properties, ['Field of Interest', 'Programme', 'Program']),
    leadSource: many2oneName(row.source_id) || propertyValue(properties, ['Lead Source']),
    previousNeetScore: propertyValue(properties, ['Previous NEET Score', 'Previous NEET Score/Rank', 'Last NEET Attempt Score']),
    entranceExamMarks: propertyValue(properties, ['Entrance Exam Marks', 'NatSciX Qualifiers Score', 'NatSciX Prelims Score']),
    expectedRevenue: Number(row.expected_revenue || 0),
    createdAt: isoOrEmpty(row.create_date),
    updatedAt: isoOrEmpty(row.write_date),
    nextFollowUpDate: asString(row.activity_date_deadline) || propertyValue(properties, ['Next Follow Up Date']),
    description: asString(row.description),
    properties,
  };
}

function overlapIso(base: string | null, days: number): string | null {
  if (!base) return null;
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function fullHistoryStart(): string {
  const days = Math.max(30, Number(process.env.ODOO_STAGE_HISTORY_DAYS || 730));
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

async function fetchStageFieldId(client: StageOdooClient): Promise<number> {
  const rows = await client.searchRead<Record<string, unknown>>(
    'ir.model.fields',
    [['model', '=', 'crm.lead'], ['name', '=', 'stage_id']],
    ['id'],
    { limit: 1 },
  );
  const id = Number(rows[0]?.id || 0);
  if (!id) throw new Error('Could not resolve crm.lead.stage_id tracking field in Odoo.');
  return id;
}

async function fetchTrackingRows(client: StageOdooClient, fieldId: number, since: string): Promise<Record<string, unknown>[]> {
  const maxRows = Math.max(1000, Number(process.env.ODOO_STAGE_TRACKING_LIMIT || 50000));
  try {
    return await client.searchReadAll<Record<string, unknown>>(
      'mail.tracking.value',
      [['field_id', '=', fieldId], ['create_date', '>=', since]],
      TRACKING_FIELDS,
      { batchSize: 1000, maxRows, order: 'create_date asc,id asc' },
    );
  } catch {
    const messages = await client.searchReadAll<Record<string, unknown>>(
      'mail.message',
      [['model', '=', 'crm.lead'], ['date', '>=', since]],
      ['id', 'tracking_value_ids'],
      { batchSize: 1000, maxRows, order: 'date asc,id asc' },
    );
    const trackingIds = Array.from(new Set(messages.flatMap((message) => Array.isArray(message.tracking_value_ids) ? message.tracking_value_ids.map(Number) : []))).filter(Boolean);
    const rows: Record<string, unknown>[] = [];
    for (const ids of chunkIds(trackingIds, 500)) rows.push(...await client.read<Record<string, unknown>>('mail.tracking.value', ids, TRACKING_FIELDS));
    return rows.filter((row) => many2oneId(row.field_id) === fieldId);
  }
}

async function fetchMessages(client: StageOdooClient, ids: number[]): Promise<Map<number, Record<string, unknown>>> {
  const map = new Map<number, Record<string, unknown>>();
  for (const batch of chunkIds(ids, 500)) {
    const rows = await client.read<Record<string, unknown>>('mail.message', batch, MESSAGE_FIELDS);
    for (const row of rows) if (row.model === 'crm.lead') map.set(Number(row.id), row);
  }
  return map;
}

async function fetchLeads(client: StageOdooClient, since: string | null, requiredIds: number[]): Promise<StageLeadSnapshot[]> {
  const maxRows = Math.max(1000, Number(process.env.ODOO_STAGE_LEAD_LIMIT || 10000));
  const map = new Map<number, StageLeadSnapshot>();

  const domain: OdooDomain = since ? [['write_date', '>=', since]] : [];
  const changedRows = await client.searchReadAll<Record<string, unknown>>('crm.lead', domain, LEAD_FIELDS, {
    batchSize: 500,
    maxRows,
    order: 'write_date asc,id asc',
  });
  for (const row of changedRows) map.set(Number(row.id), leadSnapshot(row));

  const missing = requiredIds.filter((id) => !map.has(id));
  for (const ids of chunkIds(missing, 500)) {
    const rows = await client.read<Record<string, unknown>>('crm.lead', ids, LEAD_FIELDS);
    for (const row of rows) map.set(Number(row.id), leadSnapshot(row));
  }
  return Array.from(map.values());
}

function trackingStageName(row: Record<string, unknown>, side: 'old' | 'new', stageNames: Map<number, string>): string {
  const char = asString(row[`${side}_value_char`]);
  if (char) return canonicalStage(char);
  const integer = Number(row[`${side}_value_integer`] || 0);
  return canonicalStage(stageNames.get(integer) || (integer ? `Stage ${integer}` : ''));
}

async function fetchStageNames(client: StageOdooClient): Promise<Map<number, string>> {
  const rows = await client.searchReadAll<Record<string, unknown>>('crm.stage', [], ['id', 'name'], { batchSize: 200, maxRows: 1000, order: 'sequence asc,id asc' });
  return new Map(rows.map((row) => [Number(row.id), asString(row.name)]));
}

export async function syncStageHistory(mode: 'full' | 'incremental' = 'incremental'): Promise<StageSyncState> {
  const client = new StageOdooClient();
  const previousState = await loadStageSyncState(true);
  const full = mode === 'full' || !previousState.lastFullSyncAt;
  const since = full ? fullHistoryStart() : overlapIso(previousState.lastTrackingDate || previousState.lastIncrementalSyncAt, 3) || fullHistoryStart();
  const leadSince = full ? null : overlapIso(previousState.lastLeadWriteDate || previousState.lastIncrementalSyncAt, 3);

  const [fieldId, stageNames] = await Promise.all([fetchStageFieldId(client), fetchStageNames(client)]);
  const trackingRows = await fetchTrackingRows(client, fieldId, since);
  const messageIds = Array.from(new Set(trackingRows.map((row) => many2oneId(row.mail_message_id)).filter((id): id is number => Boolean(id))));
  const messageMap = await fetchMessages(client, messageIds);
  const requiredLeadIds = Array.from(new Set(Array.from(messageMap.values()).map((row) => Number(row.res_id)).filter(Boolean)));
  const changedLeads = await fetchLeads(client, leadSince, requiredLeadIds);

  const existingLeads = full ? [] : await loadStageLeads(true);
  const leadMap = new Map<number, StageLeadSnapshot>(existingLeads.map((lead) => [lead.id, lead]));
  for (const lead of changedLeads) leadMap.set(lead.id, lead);

  const incomingEvents: StageEvent[] = [];
  for (const tracking of trackingRows) {
    const messageId = many2oneId(tracking.mail_message_id);
    const message = messageId ? messageMap.get(messageId) : undefined;
    if (!message) continue;
    const leadId = Number(message.res_id || 0);
    const lead = leadMap.get(leadId);
    if (!lead) continue;
    const fromStage = trackingStageName(tracking, 'old', stageNames);
    const toStage = trackingStageName(tracking, 'new', stageNames);
    if (!toStage || fromStage === toStage) continue;
    const changedAt = isoOrEmpty(message.date || tracking.create_date);
    const authorId = many2oneId(message.author_id);
    const changedBy = many2oneName(message.author_id) || 'Unknown user';
    incomingEvents.push({
      id: `tracking-${Number(tracking.id)}`,
      trackingId: Number(tracking.id),
      leadId,
      leadName: lead.name,
      fromStage,
      toStage,
      changedAt,
      changedById: authorId,
      changedBy,
      assignedSalespersonId: lead.salespersonId,
      assignedSalesperson: lead.salesperson,
      academicYear: lead.academicYear,
      institute: lead.institute,
      grade: lead.grade,
      programme: lead.programme,
      leadSource: lead.leadSource,
      team: lead.team,
      expectedRevenue: lead.expectedRevenue,
    });
  }

  const existingEvents = full ? [] : await loadStageEvents(true);
  const eventMap = new Map(existingEvents.map((event) => [event.id, event]));
  for (const event of incomingEvents) eventMap.set(event.id, event);
  const events = Array.from(eventMap.values()).sort((a, b) => a.changedAt.localeCompare(b.changedAt) || a.id.localeCompare(b.id));
  const leads = Array.from(leadMap.values()).sort((a, b) => a.id - b.id);

  const now = new Date().toISOString();
  const lastTrackingDate = events.at(-1)?.changedAt || previousState.lastTrackingDate;
  const lastLeadWriteDate = leads.reduce<string | null>((latest, lead) => !latest || lead.updatedAt > latest ? lead.updatedAt : latest, previousState.lastLeadWriteDate);
  const state: StageSyncState = {
    schemaVersion: 1,
    lastFullSyncAt: full ? now : previousState.lastFullSyncAt,
    lastIncrementalSyncAt: now,
    lastTrackingDate,
    lastLeadWriteDate,
    eventCount: events.length,
    leadCount: leads.length,
    warning: trackingRows.length >= Number(process.env.ODOO_STAGE_TRACKING_LIMIT || 50000)
      ? 'The configured tracking-row limit was reached. Increase ODOO_STAGE_TRACKING_LIMIT and run another sync.'
      : undefined,
  };

  await Promise.all([saveStageEvents(events), saveStageLeads(leads), saveStageSyncState(state)]);
  return state;
}
