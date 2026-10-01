import { ServiceCase, JourneyStage, ModuleType } from '../types';

export type JourneySearchBy = 'auto' | 'registration' | 'vin' | 'jc' | 'phone' | 'name';

export interface JourneySearchFilters {
  query?: string;
  searchBy?: JourneySearchBy;
  zone?: string;
  region?: string;
  dealer?: string;
  workshop?: string;
  currentStage?: ModuleType | 'ALL';
  overallStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  inWorkshopOnly?: boolean;
  hasPendingActionsOnly?: boolean;
}

/**
 * Guess what kind of identifier the user typed so they don't have to pick a
 * "Search By" option first. Returns 'auto' when nothing specific matches,
 * which searches across every identifier.
 */
export function detectSearchType(raw: string): JourneySearchBy {
  const q = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return 'auto';
  if (/^JC\d{4,}$/.test(q)) return 'jc';
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(q) && /\d/.test(q) && /[A-Z]/.test(q)) return 'vin';
  if (/^\+?[\d-]{7,}$/.test(q)) return 'phone';
  if (/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{0,4}$/.test(q)) return 'registration';
  if (/^[A-Z .'-]+$/i.test(raw.trim()) && /[a-z]/i.test(raw)) return 'name';
  return 'auto';
}

const normalize = (v: string) => v.toLowerCase().replace(/[\s-]/g, '');

export const journeyService = {
  filterServiceCases(cases: ServiceCase[], filters: JourneySearchFilters): ServiceCase[] {
    return cases.filter((c) => {
      if (filters.query && filters.query.trim()) {
        const q = normalize(filters.query.trim());
        const searchBy = filters.searchBy || 'auto';
        const matches: Record<Exclude<JourneySearchBy, 'auto'>, boolean> = {
          registration: normalize(c.vehicleRegistration).includes(q),
          vin: normalize(c.vin).includes(q),
          jc: normalize(c.jcNumber).includes(q),
          phone: normalize(c.customerMobile).includes(q),
          name: normalize(c.customerName).includes(q),
        };
        const ok = searchBy === 'auto' ? Object.values(matches).some(Boolean) : matches[searchBy];
        if (!ok) return false;
      }

      if (filters.zone && filters.zone !== 'ALL' && c.zone !== filters.zone) return false;
      if (filters.region && filters.region !== 'ALL' && c.region !== filters.region) return false;
      if (filters.dealer && filters.dealer !== 'ALL' && !c.dealerName.includes(filters.dealer)) return false;
      if (filters.currentStage && filters.currentStage !== 'ALL' && c.currentStage !== filters.currentStage) return false;
      if (filters.overallStatus && filters.overallStatus !== 'ALL' && c.overallStatus !== filters.overallStatus) return false;

      // Filter for vehicles physically in workshop bays
      if (filters.inWorkshopOnly) {
        const workshopBayStages: ModuleType[] = ['JC Tracking', 'SPD', 'THD', 'EQC', 'Claim', 'BodyShop', 'IRA'];
        if (!workshopBayStages.includes(c.currentStage)) return false;
      }

      // Filter for JCs having pending action/approval blockers
      if (filters.hasPendingActionsOnly) {
        if (!c.pendingActionsCount || c.pendingActionsCount <= 0) return false;
      }

      return true;
    });
  },

  getStageColor(status: JourneyStage['status']) {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
          badge: 'bg-emerald-100 text-emerald-800',
          circle: 'bg-emerald-600 text-white border-emerald-600',
          line: 'bg-emerald-500',
        };
      case 'IN PROGRESS':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-400 ring-2 ring-blue-300',
          badge: 'bg-blue-100 text-blue-800 animate-pulse',
          circle: 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100',
          line: 'bg-blue-300',
        };
      case 'PENDING':
        return {
          bg: 'bg-slate-50 text-slate-500 border-slate-200',
          badge: 'bg-slate-100 text-slate-600',
          circle: 'bg-slate-200 text-slate-600 border-slate-300',
          line: 'bg-slate-200',
        };
      case 'BLOCKED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-300',
          badge: 'bg-rose-100 text-rose-800',
          circle: 'bg-rose-600 text-white border-rose-600',
          line: 'bg-rose-300',
        };
      case 'SKIPPED':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 border-dashed',
          badge: 'bg-amber-100 text-amber-800',
          circle: 'bg-amber-200 text-amber-800 border-amber-300',
          line: 'bg-slate-200',
        };
    }
  },
};
