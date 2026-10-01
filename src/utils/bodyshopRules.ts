/**
 * Bodyshop inventory capture & insurance documents — pure functions over the master records.
 *
 *  - A Section applies when it is active, its BU matches, its Service Type is "All" (or matches
 *    the job) and the user's role is in its Roles.
 *  - Checkpoints belong to a Section by name; the Checkpoints sheet has no BU column, so a
 *    checkpoint applies to every BU that has its Section.
 *  - A row without a Checkpoint is captured at Sub-Section level (e.g. "Cabin": photo on Not OK).
 */

type Rec = Record<string, any>;

export const BS_MASTER_IDS = {
  sections: 'bs_inventory_sections',
  checkpoints: 'bs_inventory_checkpoints',
  insuranceDocs: 'bs_insurance_documents',
} as const;

export type BsRole = 'DSvAdv' | 'Driver';
export type JobType = 'General' | 'Accident';

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const yes = (v: unknown) => norm(v) === 'y';
const seq = (v: unknown) => (blank(v) ? Number.MAX_SAFE_INTEGER : Number(v));

/** "DSvAdv, Driver" → ['DSvAdv', 'Driver'] (also used for Acceptable Values). */
export const splitList = (text: unknown): string[] =>
  String(text ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

const serviceTypeMatches = (serviceType: unknown, job: JobType) => norm(serviceType) === 'all' || (job === 'Accident' && norm(serviceType) === 'accident');

export interface CaptureItem {
  id: string;
  /** Checkpoint, or the Sub-Section when captured at Sub-Section level. */
  label: string;
  subSection1: string;
  subSection2: string;
  role: string;
  acceptableValues: string[];
  mandatory: boolean;
  media?: { type: string; count: number; on: string };
}

export interface CaptureSection {
  id: string;
  section: string;
  sequencePriority: number;
  items: CaptureItem[];
}

/** What a user in `role` captures for a BU and job type, in the order the app shows it. */
export function resolveInventoryCapture(
  sections: Rec[],
  checkpoints: Rec[],
  q: { bu: string; job: JobType; role: BsRole }
): CaptureSection[] {
  return sections
    .filter(
      (s) =>
        yes(s.active) &&
        norm(s.bu) === norm(q.bu) &&
        serviceTypeMatches(s.serviceType, q.job) &&
        splitList(s.roles).some((r) => norm(r) === norm(q.role))
    )
    .sort((a, b) => seq(a.sequencePriority) - seq(b.sequencePriority))
    .map((s) => ({
      id: String(s.id),
      section: String(s.section),
      sequencePriority: Number(s.sequencePriority),
      items: checkpoints
        .filter(
          (c) =>
            yes(c.active) &&
            norm(c.section) === norm(s.section) &&
            norm(c.role) === norm(q.role) &&
            serviceTypeMatches(c.serviceType, q.job)
        )
        .sort((a, b) => seq(a.subSection1Seq) - seq(b.subSection1Seq) || seq(a.subSection2Seq) - seq(b.subSection2Seq) || seq(a.checkpointSeq) - seq(b.checkpointSeq))
        .map((c) => ({
          id: String(c.id),
          label: String(blank(c.checkpoint) ? c.subSection2 || c.subSection1 : c.checkpoint),
          subSection1: String(c.subSection1 ?? ''),
          subSection2: String(c.subSection2 ?? ''),
          role: String(c.role),
          acceptableValues: splitList(c.acceptableValues),
          mandatory: yes(c.mandatory),
          media: blank(c.mediaType)
            ? undefined
            : { type: String(c.mediaType), count: Number(c.imagesRequired) || 1, on: String(c.mediaApplicableOn || 'All') },
        })),
    }));
}

/** Active insurance documents in Sequence order. */
export const insuranceDocumentsToCollect = (docs: Rec[]) =>
  docs.filter((d) => yes(d.active)).sort((a, b) => seq(a.sequence) - seq(b.sequence));

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Rules that look at more than one field of a record (run on save and on workbook import). */
export const BODYSHOP_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [BS_MASTER_IDS.checkpoints]: (r) => {
    const e: Record<string, string> = {};
    if (!blank(r.imagesRequired) && blank(r.mediaType)) e.mediaType = 'Choose Image, Video or Video/Image when a number of images is set.';
    if (!blank(r.mediaApplicableOn) && blank(r.mediaType)) e.mediaType = 'Choose Image, Video or Video/Image when "Applicable On" is set.';
    if (!blank(r.subSection2Seq) && blank(r.subSection2)) e.subSection2 = 'Sub-Section Level 2 is required when its sequence is set.';
    if (!blank(r.checkpointSeq) && blank(r.checkpoint)) e.checkpoint = 'Checkpoint is required when its sequence is set.';
    return e;
  },
  [BS_MASTER_IDS.insuranceDocs]: (r): Record<string, string> =>
    yes(r.active) && /image/i.test(String(r.documentType)) && blank(r.imagesRequired)
      ? { imagesRequired: 'Set the number of images (1 or 2) for an active document that accepts images.' }
      : {},
};

/**
 * Everything in the Bodyshop masters that needs a BA decision before go-live —
 * including gaps in data that came straight from an Excel sheet.
 */
