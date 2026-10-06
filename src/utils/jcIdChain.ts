import type { JourneyStage, ServiceCase } from '../types';

/**
 * ID chain under a Job Card (JC Creation walkthrough, 6 Oct 2026):
 *   Appointment ID → Visit ID → SR ID → Pre-JC → JC, with MRs linked to the JC and the customer updates sent,
 * all visible under the JC. Pre-JC is a new micro-service between SR and JC; an SR created at gate-in goes straight to
 * CRM, and auto SR creation in Service Buddy continues.
 *
 * The BA gave no more detail. Assumptions (shown on the screen): a walk-in has no Appointment ID; every other link is
 * required in order; a JC can have several MRs; timestamps never go backwards along the chain. In production each
 * module publishes its ID with the JC number in its journey event; here the chain is derived from the mock timeline.
 */

export type IdKind = 'APPOINTMENT' | 'VISIT' | 'SR' | 'PRE_JC' | 'JC' | 'MR';

export type IdLinkStatus = 'CREATED' | 'AWAITED' | 'NOT_APPLICABLE';

export interface IdLink {
  kind: IdKind;
  id?: string;
  status: IdLinkStatus;
  /** YYYY-MM-DD HH:MM */
  createdAt?: string;
  /** System that issues the ID */
  source: string;
  note?: string;
}

export type UpdateChannel = 'SMS' | 'WhatsApp' | 'Email';

export interface CustomerUpdate {
  id: string;
  at: string;
  channel: UpdateChannel;
  /** Template text only — never the customer's name or number (DPDP). */
  message: string;
  linkedKind: IdKind;
  linkedId: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
}

export interface JcIdChain {
  jcNumber: string;
  arrival: 'Appointment' | 'Walk-In';
  /** Where the SR came from */
  srOrigin: 'Gate-In → CRM' | 'Service Buddy (auto SR)';
  /** Appointment → Visit → SR → Pre-JC → JC */
  links: IdLink[];
  mrs: IdLink[];
  updates: CustomerUpdate[];
}

export const ID_KIND_LABEL: Record<IdKind, string> = {
  APPOINTMENT: 'Appointment ID',
  VISIT: 'Visit ID',
  SR: 'SR ID',
  PRE_JC: 'Pre-JC',
  JC: 'JC No.',
  MR: 'MR',
};

export const ID_CHAIN_ORDER: IdKind[] = ['APPOINTMENT', 'VISIT', 'SR', 'PRE_JC', 'JC'];

