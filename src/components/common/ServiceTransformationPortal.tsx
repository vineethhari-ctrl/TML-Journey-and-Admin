import React from 'react';
import { MasterModuleMeta } from '../../data/masterCatalogue';

interface ServiceTransformationPortalProps {
  modules: MasterModuleMeta[];
  activeModuleCode: string;
  onSelectModule: (moduleCode: string) => void;
  moduleCounts?: Record<string, { masters: number; records: number }>;
  matches?: Record<string, number>;
  searchQuery?: string;
  compact?: boolean;
  /** Home page: no master counts on the cards. */
  hideCounts?: boolean;
  /** Extra controls under the banner, e.g. "Customise cards". */
  toolbar?: React.ReactNode;
}

// Custom high-fidelity illustrations matching the 12 official transformation cards
const ModuleIllustration: React.FC<{ code: string }> = ({ code }) => {
  switch (code) {
    case 'appointment':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Desk Calendar Base */}
          <rect x="14" y="16" width="60" height="52" rx="10" fill="#F0F7FF" stroke="#3B82F6" strokeWidth="2.5" />
          <path d="M14 26C14 20.4772 18.4772 16 24 16H64C69.5228 16 74 20.4772 74 26V30H14V26Z" fill="#1D4ED8" />
          {/* Spiral rings */}
          <circle cx="28" cy="16" r="3" fill="#93C5FD" stroke="#1E40AF" strokeWidth="1.5" />
          <circle cx="44" cy="16" r="3" fill="#93C5FD" stroke="#1E40AF" strokeWidth="1.5" />
          <circle cx="60" cy="16" r="3" fill="#93C5FD" stroke="#1E40AF" strokeWidth="1.5" />
          {/* Calendar grid dots */}
          <rect x="22" y="38" width="6" height="5" rx="1.5" fill="#93C5FD" />
          <rect x="34" y="38" width="6" height="5" rx="1.5" fill="#93C5FD" />
          <rect x="46" y="38" width="6" height="5" rx="1.5" fill="#2563EB" />
          <rect x="22" y="48" width="6" height="5" rx="1.5" fill="#93C5FD" />
          <rect x="34" y="48" width="6" height="5" rx="1.5" fill="#93C5FD" />
          <rect x="46" y="48" width="6" height="5" rx="1.5" fill="#93C5FD" />
          {/* Blue Notification Bell Badge with Clock Accent */}
          <g transform="translate(56, 32)">
            <circle cx="18" cy="18" r="15" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M18 10C15.2 10 13 12.2 13 15V18.5L11 20.5V21.5H25V20.5L23 18.5V15C23 12.2 20.8 10 18 10Z" fill="#FFFFFF" />
            <circle cx="18" cy="24" r="1.5" fill="#BFDBFE" />
            <circle cx="27" cy="9" r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M27 6V9H30" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'reception':
      return (
        <svg viewBox="0 0 110 80" className="w-22 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Curving Road Ribbon */}
          <path d="M10 58C30 58 45 42 65 38C85 34 95 24 102 18" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
          <path d="M10 58C30 58 45 42 65 38C85 34 95 24 102 18" stroke="#F8FAFC" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          {/* Waypoint Pins */}
          <circle cx="48" cy="46" r="4.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="68" cy="38" r="4.5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="86" cy="28" r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* Driver Avatar Badge */}
          <g transform="translate(80, 4)">
            <circle cx="14" cy="14" r="12" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="14" cy="11" r="5" fill="#FEE2E2" />
            <path d="M7 23C7 19.5 10 18 14 18C18 18 21 19.5 21 23" fill="#1D4ED8" />
            <circle cx="22" cy="22" r="3.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1" />
            <path d="M20.5 22L21.5 23L23.5 21" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
          </g>
          {/* White Car */}
          <g transform="translate(6, 44)">
            <path d="M2 12C2 9 6 6 12 5L20 4C24 4 28 6 30 8L34 10C36 10 38 12 38 14V17H2V12Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
            <rect x="10" y="7" width="8" height="4" rx="1" fill="#93C5FD" />
            <rect x="20" y="7" width="8" height="4" rx="1" fill="#93C5FD" />
            <circle cx="9" cy="18" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
            <circle cx="29" cy="18" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
          </g>
        </svg>
      );

    case 'receptionist':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Reception Desk */}
          <path d="M12 54C12 48 20 46 50 46C80 46 88 48 88 54L84 72H16L12 54Z" fill="#1E40AF" stroke="#1E3A8A" strokeWidth="2" />
          <path d="M10 52C10 50 20 48 50 48C80 48 90 50 90 52C90 54 80 56 50 56C20 56 10 54 10 52Z" fill="#60A5FA" />
          {/* Receptionist Avatar */}
          <g transform="translate(34, 10)">
            <circle cx="16" cy="16" r="10" fill="#FDE047" />
            {/* Hair */}
            <path d="M7 16C7 10 11 6 16 6C21 6 25 10 25 16C25 17 24 19 23 20C21 16 19 14 16 14C13 14 11 16 9 20C8 19 7 17 7 16Z" fill="#78350F" />
            {/* Headset */}
            <path d="M7 15C6.5 12 9 8 16 8C23 8 25.5 12 25 15" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <rect x="5" y="14" width="3" height="5" rx="1.5" fill="#2563EB" />
            <path d="M7 18C9 21 12 22 14 22" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" />
            {/* Blue Uniform Top */}
            <path d="M6 34C6 28 10 26 16 26C22 26 26 28 26 34" fill="#2563EB" />
            <path d="M14 26L16 30L18 26" fill="#FFFFFF" />
          </g>
          {/* Counter Bell & Laptop */}
          <ellipse cx="26" cy="50" rx="4" ry="2" fill="#F59E0B" />
          <circle cx="26" cy="48" r="1" fill="#D97706" />
          <rect x="66" y="44" width="10" height="7" rx="1" fill="#475569" stroke="#94A3B8" strokeWidth="1" />
        </svg>
      );

    case 'security':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Metallic Blue Security Shield */}
          <path d="M48 10L78 20V42C78 58 64 68 48 74C32 68 18 58 18 42V20L48 10Z" fill="url(#secShieldGrad)" stroke="#1D4ED8" strokeWidth="2.5" />
          {/* Inner Shield Glow */}
          <path d="M48 15L73 24V41C73 54 61 63 48 68C35 63 23 54 23 41V24L48 15Z" fill="#EFF6FF" fillOpacity="0.85" />
          {/* Security Guard in Officer Peaked Cap */}
          <g transform="translate(32, 22)">
            {/* Officer Uniform */}
            <path d="M6 32C6 26 10 23 16 23C22 23 26 26 26 32" fill="#1E3A8A" />
            <path d="M14 23L16 28L18 23" fill="#F8FAFC" />
            <rect x="15" y="27" width="2" height="5" fill="#EF4444" />
            {/* Face */}
            <circle cx="16" cy="18" r="6" fill="#FED7AA" />
            {/* Officer Cap */}
            <path d="M8 15C8 12 11 10 16 10C21 10 24 12 24 15H8Z" fill="#1E3A8A" />
            <path d="M6 15C6 14 10 13 16 13C22 13 26 14 26 15C26 16 22 17 16 17C10 17 6 16 6 15Z" fill="#0F172A" />
            <circle cx="16" cy="12" r="1.5" fill="#F59E0B" />
          </g>
          {/* Green Verified Check Badge */}
          <g transform="translate(62, 44)">
            <circle cx="12" cy="12" r="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M8 12.5L10.5 15L16 9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <defs>
            <linearGradient id="secShieldGrad" x1="18" y1="10" x2="78" y2="74" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60A5FA" />
              <stop offset="1" stopColor="#1E40AF" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'jc_creation':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Job Card Clipboard */}
          <rect x="18" y="14" width="46" height="58" rx="6" fill="#F8FAFC" stroke="#2563EB" strokeWidth="2.5" />
          <path d="M32 10H50V16H32V10Z" fill="#1E3A8A" rx="2" />
          <rect x="24" y="24" width="34" height="4" rx="1.5" fill="#3B82F6" />
          <text x="26" y="27.5" fill="#FFFFFF" fontSize="3.5" fontWeight="bold">JOB CARD</text>
          {/* Check lines */}
          <rect x="24" y="32" width="4" height="4" rx="1" fill="#10B981" />
          <rect x="31" y="33" width="22" height="2" rx="1" fill="#CBD5E1" />
          <rect x="24" y="39" width="4" height="4" rx="1" fill="#10B981" />
          <rect x="31" y="40" width="18" height="2" rx="1" fill="#CBD5E1" />
          <rect x="24" y="46" width="4" height="4" rx="1" fill="#3B82F6" />
          <rect x="31" y="47" width="24" height="2" rx="1" fill="#CBD5E1" />
          {/* Mechanical Tools: Gear + Wrench */}
          <g transform="translate(60, 20)">
            <circle cx="14" cy="14" r="10" fill="#94A3B8" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="14" cy="14" r="4" fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
            {/* Crossed Wrench */}
            <path d="M5 28L22 11" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            <circle cx="22" cy="11" r="3" fill="#CBD5E1" stroke="#334155" strokeWidth="1.5" />
          </g>
          {/* Car Graphic */}
          <g transform="translate(42, 46)">
            <path d="M2 12C2 9 6 6 12 5L22 4C26 4 30 6 32 8L36 10C38 10 40 12 40 14V18H2V12Z" fill="#FFFFFF" stroke="#1E40AF" strokeWidth="1.8" />
            <circle cx="9" cy="19" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
            <circle cx="31" cy="19" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
          </g>
        </svg>
      );

    case 'bodyshop':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Job Card Clipboard */}
          <rect x="18" y="14" width="46" height="58" rx="6" fill="#FDF4FF" stroke="#A855F7" strokeWidth="2.5" />
          <path d="M32 10H50V16H32V10Z" fill="#7E22CE" rx="2" />
          <rect x="24" y="24" width="34" height="4" rx="1.5" fill="#C084FC" />
          <text x="26" y="27.5" fill="#FFFFFF" fontSize="3.5" fontWeight="bold">JOB CARD</text>
          {/* Paint Spray Gun */}
          <g transform="translate(62, 18)">
            <rect x="12" y="4" width="10" height="14" rx="2" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
            <path d="M12 18L6 24V28H10L14 24" fill="#94A3B8" stroke="#475569" strokeWidth="1.5" />
            <path d="M6 24L2 23V21L6 22" fill="#0284C7" />
            {/* Paint Spray Mist */}
            <path d="M1 21C-3 18 -4 26 0 24" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 2" />
          </g>
          {/* Car with Green Approval */}
          <g transform="translate(42, 46)">
            <path d="M2 12C2 9 6 6 12 5L22 4C26 4 30 6 32 8L36 10C38 10 40 12 40 14V18H2V12Z" fill="#FFFFFF" stroke="#9333EA" strokeWidth="1.8" />
            <circle cx="9" cy="19" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
            <circle cx="31" cy="19" r="3.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
          </g>
          <g transform="translate(24, 48)">
            <circle cx="8" cy="8" r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M5 8L7 10L11 6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'jc_tracking':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Workshop Service Bay 1 Structure */}
          <rect x="42" y="16" width="50" height="56" rx="4" fill="#F1F5F9" stroke="#0284C7" strokeWidth="2" />
          {/* Bay 1 Signboard */}
          <rect x="46" y="20" width="42" height="10" rx="2" fill="#0284C7" />
          <text x="56" y="27" fill="#FFFFFF" fontSize="6" fontWeight="bold">BAY 1</text>
          {/* Hydraulic Lift Posts */}
          <rect x="48" y="32" width="5" height="38" fill="#475569" rx="1" />
          <rect x="81" y="32" width="5" height="38" fill="#475569" rx="1" />
          {/* Lift Platform with Car Elevated */}
          <rect x="44" y="44" width="46" height="3" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />
          <g transform="translate(50, 31)">
            <path d="M2 10C2 7 6 5 11 4L22 4C26 4 30 5 32 7L34 8C36 8 38 10 38 12V14H2V10Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
            <circle cx="8" cy="15" r="2.5" fill="#1E293B" />
            <circle cx="28" cy="15" r="2.5" fill="#1E293B" />
          </g>
          {/* Job Card Clipboard on Left */}
          <g transform="translate(10, 24)">
            <rect x="4" y="8" width="28" height="40" rx="3" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
            <path d="M12 5H24V9H12V5Z" fill="#0284C7" rx="1" />
            <rect x="8" y="14" width="6" height="3" fill="#10B981" rx="0.5" />
            <rect x="8" y="20" width="6" height="3" fill="#38BDF8" rx="0.5" />
            <rect x="8" y="26" width="6" height="3" fill="#F59E0B" rx="0.5" />
          </g>
          {/* Blue Gear/Wrench badge */}
          <g transform="translate(24, 46)">
            <circle cx="10" cy="10" r="9" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M6 14L14 6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="6" r="2" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        </svg>
      );

    case 'eqc':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* EQC Checklist Sheet */}
          <rect x="22" y="12" width="46" height="60" rx="6" fill="#F0FDFA" stroke="#0D9488" strokeWidth="2.5" />
          <path d="M36 8H54V14H36V8Z" fill="#115E59" rx="2" />
          {/* Checkmarks */}
          <rect x="28" y="22" width="6" height="6" rx="1.5" fill="#10B981" />
          <path d="M29.5 25L31 26.5L33.5 23.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="37" y="24" width="24" height="2" rx="1" fill="#99F6E4" />
          <rect x="28" y="31" width="6" height="6" rx="1.5" fill="#10B981" />
          <path d="M29.5 34L31 35.5L33.5 32.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="37" y="33" width="20" height="2" rx="1" fill="#99F6E4" />
          <rect x="28" y="40" width="6" height="6" rx="1.5" fill="#10B981" />
          <path d="M29.5 43L31 44.5L33.5 41.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="37" y="42" width="26" height="2" rx="1" fill="#99F6E4" />
          {/* Inspection Officer / Wash Technician in Blue Uniform */}
          <g transform="translate(62, 30)">
            <circle cx="14" cy="12" r="6" fill="#FED7AA" />
            <path d="M8 9C8 7 11 5 14 5C17 5 20 7 20 9H8Z" fill="#1E40AF" />
            <path d="M5 26C5 20 9 18 14 18C19 18 23 20 23 26" fill="#2563EB" />
          </g>
          {/* Inspected Vehicle */}
          <g transform="translate(44, 48)">
            <path d="M2 10C2 7 6 5 11 4L22 4C26 4 30 5 32 7L34 8C36 8 38 10 38 12V14H2V10Z" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.8" />
            <circle cx="8" cy="15" r="2.5" fill="#1E293B" />
            <circle cx="28" cy="15" r="2.5" fill="#1E293B" />
          </g>
          {/* Big Green Shield Checkmark */}
          <g transform="translate(68, 12)">
            <circle cx="10" cy="10" r="9" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M6 10L9 13L14 7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'thd':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Diagnostic Computer Display Screen */}
          <rect x="18" y="16" width="64" height="42" rx="4" fill="#0F172A" stroke="#EA580C" strokeWidth="2.5" />
          <path d="M38 58L34 68H66L62 58" fill="#475569" stroke="#334155" strokeWidth="1.5" />
          {/* Telemetry Waveform / Line Graphs */}
          <path d="M24 38L32 38L36 26L42 46L48 32L54 38L74 38" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Bar Chart Metrics */}
          <rect x="24" y="44" width="4" height="8" rx="1" fill="#3B82F6" />
          <rect x="30" y="42" width="4" height="10" rx="1" fill="#10B981" />
          <rect x="36" y="46" width="4" height="6" rx="1" fill="#F59E0B" />
          <circle cx="68" cy="26" r="4" fill="#F97316" />
          {/* Diagnostic Checklist Overlay on Left */}
          <g transform="translate(8, 28)">
            <rect x="2" y="6" width="22" height="34" rx="3" fill="#FFFFFF" stroke="#EA580C" strokeWidth="1.5" />
            <rect x="6" y="10" width="14" height="2" rx="1" fill="#EA580C" />
            <path d="M6 16L8 18L12 14" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="13" cy="30" r="4" fill="#10B981" />
            <path d="M11 30L12.5 31.5L15 28.5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
          </g>
        </svg>
      );

    case 'spd':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Spare Parts Cardboard Carton */}
          <g transform="translate(24, 12)">
            <path d="M18 4L34 12V28L18 20V4Z" fill="#D97706" stroke="#92400E" strokeWidth="1.5" />
            <path d="M2 12L18 4L34 12L18 20L2 12Z" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5" />
            <path d="M2 12L18 20V36L2 28V12Z" fill="#B45309" stroke="#92400E" strokeWidth="1.5" />
            {/* Gear inside box */}
            <circle cx="18" cy="20" r="4" fill="#475569" stroke="#CBD5E1" strokeWidth="1" />
          </g>
          {/* Parts Delivery Van / Truck */}
          <g transform="translate(38, 30)">
            {/* Speed Lines */}
            <path d="M-10 18H-2M-8 24H-4" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
            {/* Truck Body */}
            <rect x="0" y="8" width="30" height="22" rx="2" fill="#F8FAFC" stroke="#1E293B" strokeWidth="2" />
            <path d="M30 14L40 18V30H30V14Z" fill="#F8FAFC" stroke="#1E293B" strokeWidth="2" />
            <rect x="32" y="18" width="6" height="5" rx="1" fill="#38BDF8" />
            <circle cx="8" cy="31" r="5" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
            <circle cx="34" cy="31" r="5" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
          </g>
        </svg>
      );

    case 'claim':
      return (
        <svg viewBox="0 0 100 80" className="w-20 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Claims Clipboard */}
          <rect x="22" y="12" width="46" height="60" rx="6" fill="#FFF1F2" stroke="#E11D48" strokeWidth="2.5" />
          <path d="M36 8H54V14H36V8Z" fill="#9F1239" rx="2" />
          <rect x="28" y="22" width="34" height="5" rx="1.5" fill="#E11D48" />
          <text x="32" y="26" fill="#FFFFFF" fontSize="4.5" fontWeight="bold">CLAIMS</text>
          {/* Car Graphic */}
          <g transform="translate(24, 46)">
            <path d="M2 10C2 7 6 5 11 4L22 4C26 4 30 5 32 7L34 8C36 8 38 10 38 12V14H2V10Z" fill="#FFFFFF" stroke="#BE123C" strokeWidth="1.5" />
            <circle cx="8" cy="15" r="2.5" fill="#1E293B" />
            <circle cx="28" cy="15" r="2.5" fill="#1E293B" />
          </g>
          {/* Rupee Coin Shield Badge */}
          <g transform="translate(56, 30)">
            <path d="M14 4L26 8V18C26 26 19 31 14 34C9 31 2 26 2 18V8L14 4Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
            {/* Indian Rupee Symbol ₹ */}
            <text x="9.5" y="22" fill="#78350F" fontSize="12" fontWeight="bold" fontFamily="sans-serif">₹</text>
          </g>
        </svg>
      );

    case 'customer_journey':
      return (
        <svg viewBox="0 0 110 80" className="w-24 h-16 shrink-0 drop-shadow-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Curving Journey Roadmap */}
          <path d="M20 62C40 62 48 48 68 46C88 44 94 36 100 28" stroke="#0284C7" strokeWidth="8" strokeLinecap="round" />
          <path d="M20 62C40 62 48 48 68 46C88 44 94 36 100 28" stroke="#F0F9FF" strokeWidth="2" strokeDasharray="3 3" />
          {/* Journey Milestone Nodes */}
          <circle cx="50" cy="52" r="4" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="70" cy="46" r="4" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="88" cy="38" r="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
          {/* Customer holding Smartphone Tracking */}
          <g transform="translate(6, 18)">
            {/* Happy Customer Avatar */}
            <circle cx="16" cy="14" r="8" fill="#FED7AA" />
            <path d="M9 13C9 8 13 6 16 6C19 6 23 8 23 13" fill="#78350F" />
            <path d="M8 32C8 25 11 22 16 22C21 22 24 25 24 32" fill="#2563EB" />
            {/* Smartphone in hand */}
            <rect x="22" y="16" width="8" height="15" rx="1.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" />
            <rect x="24" y="18" width="4" height="9" fill="#38BDF8" />
          </g>
          {/* Dealership Destination with Star/Badge */}
          <g transform="translate(86, 8)">
            <circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
            <path d="M12 6L13.5 10H18L14.5 12.5L16 16.5L12 14L8 16.5L9.5 12.5L6 10H10.5L12 6Z" fill="#FFFFFF" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};

