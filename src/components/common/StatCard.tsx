import React, { useState } from 'react';
import { LucideIcon, ArrowRight, Info, Calculator, GitBranch } from 'lucide-react';

export interface StatCardTooltipInfo {
  categoryType: string;
  calculationFormula: string;
  explanation: string;
  hierarchyContext: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  variant?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
  badge?: string;
  actionHint?: string;
  tooltipInfo?: StatCardTooltipInfo;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  badge,
  actionHint,
  tooltipInfo,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const variantStyles = {
    default: 'bg-white border-slate-200 text-slate-900 hover:border-blue-400 hover:bg-blue-50/20',
    accent: 'bg-gradient-to-br from-blue-900 to-indigo-950 text-white border-blue-800 shadow-md hover:from-blue-950 hover:to-indigo-900 hover:border-blue-500',
    warning: 'bg-amber-50/70 border-amber-200 text-amber-950 hover:border-amber-400 hover:bg-amber-50',
    danger: 'bg-rose-50/70 border-rose-200 text-rose-950 hover:border-rose-400 hover:bg-rose-50',
    success: 'bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-50',
  };

  const iconColors = {
    default: 'bg-blue-50 text-blue-700',
    accent: 'bg-blue-800/80 text-blue-200',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    success: 'bg-emerald-100 text-emerald-700',
  };

  const actionHintColors = {
    default: 'text-blue-600 group-hover:text-blue-700 border-slate-100',
    accent: 'text-blue-200 group-hover:text-white border-blue-800/60',
    warning: 'text-amber-700 group-hover:text-amber-800 border-amber-200/60',
    danger: 'text-rose-700 group-hover:text-rose-800 border-rose-200/60',
    success: 'text-emerald-700 group-hover:text-emerald-800 border-emerald-200/60',
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between ${
        variantStyles[variant]
      } ${
        onClick
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 select-none focus:outline-none focus:ring-2 focus:ring-blue-500'
          : 'shadow-xs'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  variant === 'accent' ? 'text-blue-200' : 'text-slate-500'
                }`}
              >
                {title}
              </p>
              {badge && (
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    variant === 'accent'
                      ? 'bg-blue-800 text-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {badge}
                </span>
              )}

              {/* Tooltip trigger button */}
              {tooltipInfo && (
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTooltip(!showTooltip);
                    }}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    aria-label={`Calculation details for ${title}`}
                    className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                      variant === 'accent'
                        ? 'text-blue-300 hover:text-white hover:bg-blue-800'
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <Info className="h-3 w-3" />
                  </button>

                  {/* Interactive Tooltip Card */}
                  {showTooltip && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-50 left-0 top-6 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-2xl text-xs space-y-2 border border-slate-700 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-[11px] text-blue-300 uppercase tracking-wider flex items-center gap-1">
                          <GitBranch className="h-3 w-3" /> {tooltipInfo.categoryType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {tooltipInfo.hierarchyContext}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] text-amber-300 font-bold">
                          <Calculator className="h-3 w-3" /> Formula:
                        </div>
                        <p className="font-mono text-[11px] text-slate-200 bg-slate-800/80 p-1.5 rounded border border-slate-700/80">
                          {tooltipInfo.calculationFormula}
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {tooltipInfo.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              <h4 className="text-2xl font-black tracking-tight">{value}</h4>
              {trend && (
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    trend.isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {trend.value}
                </span>
              )}
            </div>
          </div>

          {Icon && (
            <div className={`p-2 rounded-lg shrink-0 ${iconColors[variant]}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {subtitle && (
          <p
            className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${
              variant === 'accent' ? 'text-blue-200/90' : 'text-slate-600'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>

      {onClick && (
        <div
          className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-semibold transition-colors ${
            actionHintColors[variant]
          }`}
        >
          <span>{actionHint || 'Click to view'}</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  );
};