/** Prefixes of the IDs, so Journey Search can recognise them. */
export const LINKED_ID_RE = /^(APT|VIS|SR|PJC|MR)-[A-Z0-9-]+$/;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function addMinutes(dateTime: string, minutes: number): string {
  const [d, t = '00:00'] = dateTime.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const dt = new Date(y, mo - 1, da, h, mi + minutes);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const reached = (s?: JourneyStage) => !!s && (s.status === 'COMPLETED' || s.status === 'IN PROGRESS' || s.status === 'BLOCKED');

/**
 * Build the chain for one JC from its timeline (mock stand-in for the journey events each module will send).
 * Deterministic: the same case always gives the same IDs.
 */
export function buildIdChain(sc: ServiceCase, stages: JourneyStage[]): JcIdChain {
  const seed = Number(sc.jcNumber.slice(-4)) || 1;
  const day = sc.createdAt.slice(0, 10).replace(/-/g, '');
  const byModule = (m: JourneyStage['module']) => stages.find((s) => s.module === m);
  const appt = byModule('Appointment');
  const reception = byModule('P&D / Reception');
  const gate = byModule('Security');
  const jcc = byModule('JC Creation');
  const spd = byModule('SPD');
  const tracking = byModule('JC Tracking');

  // The demo JC came by appointment; one in four of the others is a walk-in
  const arrival: JcIdChain['arrival'] = sc.jcNumber === 'JC20260930001234' || seed % 4 !== 3 ? 'Appointment' : 'Walk-In';
  const srOrigin: JcIdChain['srOrigin'] = seed % 5 === 2 ? 'Service Buddy (auto SR)' : 'Gate-In → CRM';
  const start = sc.createdAt.slice(0, 16);

  const visitAt = gate?.startedAt ?? reception?.startedAt ?? start;
  const gateReached = reached(gate) || reached(reception) || reached(jcc);
  const preJcAt = jcc?.startedAt;
  const jcAt = jcc?.completedAt ?? jcc?.startedAt;

  const links: IdLink[] = [
    arrival === 'Walk-In'
      ? { kind: 'APPOINTMENT', status: 'NOT_APPLICABLE', source: 'Appointment app', note: 'Walk-in — no appointment' }
      : {
          kind: 'APPOINTMENT',
          id: appt?.referenceNumber?.startsWith('APT-') ? appt.referenceNumber : `APT-${day}-${pad(seed % 10000, 4)}`,
          status: 'CREATED',
          createdAt: appt?.startedAt ?? addMinutes(start, -24 * 60),
          source: 'Appointment app',
        },
    gateReached
      ? { kind: 'VISIT', id: `VIS-${day}-${pad(seed % 10000, 4)}`, status: 'CREATED', createdAt: visitAt, source: 'Gate-In (Security)' }
      : { kind: 'VISIT', status: 'AWAITED', source: 'Gate-In (Security)' },
    gateReached
      ? {
          kind: 'SR',
          id: `SR-${day}-${pad((seed * 7) % 100000, 5)}`,
          status: 'CREATED',
          createdAt: addMinutes(visitAt, 2),
          source: srOrigin === 'Gate-In → CRM' ? 'CRM (created at gate-in)' : 'Service Buddy (auto SR)',
        }
      : { kind: 'SR', status: 'AWAITED', source: 'CRM' },
    preJcAt && reached(jcc)
      ? { kind: 'PRE_JC', id: `PJC-${day}-${pad(seed % 10000, 4)}`, status: 'CREATED', createdAt: preJcAt, source: 'Pre-JC service (new)' }
      : { kind: 'PRE_JC', status: 'AWAITED', source: 'Pre-JC service (new)' },
    jcc?.status === 'COMPLETED' && jcAt
      ? { kind: 'JC', id: sc.jcNumber, status: 'CREATED', createdAt: jcAt, source: 'DMS' }
      : { kind: 'JC', id: sc.jcNumber, status: 'AWAITED', source: 'DMS', note: 'JC number reserved; opens when JC Creation completes' },
  ];

  // MRs exist once the vehicle is on the floor / parts are requested
  const mrs: IdLink[] = [];
  const mrStage = reached(spd) ? spd : reached(tracking) ? tracking : undefined;
  if (mrStage?.startedAt && links[4].status === 'CREATED') {
    const count = 1 + (seed % 2);
    for (let i = 0; i < count; i++) {
      mrs.push({
        kind: 'MR',
        id: `MR-${day}-${pad((seed * 3 + i) % 10000, 4)}`,
        status: 'CREATED',
        createdAt: addMinutes(mrStage.startedAt, 10 + i * 35),
        source: 'JC Tracking / SPD',
        note: i === 0 ? 'Parts for the job card' : 'Additional parts',
      });
    }
  }

  const updates: CustomerUpdate[] = [];
  const push = (link: IdLink, channel: UpdateChannel, message: string, offset = 1) => {
    if (link.status !== 'CREATED' || !link.id || !link.createdAt) return;
    updates.push({
      id: `UPD-${sc.jcNumber.slice(-4)}-${pad(updates.length + 1)}`,
      at: addMinutes(link.createdAt, offset),
      channel,
      message,
      linkedKind: link.kind,
      linkedId: link.id,
      status: (seed + updates.length) % 9 === 4 ? 'FAILED' : 'DELIVERED',
    });
  };
  push(links[0], 'WhatsApp', 'Appointment confirmed with date, time and workshop.');
  push(links[1], 'SMS', 'Vehicle checked in at the workshop.');
  push(links[2], 'SMS', 'Service request registered; reference number shared.');
  push(links[4], 'WhatsApp', 'Job card opened; estimate and expected delivery shared.', 3);
  if (mrs.length > 1) push(mrs[1], 'WhatsApp', 'Additional parts needed; approval link shared.', 5);

  return { jcNumber: sc.jcNumber, arrival, srOrigin, links, mrs, updates };
}

/** Every ID in the chain (for search). */
export const chainIds = (chain: JcIdChain): string[] =>
  [...chain.links, ...chain.mrs].map((l) => l.id).filter((id): id is string => !!id);

/**
 * Consistency checks the backend should also run when IDs arrive: no link without the ones before it,
 * no time going backwards, MRs only under an open JC, no ID used twice.
 */
export function validateIdChain(chain: JcIdChain): string[] {
  const issues: string[] = [];
  const order = chain.links;
  order.forEach((link, i) => {
    if (link.status !== 'CREATED') return;
    if (!link.id) issues.push(`${ID_KIND_LABEL[link.kind]} is marked created but has no ID.`);
    for (let j = 0; j < i; j++) {
      const prev = order[j];
      if (prev.status === 'AWAITED') issues.push(`${ID_KIND_LABEL[link.kind]} exists but ${ID_KIND_LABEL[prev.kind]} is still awaited.`);
      if (prev.status === 'CREATED' && prev.createdAt && link.createdAt && link.createdAt < prev.createdAt) {
        issues.push(`${ID_KIND_LABEL[link.kind]} is time-stamped before ${ID_KIND_LABEL[prev.kind]}.`);
      }
    }
  });
  if (chain.arrival === 'Appointment' && order[0].status === 'NOT_APPLICABLE') issues.push('Appointment arrival without an Appointment ID.');
  const jc = order.find((l) => l.kind === 'JC');
  if (chain.mrs.length && jc?.status !== 'CREATED') issues.push('MR raised before the JC was opened.');
  chain.mrs.forEach((mr) => {
    if (jc?.createdAt && mr.createdAt && mr.createdAt < jc.createdAt) issues.push(`${mr.id} is time-stamped before the JC.`);
  });
  const ids = chainIds(chain);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) issues.push(`${dup} appears twice in the chain.`);
  return [...new Set(issues)];
}
