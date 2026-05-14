"use client";

import React from 'react';

// Precision Moto ERP design tokens.
// Equivalent CSS custom properties (--pm-*) and utility classes
// (.pm-input, .pm-label, .pm-section, .pm-card, .pm-elevated, .pm-tnum)
// are defined globally in app/globals.css. Use those classes by default;
// only reach for TOKENS when you need inline color values (e.g. dynamic
// status tints, Recharts fills).
export const TOKENS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  charcoal: '#121826',
  slate700: '#334155',
  slate500: '#475569',
  slate400: '#64748B',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  orange: '#FF5F00',
  orangeDark: '#E55400',
  orangeSoft: '#FFE8DC',
  red: '#BA1A1A',
  redSoft: '#FFDAD6',
  green: '#0F766E',
  greenSoft: '#CCFBF1',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
} as const;

export const PM_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Thin compatibility wrapper. The PM styling is applied app-wide via
 * `<body class="pm-scope">` and `globals.css`. This wrapper still renders
 * a div with the same class so legacy callers keep working.
 */
export function PMScope({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`pm-scope ${className}`} style={style}>
      {children}
    </div>
  );
}

export function PMBtnPrimary({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 h-9 text-[13px] font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        props.className ?? ''
      }`}
      style={{
        background: TOKENS.orange,
        color: '#fff',
        boxShadow: '0 1px 2px rgba(18, 24, 38, 0.08)',
        ...(props.style ?? {}),
      }}
      onMouseEnter={(e) => {
        if (!props.disabled)
          (e.currentTarget as HTMLButtonElement).style.background = TOKENS.orangeDark;
      }}
      onMouseLeave={(e) => {
        if (!props.disabled)
          (e.currentTarget as HTMLButtonElement).style.background = TOKENS.orange;
      }}
    >
      {children}
    </button>
  );
}

export function PMBtnSecondary({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-3 h-9 text-[13px] font-semibold rounded transition-colors ${
        props.className ?? ''
      }`}
      style={{
        color: TOKENS.charcoal,
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.slate300}`,
        ...(props.style ?? {}),
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.slate100)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.surface)
      }
    >
      {children}
    </button>
  );
}
