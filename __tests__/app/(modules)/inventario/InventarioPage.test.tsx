import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventarioPage from '@/app/(modules)/inventario/page';
import { Product, SyncStatus } from '@/app/_db/db';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock dexie-react-hooks
const mockProducts: Product[] = [
  {
    id: 1,
    sku: 'PROD-001',
    name: 'Aceite de Motor',
    description: 'Aceite 10W-40',
    costUsd: 20,
    priceUsd: 35,
    stockQuantity: 50,
    minStockAlert: 10,
    supplier: 'Proveedor A',
    category: 'Lubricantes',
    syncStatus: SyncStatus.SYNCED,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    sku: 'PROD-002',
    name: 'Filtro de Aire',
    stockQuantity: 5,
    minStockAlert: 10,
    priceUsd: 25,
    supplier: 'Proveedor B',
    category: 'Filtros',
    syncStatus: SyncStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    sku: 'PROD-003',
    name: 'Bujía',
    stockQuantity: 0,
    minStockAlert: 5,
    priceUsd: 15,
    supplier: 'Proveedor A',
    category: 'Bujías',
    syncStatus: SyncStatus.ERROR,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn().mockImplementation((callback) => callback()),
}));

// Mock the database
jest.mock('@/app/_db/db', () => ({
  ...jest.requireActual('@/app/_db/db'),
  db: {
    products: {
      orderBy: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(mockProducts),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      first: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  },
}));

// Mock NotificationProvider
jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock ProductSearch
jest.mock('@/app/_components/ui/ProductSearch', () => {
  return function MockProductSearch({ onFilter }: { onFilter: (products: Product[]) => void }) {
    return (
      <input
        data-testid="product-search"
        placeholder="Buscar productos..."
        onChange={(e) => {
          const filtered = mockProducts.filter(p => 
            p.name.toLowerCase().includes(e.target.value.toLowerCase())
          );
          onFilter(filtered);
        }}
      />
    );
  };
});

describe('InventarioPage with CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useLiveQuery mock to return full array
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockImplementation((callback: () => Product[]) => callback());
  });

  it('renders main inventory page with all elements', () => {
    render(<InventarioPage />);

    expect(screen.getByRole('heading', { name: /Módulo de Inventario/i })).toBeInTheDocument();
    expect(screen.getByText(/Gestiona tus productos/i)).toBeInTheDocument();
    expect(screen.getByTestId('product-search')).toBeInTheDocument();
  });

  it('displays product statistics', () => {
    render(<InventarioPage />);

    // Should show total products count
    expect(screen.getByText(/3 productos/i)).toBeInTheDocument();
    
    // Should show low stock indicator
    expect(screen.getByText(/2 stock bajo/i)).toBeInTheDocument();
    
    // Should show out of stock indicator
    expect(screen.getByText(/1 agotados/i)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<InventarioPage />);

    expect(screen.getByText(/Historial/i)).toBeInTheDocument();
    expect(screen.getByText(/Importar CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Nuevo Producto/i)).toBeInTheDocument();
  });

  it('renders products table with data', () => {
    render(<InventarioPage />);

    expect(screen.getByText('Aceite de Motor')).toBeInTheDocument();
    expect(screen.getByText('Filtro de Aire')).toBeInTheDocument();
    expect(screen.getByText('Bujía')).toBeInTheDocument();
  });

  it('shows stock status indicators', () => {
    render(<InventarioPage />);

    // Normal stock
    expect(screen.getAllByText('50')[0]).toBeInTheDocument();
    
    // Low stock should have warning styling
    expect(screen.getByText('5')).toBeInTheDocument();
    
    // Out of stock
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('shows sync status badges', () => {
    render(<InventarioPage />);

    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('opens action menu when clicking more button', () => {
    render(<InventarioPage />);

    // Find and click the more button for first product
    const moreButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg')
    );
    
    if (moreButtons.length > 0) {
      fireEvent.click(moreButtons[0]);

      expect(screen.getByText(/Editar/i)).toBeInTheDocument();
      expect(screen.getByText(/Ajustar Stock/i)).toBeInTheDocument();
      expect(screen.getByText(/Duplicar/i)).toBeInTheDocument();
      expect(screen.getByText(/Eliminar/i)).toBeInTheDocument();
    }
  });

  it('filters products when searching', () => {
    render(<InventarioPage />);

    const searchInput = screen.getByTestId('product-search');
    fireEvent.change(searchInput, { target: { value: 'Aceite' } });

    expect(screen.getByText('Aceite de Motor')).toBeInTheDocument();
  });

  it('displays category badges', () => {
    render(<InventarioPage />);

    expect(screen.getByText('Lubricantes')).toBeInTheDocument();
    expect(screen.getByText('Filtros')).toBeInTheDocument();
    expect(screen.getByText('Bujías')).toBeInTheDocument();
  });

  it('shows empty state when no products', () => {
    // Override mock to return empty array
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockReturnValue([]);

    render(<InventarioPage />);

    expect(screen.getByText(/No hay productos en el inventario/i)).toBeInTheDocument();
    expect(screen.getByText(/Agregar primer producto/i)).toBeInTheDocument();
  });

  it('has link to movements history page', () => {
    render(<InventarioPage />);

    const historialLink = screen.getByText(/Historial/i).closest('a');
    expect(historialLink).toHaveAttribute('href', '/inventario/movimientos');
  });

  it('renders table with all columns', () => {
    render(<InventarioPage />);

    expect(screen.getByText('SKU')).toBeInTheDocument();
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Costo (USD)')).toBeInTheDocument();
    expect(screen.getByText('Precio (USD)')).toBeInTheDocument();
    expect(screen.getByText('Proveedor')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();
  });
});
