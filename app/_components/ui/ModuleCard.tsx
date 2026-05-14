'use client';

import Link from 'next/link';
import { ArrowRight, LucideIcon } from 'lucide-react';
import { TOKENS } from '@/app/_components/_pmTheme';

type ModuleCardProps = {
  name: string;
  description: string;
  href: string;
  icon?: LucideIcon;
};

export default function ModuleCard({ name, description, href, icon: Icon }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="block group rounded p-5 transition-all"
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.slate200}`,
        boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = TOKENS.charcoal;
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          '0 8px 24px rgba(18, 24, 38, 0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = TOKENS.slate200;
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          '0 1px 2px rgba(18, 24, 38, 0.04)';
      }}
    >
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div
            className="flex items-center justify-center h-10 w-10 rounded"
            style={{ background: TOKENS.charcoal, color: '#fff' }}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          style={{ color: TOKENS.slate400 }}
        />
      </div>
      <h3
        className="text-[18px] font-bold leading-6 tracking-[-0.01em] mb-1"
        style={{ color: TOKENS.charcoal }}
      >
        {name}
      </h3>
      <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
        {description}
      </p>
    </Link>
  );
}
