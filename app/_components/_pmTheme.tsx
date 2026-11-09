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
 * Themable variant of TOKENS. Each property resolves to a CSS custom
 * property (`--pm-t-*`) instead of a literal hex string, so any inline
 * style that uses it will respond to dark mode when the surrounding
 * subtree opts in via `.pm-dark-area` (see globals.css).
 *
 * Use this in pages/components that should flip when the user toggles
 * theme. For places that need a static color (e.g. Recharts fill values
 * computed once), keep using TOKENS.
 */
export const T = {
  bg: 'var(--pm-t-bg)',
  surface: 'var(--pm-t-surface)',
  charcoal: 'var(--pm-t-charcoal)',
  slate700: 'var(--pm-t-slate700)',
  slate500: 'var(--pm-t-slate500)',
  slate400: 'var(--pm-t-slate400)',
  slate300: 'var(--pm-t-slate300)',
  slate200: 'var(--pm-t-slate200)',
  slate100: 'var(--pm-t-slate100)',
  slate50: 'var(--pm-t-slate50)',
  orange: 'var(--pm-t-orange)',
  orangeDark: 'var(--pm-t-orange-dark)',
  orangeSoft: 'var(--pm-t-orange-soft)',
  red: 'var(--pm-t-red)',
  redSoft: 'var(--pm-t-red-soft)',
  green: 'var(--pm-t-green)',
  greenSoft: 'var(--pm-t-green-soft)',
  amber: 'var(--pm-t-amber)',
  amberSoft: 'var(--pm-t-amber-soft)',
  backdrop: 'var(--pm-t-backdrop)',
  shadowStrong: 'var(--pm-t-shadow-strong)',
  shadowSoft: 'var(--pm-t-shadow-soft)',
  shadowRow: 'var(--pm-t-shadow-row)',
  accentFill: 'var(--pm-t-accent-fill)',
  onAccentFill: 'var(--pm-t-on-accent-fill)',
  headline: 'var(--pm-t-headline)',
  border: 'var(--pm-t-border)',
  borderStrong: 'var(--pm-t-border-strong)',
} as const;

/** Opt-in wrapper enabling dark-mode tokens inside its subtree. */
export function PMDarkArea({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`pm-dark-area ${className}`} style={style}>
      {children}
    </div>
  );
}

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

/**
 * Primary CTA. Uses themable orange so it picks up the slightly tweaked
 * dark-mode hue (#f66018) when rendered inside a .pm-dark-area subtree.
 */
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
        background: T.orange,
        color: '#fff',
        boxShadow: `0 1px 2px ${T.shadowSoft}`,
        ...(props.style ?? {}),
      }}
      onMouseEnter={(e) => {
        if (!props.disabled)
          (e.currentTarget as HTMLButtonElement).style.background = T.orangeDark;
      }}
      onMouseLeave={(e) => {
        if (!props.disabled)
          (e.currentTarget as HTMLButtonElement).style.background = T.orange;
      }}
    >
      {children}
    </button>
  );
}

/**
 * Secondary action button: surface bg + outline. Themable so it inverts
 * inside .pm-dark-area to a dark surface chip with the warm outline.
 */
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
        color: T.charcoal,
        background: T.surface,
        border: `1px solid ${T.slate300}`,
        ...(props.style ?? {}),
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = T.slate100)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = T.surface)
      }
    >
      {children}
    </button>
  );
}
