import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Phone } from 'lucide-react';
import { useDpdp } from '../../hooks/useDpdp';
import { canSeeFullName, maskName, maskPhone } from '../../utils/dpdp';

const iconBtn = 'inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer';

/** Re-mask automatically after this long, so a revealed value does not stay on screen. */
export const REVEAL_MS = 30_000;

function useReveal(onReveal: () => void) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), REVEAL_MS);
    return () => clearTimeout(t);
  }, [shown]);
  return {
    shown,
    toggle: () => {
      if (!shown) onReveal();
      setShown(!shown);
    },
  };
}

interface PhoneProps {
  phone: string;
  /** Vehicle the record belongs to (audit key). */
  vehicleRegNo: string;
  /** Show the click-to-call button (default true). */
  cti?: boolean;
}

/** Masked mobile number with CTI click-to-call; authorised users can reveal it (audited). */
export const MaskedPhone: React.FC<PhoneProps> = ({ phone, vehicleRegNo, cti = true }) => {
  const { canUnmask, logUnmask, callCustomer } = useDpdp();
  const { shown, toggle } = useReveal(() => logUnmask(vehicleRegNo, 'phone'));
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600" data-testid="masked-phone">
      <span data-testid="masked-phone-value">{shown ? phone : maskPhone(phone)}</span>
      {cti && (
        <button type="button" className={iconBtn} onClick={(e) => {
            e.stopPropagation();
            callCustomer(vehicleRegNo);
          }} aria-label={`Call customer of ${vehicleRegNo}`} title="Call via CTI">
          <Phone className="h-3.5 w-3.5 text-emerald-700" />
        </button>
      )}
      {canUnmask && (
        <button type="button" className={iconBtn} onClick={(e) => {
            e.stopPropagation();
            toggle();
          }} aria-label={shown ? 'Hide mobile number' : 'Show mobile number'} title={shown ? 'Hide' : 'Show (logged)'}>
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
};

interface NameProps {
  name: string;
  vehicleRegNo: string;
  /** Service Advisor assigned to the job: they always see the full name. */
  assignedSa: { id?: string; name?: string };
  className?: string;
}

/** Customer name: full for the assigned SA, initials for everyone else (authorised users can reveal, audited). */
export const MaskedName: React.FC<NameProps> = ({ name, vehicleRegNo, assignedSa, className = '' }) => {
  const { viewer, canUnmask, logUnmask } = useDpdp();
  const { shown, toggle } = useReveal(() => logUnmask(vehicleRegNo, 'name'));
  if (canSeeFullName(viewer, assignedSa)) return <span className={className} data-testid="masked-name">{name}</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} data-testid="masked-name">
      <span>{shown ? name : maskName(name)}</span>
      {canUnmask && (
        <button type="button" className={iconBtn} onClick={(e) => {
            e.stopPropagation();
            toggle();
          }} aria-label={shown ? 'Hide customer name' : 'Show customer name'} title={shown ? 'Hide' : 'Show (logged)'}>
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
};
