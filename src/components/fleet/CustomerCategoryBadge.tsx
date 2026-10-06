import React from 'react';
import { Truck, User } from 'lucide-react';
import { useFleetRegister } from '../../data/fleetRegister';
import { classifyVehicle } from '../../utils/fleetRegister';

/**
 * Fleet / Individual badge shown under the customer name. Fleet = chassis on the Fleet Register (active, in validity);
 * every other vehicle is Individual.
 */
export const CustomerCategoryBadge: React.FC<{ chassisNo: string; className?: string }> = ({ chassisNo, className = '' }) => {
  const { vehicles } = useFleetRegister();
  const { category, entry, reason } = classifyVehicle(chassisNo, vehicles);
  const fleet = category === 'FLEET';
  const title = fleet
    ? `Fleet vehicle${entry?.fleetAccount ? ` — ${entry.fleetAccount}` : ''} (on the Fleet Register)`
    : reason ?? 'Individual — chassis not on the Fleet Register';
  return (
    <span
      data-testid="customer-category"
      data-category={category}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        fleet ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'
      } ${className}`}
    >
      {fleet ? <Truck className="h-3 w-3" /> : <User className="h-3 w-3" />}
      {fleet ? 'Fleet' : 'Individual'}
      {fleet && entry?.fleetAccount && <span className="font-semibold normal-case tracking-normal">· {entry.fleetAccount}</span>}
    </span>
  );
};
