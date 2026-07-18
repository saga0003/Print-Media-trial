import { executeKw, readByIds, searchRead } from "./odoo-rpc";
import { extractLeadDimensions } from "./property-utils";
import { readStageStore, writeStageStore } from "./stage-store";
import type { StageEvent, StageSnapshot, StageStore } from "./stage-types";

type Many2One = false | [number, string];

type StageRow = { id: number; name: string; sequence?: number };
type FieldRow = { id: number; name: string; field_description?: string };
type MessageRow = {
  id: number;
  res_id: number;
  date: string;
  author_id: Many2One;
  tracking_value_ids: number[];
};
type TrackingRow = {
  id: number;
  mail_message_id: Many2One;
  field_id: Many2One;
  old_value_char?: string | false;
  new_value_char?: string | false;
  old_value_integer?: number | false;
  new_value_integer?: number | false;
};
type LeadRow = {
  id: number;
  name: string;
  contact_name?: string | false;
  create_date: string;
  write_date: string;
  stage_id: Many2One;
  user_id: Many2One;
  team_id: Many2One;
  source_id: Many2One;
  phone?: string | false;
  email_from?: string | false;
  expected_revenue?: number | false;
  lead_properties?: unknown;
};

const messageLimit = () => Number(process.env.ODOO_STAGE_MESSAGE_LIMIT || 50000);
const historyDays = () => Number(process.env.ODOO_STAGE_HISTORY_DAYS || 730);
const pageSize = () => Math.max(100, Math.min(1000, Number(process.env.ODOO_BATCH_SIZE || 500)));

function many2oneId(value: Many2One): number | null {
  return Array.isArray(value) ? Number(value[0]) : null;
}

function many2oneName(value: Many2One): string {
  return Array.isArray(value) ? String(value[1] || "") : "";
}

function toOdooDate(value: Date): string {
  return value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function startOfHistory(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - historyDays());
  return toOdooDate(date);
}

async function pagedSearchRead<T>(
  model: string,
  domain: unknown,
  fields: string[],
  order: string,
  hardLimit = Number.MAX_SAFE_INTEGER,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  const limit = pageSize();
  while (rows.length < hardLimit) {
    const batch = await searchRead<T>(model, domain, fields, {
      offset,
      limit: Math.min(limit, hardLimit - rows.length),
      order,
    });
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }
  return rows;
}

function chunks<T>(items: T[], size = 500): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function leadToSnapshot(lead: LeadRow): StageSnapshot {
  const dimensions = extractLeadDimensions(lead.lead_properties);
  return {
    leadId: lead.id,
    leadName: lead.name || `Lead #${lead.id}`,
    contactName: String(lead.contact_name || ""),
    createdAt: lead.create_date,
    updatedAt: lead.write_date,
    currentStageId: many2oneId(lead.stage_id),
    currentStage: many2oneName(lead.stage_id),
    assignedSalespersonId: many2oneId(lead.user_id),
    assignedSalesperson: many2oneName(lead.user_id) || "Unassigned",
    academicYear: dimensions.academicYear || "Not set",
    institute: dimensions.institute || "Not set",
    grade: dimensions.grade || "Not set",
    product: dimensions.product || "Not set",
    source: many2oneName(lead.source_id) || dimensions.source || "Not set",
    expectedRevenue: Number(lead.expected_revenue || 0),
    phone: String(lead.phone || ""),
    email: String(lead.email_from || ""),
  };
}

function mergeByKey<T>(existing: T[], incoming: T[], key: (item: T) => string | number): T[] {
  const map = new Map(existing.map((item) => [key(item), item]));
  for (const item of incoming) map.set(key(item), item);
  return Array.from(map.values());
}

export type StageSyncResult = {
  full: boolean;
  from: string;
  to: string;
  messageCount: number;
  trackingCount: number;
  stageEventCount: number;
  snapshotCount: number;
  totalStoredEvents: number;
  lastSyncedAt: string;
};