export const ServiceTransformationPortal: React.FC<ServiceTransformationPortalProps> = ({
  modules,
  activeModuleCode,
  onSelectModule,
  moduleCounts = {},
  matches = {},
  searchQuery = '',
  compact = false,
  hideCounts = false,
  toolbar,
}) => {
  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 sm:p-6 space-y-6 shadow-xs">
      {/* Brand Header Banner Matching User Image */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-100 via-white to-blue-50/60 border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 z-10">
          <div className="flex items-center gap-3">
            <div className="h-6 flex items-center gap-1.5">
              <span className="font-black tracking-widest text-[#002B49] text-base font-sans">TATA MOTORS</span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-500 italic">Connecting Aspirations</span>
          </div>

          <div className="inline-block px-2.5 py-0.5 rounded bg-blue-100/80 text-blue-900 font-bold text-[11px] tracking-wider uppercase">
            SERVICE TRANSFORMATION
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-[#002B49]">Smarter Services</span>{' '}
              <span className="text-[#005A9C]">Brighter Journeys</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Digital Solution Powering A Seamless Dealer Experience
            </p>
          </div>
        </div>

        {/* Right Architectural Facade Illustration */}
        <div className="hidden lg:flex items-center justify-end relative h-32 w-72 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-white shadow-inner">
          <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay" />
          <div className="relative z-10 text-right space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 backdrop-blur-xs px-2.5 py-1 rounded-full border border-blue-400/30 text-[10px] font-bold text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              12 Modules Operational
            </div>
            <p className="text-lg font-black tracking-wide text-white">TATA MOTORS</p>
            <p className="text-[10px] text-slate-300">Service Operations Platform</p>
          </div>
        </div>
      </div>

      {toolbar}

      {/* The 12 Official Cards Arranged in 3 Rows x 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((mod) => {
          const isSelected = activeModuleCode === mod.code;
          const count = moduleCounts[mod.code] || { masters: 0, records: 0 };
          const matchCount = matches[mod.code] ?? 0;
          const lines = mod.displayLines || [mod.title];

          return (
            <button
              key={mod.code}
              type="button"
              onClick={() => onSelectModule(mod.code)}
              data-testid={`portal-card-${mod.code}`}
              className={`group text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative flex flex-col justify-between h-40 shadow-xs hover:shadow-md ${
                isSelected
                  ? 'bg-gradient-to-b from-white to-blue-50/60 border-blue-600 ring-2 ring-blue-500/30 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* Card Top: Title on Left, Custom 3D Illustration on Right */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="space-y-0.5 min-w-0 pr-1">
                  {lines.map((line, lIdx) => (
                    <div
                      key={lIdx}
                      className={`font-bold text-sm leading-snug tracking-tight ${
                        isSelected ? 'text-blue-950 font-extrabold' : 'text-slate-800'
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 truncate mt-1 max-w-[140px]">
                    {mod.categoryTag}
                  </p>
                </div>

                {/* 3D Illustration Matching The Visual Image */}
                <div className="transition-transform duration-200 group-hover:scale-105">
                  <ModuleIllustration code={mod.code} />
                </div>
              </div>

              {/* Card Bottom: Circular ↗ Arrow Button and Master Count Badge */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 w-full mt-auto">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-blue-900 border-blue-950 text-white'
                      : 'bg-slate-100 border-slate-200 text-slate-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
                  }`}
                >
                  <span className="text-xs font-bold font-mono">↗</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {searchQuery && matchCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 font-mono shadow-2xs">
                      {matchCount} match{matchCount > 1 ? 'es' : ''}
                    </span>
                  )}
                  {!hideCounts && (
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono ${
                      isSelected
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {count.masters} {count.masters === 1 ? 'Master' : 'Masters'}
                  </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
