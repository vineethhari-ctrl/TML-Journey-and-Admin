/**
 * What a role sees: the screens it can open, the landing-page cards, the worklist tabs (and the default landing tab)
 * and the default columns. Built from the same rules the application uses (roleAccess.ts, workshopPolicy.ts,
 * navigation.ts), so the Role Catalogue can never disagree with what the user actually gets.
 */
import { NAV_PAGES, type NavPage } from '../config/navigation';
import { LANDING_CARDS, WORKSHOP_TABS, policyForRole, type WorkshopPolicy } from '../data/workshopPolicy';
import type { CatalogueRole } from '../data/roleCatalogue';
import { PLATFORM_PERMISSIONS, canRoleAccessRoute } from './roleAccess';

export interface RoleViews {
  /** True when the role has a portal view (otherwise it works in the dealer apps / back office only). */
  hasPortalView: boolean;
  screens: NavPage[];
  cards: Array<{ id: string; label: string; hidden: boolean }>;
  tabs: Array<{ id: string; label: string; hidden: boolean; landing: boolean }>;
  /** Default visible columns by worklist tab. */
  columns: Array<{ tab: string; label: string; visible: string[]; hidden: string[] }>;
  permissions: string[];
}

const EMPTY: RoleViews = { hasPortalView: false, screens: [], cards: [], tabs: [], columns: [], permissions: [] };

export function viewsForRole(role: CatalogueRole, policy: WorkshopPolicy): RoleViews {
  const id = role.platformRoleId;
  if (!id) return EMPTY;
  const screens = NAV_PAGES.filter((p) => canRoleAccessRoute(id, p.route) && !p.route.includes('?'));
  const wp = policyForRole(policy, id);
  const cardPolicy = wp.cards;
  const cards = (cardPolicy?.allowed ?? []).map((c) => ({
    id: c,
    label: LANDING_CARDS.find((x) => x.id === c)?.label ?? c,
    hidden: !!cardPolicy?.layout.hiddenTabs.includes(c),
  }));
  const tabs = WORKSHOP_TABS.filter((t) => wp.allowedTabs.includes(t.id)).map((t) => ({
    id: t.id,
    label: t.label,
    hidden: wp.tabs.hiddenTabs.includes(t.id),
    landing: wp.tabs.defaultLandingTab === t.id,
  }));
  const columns = Object.entries(wp.columns).map(([tab, c]) => ({
    tab,
    label: WORKSHOP_TABS.find((t) => t.id === tab)?.label ?? (tab === 'journey_search' ? 'Journey Search' : tab),
    visible: c.visibleColumns,
    hidden: c.hiddenColumns,
  }));
  return { hasPortalView: true, screens, cards, tabs, columns, permissions: PLATFORM_PERMISSIONS[id] };
}

/** "appointment.read" → { area: 'appointment', actions: ['read', ...] } for display. */
export function groupPermissions(codes: string[]): Array<{ area: string; actions: string[] }> {
  if (codes.includes('*')) return [{ area: 'Everything', actions: ['*'] }];
  const by = new Map<string, string[]>();
  codes.forEach((c) => {
    const [area, action] = c.split('.');
    by.set(area, [...(by.get(area) ?? []), action ?? '']);
  });
  return [...by].map(([area, actions]) => ({ area, actions }));
}
