import ModuleCard from './_components/ui/ModuleCard';

type Module = {
  name: string;
  description: string;
  href: string;
};

const modules: Module[] = [
  {
    name: 'Ventas',
    description: 'Registra y gestiona las ventas de tu negocio.',
    href: '/ventas',
  },
  {
    name: 'Inventario',
    description: 'Controla y administra el stock de tus productos.',
    href: '/inventario',
  },
  {
    name: 'Reportes',
    description: 'Genera reportes y analiza el rendimiento de tu negocio.',
    href: '/reportes',
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Bienvenido a LubriMotos ERP</h1>
        <p className="text-lg mt-4">Tu solución Offline-First para la gestión de tu negocio.</p>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {modules.map((module) => (
          <ModuleCard
            key={module.href}
            name={module.name}
            description={module.description}
            href={module.href}
          />
        ))}
      </div>
    </main>
  );
}