export function bodyshopHealthCheck(sections: Rec[], checkpoints: Rec[], docs: Rec[]): string[] {
  const issues: string[] = [];
  const sectionNames = new Set(sections.map((s) => norm(s.section)));
  const label = (c: Rec) => `${c.id} (${c.checkpoint || c.subSection2 || c.subSection1 || 'blank row'})`;

  // Sections: duplicate priority per BU, duplicate section per BU
  const byBu = new Map<string, Rec[]>();
  sections.filter((s) => yes(s.active)).forEach((s) => byBu.set(norm(s.bu), [...(byBu.get(norm(s.bu)) ?? []), s]));
  byBu.forEach((rows, bu) => {
    const seen = new Map<string, string>();
    const names = new Set<string>();
    rows.forEach((s) => {
      const p = String(s.sequencePriority);
      if (seen.has(p)) issues.push(`Sections ${bu.toUpperCase()}: "${s.section}" and "${seen.get(p)}" both have Sequence Priority ${p}.`);
      seen.set(p, String(s.section));
      if (names.has(norm(s.section))) issues.push(`Sections ${bu.toUpperCase()}: "${s.section}" appears twice.`);
      names.add(norm(s.section));
    });
  });

  checkpoints.forEach((c) => {
    if (blank(c.section)) issues.push(`Checkpoints ${label(c)}: Section is blank.`);
    else if (!sectionNames.has(norm(c.section))) issues.push(`Checkpoints ${label(c)}: Section "${c.section}" is not in the Sections master, so it is never shown.`);
    if (blank(c.subSection1)) issues.push(`Checkpoints ${label(c)}: Sub-Section Level 1 is blank.`);
    if (blank(c.mandatory) || blank(c.active)) issues.push(`Checkpoints ${label(c)}: Mandatory / Active is blank.`);
    if (blank(c.serviceType)) issues.push(`Checkpoints ${label(c)}: Service Type is blank.`);
    if (!blank(c.mediaType) && blank(c.mediaApplicableOn)) issues.push(`Checkpoints ${label(c)}: Choose when the photo / video is taken (All or Not OK).`);
    Object.values(BODYSHOP_RECORD_RULES[BS_MASTER_IDS.checkpoints](c)).forEach((m) => issues.push(`Checkpoints ${label(c)}: ${m}`));
    // The checkpoint's role must be allowed on its section
    const sec = sections.find((s) => norm(s.section) === norm(c.section));
    if (sec && !blank(c.role) && !splitList(sec.roles).some((r) => norm(r) === norm(c.role))) {
      issues.push(`Checkpoints ${label(c)}: role ${c.role} is not in the Roles of section "${sec.section}" (${sec.roles}), so nobody sees it.`);
    }
  });

  // The same Sub-Section must keep one sequence number
  const subSeq = new Map<string, { name: string; seqs: Set<string> }>();
  checkpoints
    .filter((c) => !blank(c.subSection1))
    .forEach((c) => {
      const k = `${norm(c.section)}|${norm(c.subSection1)}`;
      const entry = subSeq.get(k) ?? { name: String(c.subSection1), seqs: new Set<string>() };
      entry.seqs.add(blank(c.subSection1Seq) ? '(blank)' : String(c.subSection1Seq));
      subSeq.set(k, entry);
    });
  subSeq.forEach(({ name, seqs }) => {
    if (seqs.size > 1) issues.push(`Checkpoints: Sub-Section "${name}" has different sequence numbers (${[...seqs].join(', ')}).`);
  });

  // Sections nobody has filled in yet
  const used = new Set(checkpoints.filter((c) => yes(c.active)).map((c) => norm(c.section)));
  [...new Set(sections.filter((s) => yes(s.active)).map((s) => String(s.section)))]
    .filter((name) => !used.has(norm(name)))
    .forEach((name) => issues.push(`Sections: "${name}" has no active checkpoints yet.`));

  // Insurance documents
  const docSeq = new Map<string, string>();
  insuranceDocumentsToCollect(docs).forEach((d) => {
    const s = String(d.sequence);
    if (docSeq.has(s)) issues.push(`Insurance documents: "${d.documentCategory}" and "${docSeq.get(s)}" share Sequence ${s}.`);
    docSeq.set(s, String(d.documentCategory));
  });
  docs.forEach((d) => {
    Object.values(BODYSHOP_RECORD_RULES[BS_MASTER_IDS.insuranceDocs](d)).forEach((m) => issues.push(`Insurance documents ${d.id} (${d.documentCategory}): ${m}`));
  });

  // Documents captured in the inventory and in the insurance document master must agree
  checkpoints
    .filter((c) => yes(c.active) && norm(c.section) === 'documents')
    .forEach((c) => {
      const name = c.checkpoint || c.subSection1;
      const doc = docs.find((d) => norm(d.documentCategory) === norm(name));
      if (doc && !yes(doc.active)) {
        issues.push(`"${name}" is captured in the Documents section (${c.id}) but is inactive in Insurance Document Collection (${doc.id}) — keep one source.`);
      }
    });

  return issues;
}
