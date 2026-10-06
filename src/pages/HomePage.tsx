import React, { useMemo, useState } from 'react';
import { EyeOff, LayoutGrid, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ServiceTransformationPortal } from '../components/common/ServiceTransformationPortal';
import { TabCustomizer } from '../components/workshop/WorkshopTabBar';
import { CARD_PREF_STORAGE_KEY, useTabPreferences } from '../hooks/useTabPreferences';
import { WORKSHOP_MODULES } from '../data/masterCatalogue';
import { LANDING_CARDS, policyForRole, useWorkshopPolicy } from '../data/workshopPolicy';

/** Where a card leads inside this portal; the other module apps are built by the dealer-app team. */
const CARD_ROUTES: Record<string, string> = {
  customer_journey: '/journey',
  jc_creation: '/workshop',
  jc_tracking: '/workshop',
  receptionist: '/workshop',
  reception: '/workshop',
  bodyshop: '/workshop',
};

/**
 * Landing page (BU design): the module cards a role may use, in the user's own order and with the user's hidden
 * cards removed. Admins set the allowed cards and default layout per role (Workshop Tabs & Columns).
 */
export const HomePage: React.FC = () => {
  const { currentUser, activeRoleId, navigate, showToast } = useApp();
  const { policy } = useWorkshopPolicy();
  const cardPolicy = policyForRole(policy, activeRoleId).cards!;
  const cards = useMemo(() => LANDING_CARDS.filter((c) => cardPolicy.allowed.includes(c.id)), [cardPolicy.allowed]);
  const prefs = useTabPreferences({
    userId: currentUser.userId,
    roleId: activeRoleId,
    tabs: cards,
    roleDefault: cardPolicy.layout,
    maxInline: cards.length,
    storageKey: CARD_PREF_STORAGE_KEY,
  });
  const [customising, setCustomising] = useState(false);
  const visible = prefs.orderedTabs.filter((c) => !prefs.isHidden(c.id));
  const modules = visible.map((c) => WORKSHOP_MODULES.find((m) => m.code === c.id)!).filter(Boolean);
  const hiddenCount = prefs.orderedTabs.length - visible.length;

  const open = (code: string) => {
    const route = CARD_ROUTES[code];
    const title = WORKSHOP_MODULES.find((m) => m.code === code)?.title ?? code;
    if (route) navigate(route);
    else showToast(`"${title}" opens in the ${title} app (built by the dealer-app team).`, 'info');
  };

  const toolbar = (
    <div className="relative flex flex-wrap items-center justify-between gap-2" data-testid="home-toolbar">
      <p className="text-xs text-slate-500">
        Your cards: {visible.length} shown{hiddenCount > 0 ? `, ${hiddenCount} hidden` : ''}. Your layout resets to the default view when you log out.
      </p>
      <div className="flex items-center gap-2">
        {hiddenCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            <EyeOff className="h-3.5 w-3.5" /> {hiddenCount} hidden
          </span>
        )}
        <button type="button" onClick={prefs.reset} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
          <RotateCcw className="h-3.5 w-3.5" /> Default view
        </button>
        <button
          type="button"
          onClick={() => setCustomising(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4" /> Customise cards
        </button>
      </div>
      {customising && <TabCustomizer prefs={prefs} onClose={() => setCustomising(false)} title="My cards" noun="cards" showLanding={false} />}
    </div>
  );

  return (
    <div className="p-4 sm:p-6" data-testid="home-page">
      <ServiceTransformationPortal modules={modules} activeModuleCode="" onSelectModule={open} hideCounts toolbar={toolbar} />
    </div>
  );
};
