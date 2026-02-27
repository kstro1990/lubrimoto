# LubriMotos ERP

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind">
</p>

Sistema de Planificación de Recursos Empresariales (ERP) para **LubriMotos**, una tienda de lubricantes y repuestos para motos en Venezuela.

## 🚀 Características

### Módulos Principales

- **📦 Inventario**: Gestión completa de productos, control de stock, movimientos de inventario, ajustes y importación/exportación
- **💰 Punto de Equilibrio**: Cálculo de costos fijos, márgenes de ganancia, metas diarias/mensuales
- **💵 Tasas de Cambio**: Seguimiento de tasas BCV y paralelo, historial gráfico, sincronización automática
- **🧮 Calculadora de Precios**: Cálculo de precios con protección cambiaria para el mercado venezolano
- **📊 Reportes**: Estadísticas de ventas, productos populares, inventario bajo, gráficos de tendencia
- **🛒 Ventas**: Terminal de ventas, gestión de clientes, facturación
- **🔧 Diagnóstico**: Estado de la base de datos, verificación de conexiones, estadísticas del sistema

### Funcionalidades

- Cálculo automático de precios con márgenes de ganancia
- Control de inventario en tiempo real
- Seguimiento de tasas de cambio (BCV/Paralelo)
- Meta de ventas y punto de equilibrio
- Alertas de stock bajo
- Historial de movimientos de inventario

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Base de Datos**: Supabase (PostgreSQL)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Iconos**: Lucide React
- **Gráficos**: Recharts

## 📁 Estructura del Proyecto

```
lubrimotos-erp/
├── app/                          # Next.js App Router
│   ├── (modules)/                # Módulos de la aplicación
│   │   ├── calculadora/          # Calculadora de precios
│   │   ├── diagnostico/          # Página de diagnóstico
│   │   ├── inventario/           # Gestión de inventario
│   │   ├── punto-equilibrio/    # Punto de equilibrio y metas
│   │   ├── reportes/            # Reportes y estadísticas
│   │   ├── tasas/              # Gestión de tasas de cambio
│   │   └── ventas/              # Módulo de ventas
│   ├── _components/             # Componentes compartidos
│   ├── _contexts/              # React Contexts
│   ├── _db/                    # Capa de datos (Supabase)
│   │   ├── db.ts              # Cliente de base de datos
│   │   └── types.ts           # Tipos TypeScript
│   ├── _hooks/                 # Custom React Hooks
│   ├── _lib/                   # Utilidades y librerías
│   └── layout.tsx              # Layout principal
├── supabase/
│   └── migrations/             # Migraciones de base de datos
└── public/                     # Archivos estáticos
```

## ⚙️ Instalación

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd lubrimotos-erp
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key"
```

### 4. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta las migraciones:

```bash
npx supabase db push
```

O ejecuta el SQL en el Editor de SQL de Supabase.

### 5. Ejecutar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## 📋 Variables de Entorno

| Variable | Descripción |
|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |

## 🗄️ Migraciones de Base de Datos

Las migraciones se encuentran en `supabase/migrations/`:

- `0000_initial_schema.sql` - Esquema inicial
- `0001_seed_data.sql` - Datos iniciales
- `0002_inventory_system.sql` - Sistema de inventario
- `20260226_create_missing_tables.sql` - Tablas adicionales
- `20260227_add_missing_columns.sql` - Columnas faltantes

## 📱 Páginas Principales

| Ruta | Descripción |
|------|-------------|
| `/` | Página de inicio |
| `/inventario` | Gestión de inventario |
| `/inventario/nuevo` | Agregar nuevo producto |
| `/inventario/movimientos` | Historial de movimientos |
| `/ventas` | Historial de ventas |
| `/ventas/nueva` | Nueva venta/facturación |
| `/tasas` | Gestión de tasas de cambio |
| `/punto-equilibrio` | Punto de equilibrio y metas |
| `/calculadora` | Calculadora de precios |
| `/reportes` | Reportes y estadísticas |
| `/diagnostico` | Diagnóstico del sistema |

## 🔧 Scripts Disponibles

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Compilar para producción
npm run start        # Iniciar servidor de producción
npm run lint         # Ejecutar linter
```

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

---

<p align="center">Desarrollado con ❤️ para LubriMotos</p>
