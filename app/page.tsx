'use client';

import {
  ShoppingCart,
  Package,
  DollarSign,
  Calculator,
  Target,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import ModuleCard from './_components/ui/ModuleCard';
import { TOKENS } from './_components/_pmTheme';

type Module = {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const modules: Module[] = [
  {
    name: 'Ventas',
    description: 'Registra y gestiona las ventas de tu negocio.',
    href: '/ventas',
    icon: ShoppingCart,
  },
  {
    name: 'Inventario',
    description: 'Controla y administra el stock de tus productos.',
    href: '/inventario',
    icon: Package,
  },
  {
    name: 'Tasas Cambiarias',
    description: 'Gestiona el historial de tasas BCV y Paralelo.',
    href: '/tasas',
    icon: DollarSign,
  },
  {
    name: 'Calculadora',
    description: 'Calcula precios considerando la dualidad cambiaria.',
    href: '/calculadora',
    icon: Calculator,
  },
  {
    name: 'Punto de Equilibrio',
    description: 'Monitorea metas mensuales, diarias y gestiona gastos fijos.',
    href: '/punto-equilibrio',
    icon: Target,
  },
  {
    name: 'Reportes',
    description: 'Genera reportes y analiza el rendimiento de tu negocio.',
    href: '/reportes',
    icon: BarChart3,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="pm-eyebrow mb-2">LubriMotos · Offline-first ERP</div>
          <h1
            className="text-[40px] font-bold leading-[48px] tracking-[-0.02em]"
            style={{ color: TOKENS.charcoal }}
          >
            Bienvenido a LubriMotos ERP
          </h1>
          <p
            className="text-[14px] mt-2 max-w-2xl"
            style={{ color: TOKENS.slate500 }}
          >
            Tu solución Offline-First para la gestión de tu taller de motos.
            Selecciona un módulo para comenzar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <ModuleCard
              key={module.href}
              name={module.name}
              description={module.description}
              href={module.href}
              icon={module.icon}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
