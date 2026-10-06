/**
 * Rows copied with Ctrl+B are edited in place and saved together with Ctrl+S. This checks them the same way a single
 * new row is checked (field rules, unique id, no identical row, no clashing key), against the saved rows and the
 * copies before them. Nothing is saved while any copy has a problem.
 */
import type { MasterConfig } from '../data/masterCatalogue';
import { masterValidationSchema } from './masterValidationSchema';
import { findEqcConflict } from './eqcRules';
import { findThdConflict } from './thdRules';
import { findClaimConflict } from './claimRules';
import { findCommonLovConflict } from './commonLov';
import { DUPLICATE_RECORD_MESSAGE, duplicateMessage, findIdenticalRecord } from './recordDuplicates';

type Rec = Record<string, any>;

export interface CopyCheck {
  /** Clean copies in the same order, ready to save. */
  sanitized: Rec[];
  /** Problems per copy id (field problems, then duplicates). */
  errors: Record<string, string[]>;
  /** Only the "Duplicate record cannot exist" problems per copy id (for live highlighting). */
  duplicates: Record<string, string[]>;
}

const withPrefix = (m: string) => (m.startsWith(DUPLICATE_RECORD_MESSAGE) ? m : `${DUPLICATE_RECORD_MESSAGE}: ${m}`);

export function checkCopies(master: MasterConfig, copies: Rec[]): CopyCheck {
  const errors: Record<string, string[]> = {};
  const duplicates: Record<string, string[]> = {};
  const sanitized: Rec[] = [];
  const add = (id: string, msg: string, dup = false) => {
    (errors[id] ??= []).push(msg);
    if (dup) (duplicates[id] ??= []).push(msg);
  };
  copies.forEach((copy, i) => {
    const { _after, ...data } = copy;
    const res = masterValidationSchema.validateRecord(master.fields, data, master.id);
    if (!res.isValid) Object.values(res.errors).forEach((m) => add(copy.id, String(m)));
    const rec = res.isValid ? res.sanitizedRecord : data;
    sanitized.push(rec);
    const others = [...master.records, ...sanitized.slice(0, i)];
    if (!rec.id || others.some((o) => String(o.id) === String(rec.id))) add(copy.id, `Record ID "${rec.id ?? ''}" is missing or already exists.`);
    const identical = findIdenticalRecord(master.fields, rec, others);
    if (identical) add(copy.id, duplicateMessage(identical), true);
    else if (res.isValid) {
      const conflict = findEqcConflict(master.id, rec, others) ?? findThdConflict(master.id, rec, others) ?? findClaimConflict(master.id, rec, others) ?? findCommonLovConflict(master.id, rec, others);
      if (conflict) add(copy.id, withPrefix(conflict), true);
    }
  });
  return { sanitized, errors, duplicates };
}

/** Saved rows with the copies inserted straight after the row each was copied from. */
export function insertCopies(records: Rec[], copies: Rec[], sanitized: Rec[]): Rec[] {
  const after = new Map<string, Rec[]>();
  copies.forEach((c, i) => after.set(c._after, [...(after.get(c._after) ?? []), sanitized[i]]));
  const placed = new Set<Rec>();
  const out = records.flatMap((r) => {
    const add = after.get(String(r.id)) ?? [];
    add.forEach((a) => placed.add(a));
    return [r, ...add];
  });
  // Copies of a copy, or whose source is gone, go to the top
  return [...sanitized.filter((s) => !placed.has(s)), ...out];
}
