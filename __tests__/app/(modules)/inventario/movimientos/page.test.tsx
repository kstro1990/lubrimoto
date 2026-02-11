import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock database - no external references
jest.mock('@/app/_db/db', () => ({
  db: {
    inventoryMovements: {
      orderBy: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    },
    products: {
      toArray: jest.fn().mockResolvedValue([]),
    },
  },
  MovementType: {
    SALE: 'sale',
    PURCHASE: 'purchase',
    ADJUSTMENT: 'adjustment',
    INITIAL: 'initial',
    RETURN: 'return',
  },
}));

// Import after mocks
import MovementsPage from '@/app/(modules)/inventario/movimientos/page';

describe('MovementsPage', () => {
  const mockMovements = [
    {
      id: 1,
      productId: 1,
      productSku: 'PROD-001',
      productName: 'Aceite de Motor',
      type: 'purchase',
      quantity: 50,
      previousStock: 0,
      newStock: 50,
      notes: 'Compra inicial',
      createdAt: new Date('2025-02-07T10:00:00'),
    },
    {
      id: 2,
      productId: 1,
      productSku: 'PROD-001',
      productName: 'Aceite de Motor',
      type: 'sale',
      quantity: -10,
      previousStock: 50,
      newStock: 40,
      referenceId: 123,
      notes: 'Venta #123',
      createdAt: new Date('2025-02-07T14:30:00'),
    },
    {
      id: 3,
      productId: 2,
      productSku: 'PROD-002',
      productName: 'Filtro de Aire',
      type: 'adjustment',
      quantity: 5,
      previousStock: 10,
      newStock: 15,
      notes: 'Ajuste de inventario',
      createdAt: new Date('2025-02-07T16:00:00'),
    },
  ];

  const mockProducts = [
    {
      id: 1,
      sku: 'PROD-001',
      name: 'Aceite de Motor',
      stockQuantity: 40,
      priceUsd: 35,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      sku: 'PROD-002',
      name: 'Filtro de Aire',
      stockQuantity: 15,
      priceUsd: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup useLiveQuery mock - return mock data directly (simulating resolved promise)
    const { useLiveQuery } = require('dexie-react-hooks');
    let callCount = 0;
    useLiveQuery.mockImplementation(() => {
      callCount++;
      // First call is typically for movements, second for products
      // Return the data directly, not a promise
      if (callCount % 2 === 1) {
        return mockMovements;
      }
      return mockProducts;
    });
  });

  it('renders the movements history page', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    expect(screen.getByRole('heading', { name: /Historial de Movimientos/i })).toBeInTheDocument();
    expect(screen.getByText(/Registro de todos los cambios en el inventario/i)).toBeInTheDocument();
  });

  it('displays movement count', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/3 movimientos/i)).toBeInTheDocument();
    });
  });

  it('shows back link to inventory', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    // The back link only has an icon, no text - query by href
    const backLink = screen.getByRole('link');
    expect(backLink).toHaveAttribute('href', '/inventario');
  });

  it('renders filter controls', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    expect(screen.getByText(/Filtros/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Producto, SKU o notas/i)).toBeInTheDocument();
    // Look for select by role instead of label
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2); // Product and Type selects
  });

  it('renders movements table with data', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    // Check headers - use getAllByText for common words that appear multiple times
    expect(screen.getByText('Fecha')).toBeInTheDocument();
    expect(screen.getAllByText('Producto').length).toBeGreaterThan(0);
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Cantidad')).toBeInTheDocument();
    expect(screen.getByText('Stock Anterior')).toBeInTheDocument();
    expect(screen.getByText('Stock Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Notas')).toBeInTheDocument();
  });

  it('shows movement types with correct labels', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    await waitFor(() => {
      // Use getAllByText since these appear in both dropdown and table
      expect(screen.getAllByText('Compra').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Venta').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Ajuste').length).toBeGreaterThan(0);
    });
  });

  it('filters by search term', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    const searchInput = screen.getByPlaceholderText(/Producto, SKU o notas/i);
    
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Aceite' } });
    });

    expect(searchInput).toHaveValue('Aceite');
  });

  it('filters by movement type', async () => {
    await act(async () => {
      render(<MovementsPage />);
    });

    // Get all comboboxes and use the second one (movement type filter)
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[1]; // Second select should be the type filter
    
    await act(async () => {
      fireEvent.change(typeSelect, { target: { value: 'sale' } });
    });

    expect(typeSelect).toHaveValue('sale');
  });

  it('shows empty state when no movements', async () => {
    // Override useLiveQuery to return empty array for this test
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockReturnValue([]);

    await act(async () => {
      render(<MovementsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No hay movimientos registrados/i)).toBeInTheDocument();
    });
  });
});
