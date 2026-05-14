'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ShoppingCart,
  Package,
  DollarSign,
  Calculator,
  Target,
  BarChart3,
} from 'lucide-react';
import { TOKENS } from './_pmTheme';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/inventario', label: 'Inventario', icon: Package },
  { href: '/tasas', label: 'Tasas', icon: DollarSign },
  { href: '/calculadora', label: 'Calc', icon: Calculator },
  { href: '/punto-equilibrio', label: 'Meta', icon: Target },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
] as const;

export default function BottomNavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: '#fff',
        borderTop: `1px solid ${TOKENS.slate200}`,
        boxShadow: '0 -2px 8px rgba(18, 24, 38, 0.04)',
      }}
    >
      <ul className="flex items-stretch justify-around h-16 max-w-screen-xl mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 relative">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center h-full px-1 transition-colors"
                style={{
                  color: isActive ? TOKENS.charcoal : TOKENS.slate500,
                  background: isActive ? TOKENS.slate50 : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLAnchorElement).style.background = TOKENS.slate50;
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-b"
                    style={{ background: TOKENS.orange }}
                  />
                )}
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span
                  className="text-[10px] mt-0.5 font-bold tracking-wider uppercase leading-tight"
                  style={{ letterSpacing: '0.04em' }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
