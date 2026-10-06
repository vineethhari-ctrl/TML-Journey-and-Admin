/**
 * Vehicle render resolution: Vehicle Reg No → Vehicle Master (VIN, model, Variant Code, OEM colour code) → image URL.
 *
 * URL convention: /assets/vehicles/{model}/{vc_code}/{colour_code}_front_three_quarter.webp
 * Fallback order: exact colour → the VC's launch / hero shade → generic model silhouette (drawn in SVG, no request).
 */

export interface VehicleMasterRow {
  regNo: string;
  vin: string;
  model: string;
  variantCode?: string;
  variantName?: string;
  colourCode?: string;
  colourName?: string;
}

/** Launch / hero shade per Variant Code, used when the vehicle's own colour code is missing. */
export type HeroShades = Record<string, string>;

export interface VehicleIdentity {
  regNo: string;
  vin?: string;
  model?: string;
  variantCode?: string;
  variantName?: string;
  colourCode?: string;
  colourName?: string;
}

export const normaliseRegNo = (regNo: string) => regNo.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Step 1: resolve the vehicle from the master by registration number (spaces / dashes ignored). */
export function resolveVehicle(regNo: string, master: VehicleMasterRow[]): VehicleIdentity {
  const key = normaliseRegNo(regNo);
  const row = master.find((r) => normaliseRegNo(r.regNo) === key);
  return row ? { ...row, regNo: row.regNo } : { regNo };
}

/** "Nexon EV" → "nexon-ev": safe path segment. */
export const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const VEHICLE_ASSET_BASE = '/assets/vehicles';

/** Step 2: image URLs to try, best first. An empty list means "draw the generic silhouette". */
export function vehicleImageCandidates(v: VehicleIdentity, heroShades: HeroShades = {}, base = VEHICLE_ASSET_BASE): string[] {
  if (!v.model || !v.variantCode) return [];
  const dir = `${base}/${slug(v.model)}/${slug(v.variantCode)}`;
  const shades = [v.colourCode, heroShades[v.variantCode]].filter((c): c is string => !!c && c.trim() !== '');
  return [...new Set(shades.map((c) => `${dir}/${slug(c)}_front_three_quarter.webp`))];
}

/** Trim / colour label shown next to the Reg No, e.g. "XZ+ Lux · Daytona Grey". */
export const vehicleTrimLabel = (v: VehicleIdentity) => [v.variantName ?? v.variantCode, v.colourName].filter(Boolean).join(' · ');
