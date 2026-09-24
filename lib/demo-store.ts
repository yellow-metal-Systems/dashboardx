import {
  EXAMPLE_LEADS,
  EXAMPLE_PARTNERS,
  SOURCE_LABELS,
  type Lead,
  type LeadActivity,
  type LeadPartner,
  type LeadStatus,
  type PartnerStatus,
  type PartnerSummary,
} from "./leads";

export type PartnerSeed = LeadPartner & {
  status: PartnerStatus;
  createdAt: string;
};

// Example / demo data only — not real partner data.
export const PARTNER_SEEDS: PartnerSeed[] = [
  ...EXAMPLE_PARTNERS.map((p, i) => ({
    ...p,
    status: "active" as const,
    createdAt: ["2026-01-12", "2026-02-03", "2026-03-19"][i] ?? "2026-04-02",
  })),
  {
    id: "p_metro",
    orgName: "Metro Gold Connect",
    contactEmail: "hello@metrogoldconnect.example",
    status: "invited",
    createdAt: "2026-09-18",
  },
  {
    id: "p_kcc",
    orgName: "Karnataka Credit Co-op",
    contactEmail: "admin@kcc-coop.example",
    status: "disabled",
    createdAt: "2026-01-28",
  },
];

export function seedActivities(lead: Lead): Omit<LeadActivity, "id">[] {
  const submitter = lead.partner?.orgName ?? SOURCE_LABELS[lead.source];
  const items: Omit<LeadActivity, "id">[] = [
    {
      kind: "SUBMITTED",
      fromStatus: null,
      toStatus: null,
      message: lead.duplicateFlag
        ? `Lead submitted by ${submitter}, flagged as duplicate`
        : `Lead submitted by ${submitter}`,
      actor: null,
      createdAt: lead.createdAt,
    },
  ];
  if (lead.status !== "New") {
    items.push({
      kind: "STATUS_CHANGED",
      fromStatus: "New",
      toStatus: lead.status,
      message: `Status changed New → ${lead.status}`,
      actor: null,
      createdAt: lead.updatedAt,
    });
  }
  return items;
}

type DemoStore = {
  leads: Lead[];
  activities: Map<string, LeadActivity[]>;
};

const globalForDemo = globalThis as unknown as { leaddeskDemo?: DemoStore };

function createStore(): DemoStore {
  const leads = EXAMPLE_LEADS.map((l) => ({ ...l }));
  const activities = new Map(
    leads.map((l) => [
      l.id,
      seedActivities(l).map((a, i) => ({ id: `${l.id}_a${i}`, ...a })),
    ])
  );
  return { leads, activities };
}

// Process-wide in-memory store so status changes survive across requests in demo mode.
export function demoStore(): DemoStore {
  return (globalForDemo.leaddeskDemo ??= createStore());
}

export function demoUpdateStatus(id: string, status: LeadStatus): void {
  const store = demoStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead || lead.status === status) return;

  const from = lead.status;
  const now = new Date().toISOString();
  lead.status = status;
  lead.updatedAt = now;

  const list = store.activities.get(id) ?? [];
  list.push({
    id: `${id}_a${list.length}`,
    kind: "STATUS_CHANGED",
    fromStatus: from,
    toStatus: status,
    message: `Status changed ${from} → ${status}`,
    actor: null,
    createdAt: now,
  });
  store.activities.set(id, list);
}

export function demoPartnerSummaries(): PartnerSummary[] {
  const { leads } = demoStore();
  return PARTNER_SEEDS.map((p) => ({
    id: p.id,
    orgName: p.orgName,
    contactEmail: p.contactEmail,
    status: p.status,
    createdAt: new Date(p.createdAt).toISOString(),
    leadCount: leads.filter((l) => l.partner?.id === p.id).length,
  }));
}
