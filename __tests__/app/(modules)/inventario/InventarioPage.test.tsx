import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock dexie-react-hooks
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn(),
}));

// Mock the database - no external references
jest.mock('@/app/_db/db', () => ({
  db: {
    products: {
      orderBy: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      first: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  },
  SyncStatus: {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error',
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
jest.mock('@/app/_components/ui/ProductSearch', () => ({
  __esModule: true,
  default: function MockProductSearch({ onFilter }: { onFilter: (products: any[]) => void }) {
    return (
      <input
        data-testid="product-search"
        placeholder="Buscar productos..."
        onChange={(e) => {
          onFilter([]);
        }}
      />
    );
  },
}));

// Mock child components
jest.mock('@/app/(modules)/inventario/components/ProductModal', () => ({
  __esModule: true,
  default: function MockProductModal() {
    return <div data-testid="product-modal">Product Modal</div>;
  },
}));

jest.mock('@/app/(modules)/inventario/components/StockAdjustmentModal', () => ({
  __esModule: true,
  default: function MockStockAdjustmentModal() {
    return null;
  },
}));

jest.mock('@/app/(modules)/inventario/components/ImportModal', () => ({
  __esModule: true,
  default: function MockImportModal() {
    return null;
  },
}));

// Import after mocks
import InventarioPage from '@/app/(modules)/inventario/page';

describe('InventarioPage with CRUD', () => {
  const mockProducts = [
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
      syncStatus: 'synced',
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
      syncStatus: 'pending',
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
      syncStatus: 'error',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup useLiveQuery mock
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockImplementation(() => mockProducts);
    
    // Setup db mock
    const { db } = require('@/app/_db/db');
    db.products.toArray.mockResolvedValue(mockProducts);
  });

  it('renders main inventory page with all elements', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    expect(screen.getByRole('heading', { name: /Módulo de Inventario/i })).toBeInTheDocument();
    expect(screen.getByText(/Gestiona tus productos/i)).toBeInTheDocument();
    expect(screen.getByTestId('product-search')).toBeInTheDocument();
  });

  it('displays product statistics', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/3 productos/i)).toBeInTheDocument();
    });
    
    expect(screen.getByText(/2 stock bajo/i)).toBeInTheDocument();
    expect(screen.getByText(/1 agotados/i)).toBeInTheDocument();
  });

  it('renders action buttons', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    expect(screen.getByRole('link', { name: /Historial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar CSV/i })).toBeInTheDocument();
    // "Nuevo Producto" is a button, not a link
    expect(screen.getByRole('button', { name: /Nuevo Producto/i })).toBeInTheDocument();
  });

  it('renders products table with data', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor')).toBeInTheDocument();
      expect(screen.getByText('Filtro de Aire')).toBeInTheDocument();
      expect(screen.getByText('Bujía')).toBeInTheDocument();
    });
  });

  it('shows stock status indicators', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      
      const firstRow = rows[1];
      expect(within(firstRow).getByText('50')).toBeInTheDocument();
      
      const secondRow = rows[2];
      expect(within(secondRow).getByText('5')).toBeInTheDocument();
      
      const thirdRow = rows[3];
      expect(within(thirdRow).getByText('Agotado')).toBeInTheDocument();
    });
  });

  it('shows sync status badges', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sincronizado')).toBeInTheDocument();
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('displays category badges', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Lubricantes')).toBeInTheDocument();
      expect(screen.getByText('Filtros')).toBeInTheDocument();
      expect(screen.getByText('Bujías')).toBeInTheDocument();
    });
  });

  it('shows empty state when no products', async () => {
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockReturnValue([]);

    await act(async () => {
      render(<InventarioPage />);
    });

    await waitFor(() => {
      // The message has a period at the end
      expect(screen.getByText(/No hay productos en el inventario/i)).toBeInTheDocument();
      // It's a button, not a link
      expect(screen.getByRole('button', { name: /Agregar primer producto/i })).toBeInTheDocument();
    });
  });

  it('has link to movements history page', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    const historialLink = screen.getByRole('link', { name: /Historial/i });
    expect(historialLink).toHaveAttribute('href', '/inventario/movimientos');
  });

  it('renders table with all columns', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });

    const table = screen.getByRole('table');
    expect(within(table).getByText('SKU')).toBeInTheDocument();
    expect(within(table).getByText('Producto')).toBeInTheDocument();
    expect(within(table).getByText('Stock')).toBeInTheDocument();
    expect(within(table).getByText('Costo (USD)')).toBeInTheDocument();
    expect(within(table).getByText('Precio (USD)')).toBeInTheDocument();
    expect(within(table).getByText('Proveedor')).toBeInTheDocument();
    expect(within(table).getByText('Estado')).toBeInTheDocument();
    expect(within(table).getByText('Acciones')).toBeInTheDocument();
  });
});
