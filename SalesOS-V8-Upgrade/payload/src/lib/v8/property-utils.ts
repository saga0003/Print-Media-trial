type PropertyEntry = {
  name?: string;
  string?: string;
  label?: string;
  value?: unknown;
  type?: string;
  selection?: Array<[string, string]> | Array<{ value: string; label: string }>;
};

function normaliseLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toDisplayValue(entry: PropertyEntry): string {
  const raw = entry.value;
  if (raw === null || raw === undefined || raw === false) return "";

  if (Array.isArray(raw)) {
    if (raw.length === 2 && typeof raw[1] === "string") return raw[1];
    return raw.map((item) => (Array.isArray(item) ? item[1] : item)).join(", ");
  }

  if (entry.type === "selection" && Array.isArray(entry.selection)) {
    for (const option of entry.selection) {
      if (Array.isArray(option) && String(option[0]) === String(raw)) return String(option[1]);
      if (!Array.isArray(option) && String(option.value) === String(raw)) return option.label;
    }
  }

  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function flattenLeadProperties(input: unknown): PropertyEntry[] {
  const output: PropertyEntry[] = [];

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;

    const object = value as Record<string, unknown>;
    const hasLabel = typeof object.string === "string" || typeof object.label === "string";
    const hasPropertyShape = hasLabel && ("value" in object || "name" in object);
    if (hasPropertyShape) output.push(object as PropertyEntry);

    for (const nested of Object.values(object)) {
      if (nested !== object.value && (Array.isArray(nested) || typeof nested === "object")) {
        visit(nested);
      }
    }
  };

  visit(input);
  return output;
}

export function propertyMap(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of flattenLeadProperties(input)) {
    const label = normaliseLabel(entry.string || entry.label || entry.name);
    if (!label) continue;
    const display = toDisplayValue(entry);
    if (display) result[label] = display;
  }
  return result;
}

function findByAliases(map: Record<string, string>, aliases: string[]): string {
  const normalised = aliases.map(normaliseLabel);
  for (const alias of normalised) {
    if (map[alias]) return map[alias];
  }
  for (const [key, value] of Object.entries(map)) {
    if (normalised.some((alias) => key.includes(alias) || alias.includes(key))) return value;
  }
  return "";
}

export function extractLeadDimensions(input: unknown) {
  const map = propertyMap(input);
  return {
    academicYear: findByAliases(map, ["Academic Year", "Admission Year"]),
    institute: findByAliases(map, ["Institute", "Institution", "Campus"]),
    grade: findByAliases(map, ["Grade Looking for", "Grade", "Class"]),
    product: findByAliases(map, ["Field of Interest", "Programme", "Program", "Course", "Stream"]),
    source: findByAliases(map, ["Lead Source", "Source"]),
  };
}