export async function syncStageHistory(options: {
  force?: boolean;
  from?: string;
  to?: string;
} = {}): Promise<StageSyncResult> {
  const previous = await readStageStore();
  const full = Boolean(options.force || previous.events.length === 0);
  const now = new Date();
  const to = options.to ? `${options.to} 23:59:59` : toOdooDate(now);

  let from = options.from ? `${options.from} 00:00:00` : startOfHistory();
  if (!full && previous.sync.latestMessageDate) {
    const overlap = new Date(previous.sync.latestMessageDate.replace(" ", "T") + "Z");
    overlap.setUTCDate(overlap.getUTCDate() - 1);
    from = toOdooDate(overlap);
  }

  const stages = await pagedSearchRead<StageRow>(
    "crm.stage",
    [],
    ["id", "name", "sequence"],
    "sequence asc,id asc",
    500,
  );
  const stageById = new Map(stages.map((stage) => [stage.id, stage.name]));
  const newStage = stages.find((stage) => stage.name.trim().toLowerCase() === "new") || stages[0];

  const stageFields = await searchRead<FieldRow>(
    "ir.model.fields",
    [
      ["model", "=", "crm.lead"],
      ["name", "=", "stage_id"],
    ],
    ["id", "name", "field_description"],
    { limit: 10 },
  );
  const stageFieldIds = new Set(stageFields.map((field) => field.id));

  const messages = await pagedSearchRead<MessageRow>(
    "mail.message",
    [
      ["model", "=", "crm.lead"],
      ["date", ">=", from],
      ["date", "<=", to],
    ],
    ["id", "res_id", "date", "author_id", "tracking_value_ids"],
    "id asc",
    messageLimit(),
  );

  const trackingIds = Array.from(
    new Set(messages.flatMap((message) => message.tracking_value_ids || [])),
  );
  const trackingRows: TrackingRow[] = [];
  for (const batch of chunks(trackingIds, 500)) {
    trackingRows.push(
      ...(await readByIds<TrackingRow>(
        "mail.tracking.value",
        batch,
        [
          "id",
          "mail_message_id",
          "field_id",
          "old_value_char",
          "new_value_char",
          "old_value_integer",
          "new_value_integer",
        ],
      )),
    );
  }

  const messageById = new Map(messages.map((message) => [message.id, message]));
  const stageTracking = trackingRows.filter((row) => {
    const fieldId = many2oneId(row.field_id);
    const fieldName = many2oneName(row.field_id).trim().toLowerCase();
    return (fieldId !== null && stageFieldIds.has(fieldId)) || fieldName === "stage";
  });

  const touchedLeadIds = Array.from(
    new Set(
      stageTracking
        .map((row) => messageById.get(many2oneId(row.mail_message_id) || 0)?.res_id)
        .filter((value): value is number => Boolean(value)),
    ),
  );

  let leadDomain: unknown = [];
  if (!full) {
    leadDomain = [
      "|",
      ["write_date", ">=", from],
      ["id", "in", touchedLeadIds.length ? touchedLeadIds : [0]],
    ];
  }

  const leadFields = [
    "id",
    "name",
    "contact_name",
    "create_date",
    "write_date",
    "stage_id",
    "user_id",
    "team_id",
    "source_id",
    "phone",
    "email_from",
    "expected_revenue",
    "lead_properties",
  ];

  let leads: LeadRow[];
  try {
    leads = await pagedSearchRead<LeadRow>(
      "crm.lead",
      leadDomain,
      leadFields,
      "id asc",
      Number(process.env.ODOO_LEAD_LIMIT || 10000),
    );
  } catch {
    // Some Odoo gateways do not accept logical-prefix domains reliably.
    leads = full
      ? await pagedSearchRead<LeadRow>(
          "crm.lead",
          [],
          leadFields,
          "id asc",
          Number(process.env.ODOO_LEAD_LIMIT || 10000),
        )
      : [];
    if (!full && touchedLeadIds.length) {
      for (const batch of chunks(touchedLeadIds, 500)) {
        leads.push(...(await readByIds<LeadRow>("crm.lead", batch, leadFields)));
      }
    }
  }

  const snapshots = leads.map(leadToSnapshot);
  const snapshotMap = new Map([
    ...previous.snapshots.map((snapshot) => [snapshot.leadId, snapshot] as const),
    ...snapshots.map((snapshot) => [snapshot.leadId, snapshot] as const),
  ]);

  const events: StageEvent[] = [];
  for (const tracking of stageTracking) {
    const messageId = many2oneId(tracking.mail_message_id);
    const message = messageId ? messageById.get(messageId) : undefined;
    if (!message?.res_id) continue;
    const lead = snapshotMap.get(message.res_id);
    if (!lead) continue;

    const oldStageId = Number(tracking.old_value_integer || 0) || null;
    const newStageId = Number(tracking.new_value_integer || 0) || null;
    const oldStage = String(tracking.old_value_char || "") || (oldStageId ? stageById.get(oldStageId) || "" : "");
    const newStage = String(tracking.new_value_char || "") || (newStageId ? stageById.get(newStageId) || "" : "");
    if (!newStage && !oldStage) continue;

    events.push({
      id: `${message.id}:${tracking.id}`,
      trackingId: tracking.id,
      messageId: message.id,
      leadId: lead.leadId,
      leadName: lead.leadName,
      contactName: lead.contactName,
      changedAt: message.date,
      changedById: many2oneId(message.author_id),
      changedBy: many2oneName(message.author_id) || "System",
      assignedSalespersonId: lead.assignedSalespersonId,
      assignedSalesperson: lead.assignedSalesperson,
      oldStageId,
      oldStage,
      newStageId,
      newStage,
      currentStageId: lead.currentStageId,
      currentStage: lead.currentStage,
      academicYear: lead.academicYear,
      institute: lead.institute,
      grade: lead.grade,
      product: lead.product,
      source: lead.source,
      expectedRevenue: lead.expectedRevenue,
      phone: lead.phone,
      email: lead.email,
    });
  }

  if (full && newStage) {
    for (const lead of snapshots) {
      events.push({
        id: `created:${lead.leadId}`,
        trackingId: null,
        messageId: null,
        leadId: lead.leadId,
        leadName: lead.leadName,
        contactName: lead.contactName,
        changedAt: lead.createdAt,
        changedById: null,
        changedBy: "Lead creation",
        assignedSalespersonId: lead.assignedSalespersonId,
        assignedSalesperson: lead.assignedSalesperson,
        oldStageId: null,
        oldStage: "",
        newStageId: newStage.id,
        newStage: newStage.name,
        currentStageId: lead.currentStageId,
        currentStage: lead.currentStage,
        academicYear: lead.academicYear,
        institute: lead.institute,
        grade: lead.grade,
        product: lead.product,
        source: lead.source,
        expectedRevenue: lead.expectedRevenue,
        phone: lead.phone,
        email: lead.email,
        synthetic: true,
      });
    }
  }

  const mergedEvents = mergeByKey(previous.events, events, (event) => event.id).sort((a, b) =>
    a.changedAt.localeCompare(b.changedAt),
  );
  const mergedSnapshots = mergeByKey(previous.snapshots, snapshots, (snapshot) => snapshot.leadId).sort(
    (a, b) => a.leadId - b.leadId,
  );
  const latestMessage = messages[messages.length - 1];
  const lastSyncedAt = new Date().toISOString();

  const store: StageStore = {
    version: 1,
    generatedAt: lastSyncedAt,
    lastSyncedAt,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      sequence: Number(stage.sequence || 0),
    })),
    events: mergedEvents,
    snapshots: mergedSnapshots,
    sync: {
      fullFrom: full ? from : previous.sync.fullFrom || from,
      fullTo: to,
      latestMessageId: latestMessage?.id || previous.sync.latestMessageId || 0,
      latestMessageDate: latestMessage?.date || previous.sync.latestMessageDate || "",
    },
  };

  await writeStageStore(store);

  return {
    full,
    from,
    to,
    messageCount: messages.length,
    trackingCount: trackingRows.length,
    stageEventCount: events.length,
    snapshotCount: snapshots.length,
    totalStoredEvents: store.events.length,
    lastSyncedAt,
  };
}
