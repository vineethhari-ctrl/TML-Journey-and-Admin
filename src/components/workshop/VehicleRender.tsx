import React, { useEffect, useMemo, useState } from 'react';
import { HeroShades, VehicleIdentity, vehicleImageCandidates, vehicleTrimLabel } from '../../utils/vehicleAsset';

type Size = 'card' | 'thumb';

/** Box sizes are fixed per size so nothing moves while the image loads (no layout shift). */
const BOX: Record<Size, string> = {
  card: 'w-[200px] h-[125px]',
  thumb: 'w-8 h-5',
};

/** Side outline of a generic car — the loading placeholder (dashed) and the "no VC" fallback (solid). */
const Silhouette: React.FC<{ wireframe?: boolean; label: string }> = ({ wireframe, label }) => (
  <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label={label}>
    <path
      d="M12 70 L18 52 Q22 46 32 44 L52 40 L68 26 Q72 22 80 22 L108 22 Q116 22 122 28 L134 42 L146 46 Q152 48 152 56 L152 70 Z"
      fill={wireframe ? 'none' : 'currentColor'}
      fillOpacity={wireframe ? 0 : 0.18}
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray={wireframe ? '5 4' : undefined}
    />
    <path d="M74 28 L72 42 L120 42 L114 28 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={wireframe ? '4 3' : undefined} />
    <circle cx="44" cy="72" r="11" fill="white" stroke="currentColor" strokeWidth="2" strokeDasharray={wireframe ? '4 3' : undefined} />
    <circle cx="124" cy="72" r="11" fill="white" stroke="currentColor" strokeWidth="2" strokeDasharray={wireframe ? '4 3' : undefined} />
  </svg>
);

interface Props {
  vehicle: VehicleIdentity;
  heroShades?: HeroShades;
  size?: Size;
  /** Asset root; defaults to /assets/vehicles (served by the DMS / CDN). */
  assetBase?: string;
}

/**
 * 3/4 front render of the customer's exact variant and colour. Tries the vehicle's colour, then the variant's hero
 * shade, then shows a generic silhouette. While an image loads, a dashed wireframe holds the same box.
 */
export const VehicleRender: React.FC<Props> = ({ vehicle, heroShades, size = 'card', assetBase }) => {
  const candidates = useMemo(() => vehicleImageCandidates(vehicle, heroShades, assetBase), [vehicle, heroShades, assetBase]);
  // Restart only when the URLs really change — callers often pass a new (but equal) vehicle object on every render.
  const candidateKey = candidates.join('|');
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [candidateKey]);

  const src = candidates[index];
  const label = `${vehicle.model ?? 'Vehicle'} ${vehicleTrimLabel(vehicle)}`.trim();
  const state = !src ? 'silhouette' : loaded ? 'image' : 'loading';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 text-slate-400 ${BOX[size]}`}
      data-testid={`vehicle-render-${size}`}
      data-state={state}
      title={size === 'thumb' ? label : undefined}
    >
      {state !== 'image' && <Silhouette wireframe={state === 'loading'} label={state === 'loading' ? `Loading ${label}` : `${vehicle.model ?? 'Vehicle'} (generic)`} />}
      {src && (
        <img
          key={src}
          src={src}
          alt={label}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIndex((i) => i + 1);
          }}
        />
      )}
    </span>
  );
};
