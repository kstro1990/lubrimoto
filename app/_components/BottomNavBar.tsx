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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg"
    >
      <ul className="flex items-stretch justify-around h-16 max-w-screen-xl mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          // Home matches exact only; modules match their prefix so nested
          // routes (e.g. /ventas/nueva) keep the parent active.
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center h-full px-1 transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] mt-0.5 font-medium leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
