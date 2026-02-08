import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MovementsPage from '@/app/(modules)/inventario/movimientos/page';
import { InventoryMovement, MovementType, Product } from '@/app/_db/db';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock dexie-react-hooks
const mockMovements: InventoryMovement[] = [
  {
    id: 1,
    productId: 1,
    productSku: 'PROD-001',
    productName: 'Aceite de Motor',
    type: MovementType.PURCHASE,
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
    type: MovementType.SALE,
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
    type: MovementType.ADJUSTMENT,
    quantity: 5,
    previousStock: 10,
    newStock: 15,
    notes: 'Ajuste de inventario',
    createdAt: new Date('2025-02-07T16:00:00'),
  },
];

const mockProducts: Product[] = [
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

jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn((callback) => callback()),
}));

jest.mock('@/app/_db/db', () => ({
  db: {
    inventoryMovements: {
      orderBy: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(mockMovements),
    },
    products: {
      toArray: jest.fn().mockResolvedValue(mockProducts),
    },
  },
}));

describe('MovementsPage', () => {
  it('renders the movements history page', () => {
    render(<MovementsPage />);

    expect(screen.getByRole('heading', { name: /Historial de Movimientos/i })).toBeInTheDocument();
    expect(screen.getByText(/Registro de todos los cambios en el inventario/i)).toBeInTheDocument();
  });

  it('displays movement count', () => {
    render(<MovementsPage />);

    expect(screen.getByText(/3 movimientos/i)).toBeInTheDocument();
  });

  it('shows back link to inventory', () => {
    render(<MovementsPage />);

    const backLink = screen.getByRole('link');
    expect(backLink).toHaveAttribute('href', '/inventario');
  });

  it('renders filter controls', () => {
    render(<MovementsPage />);

    expect(screen.getByText(/Filtros/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Buscar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Producto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de Movimiento/i)).toBeInTheDocument();
  });

  it('renders movements table with data', () => {
    render(<MovementsPage />);

    // Check headers
    expect(screen.getByText('Fecha')).toBeInTheDocument();
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Cantidad')).toBeInTheDocument();
    expect(screen.getByText('Stock Anterior')).toBeInTheDocument();
    expect(screen.getByText('Stock Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Notas')).toBeInTheDocument();
  });

  it('shows movement types with correct labels', () => {
    render(<MovementsPage />);

    expect(screen.getByText('Compra')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Ajuste')).toBeInTheDocument();
  });

  it('filters by search term', () => {
    render(<MovementsPage />);

    const searchInput = screen.getByPlaceholderText(/Producto, SKU o notas/i);
    fireEvent.change(searchInput, { target: { value: 'Aceite' } });

    // Should show filtered results
    expect(searchInput).toHaveValue('Aceite');
  });

  it('filters by movement type', () => {
    render(<MovementsPage />);

    const typeSelect = screen.getByLabelText(/Tipo de Movimiento/i);
    fireEvent.change(typeSelect, { target: { value: 'sale' } });

    expect(typeSelect).toHaveValue('sale');
  });

  it('shows empty state when no movements', () => {
    // Override mock to return empty array
    const { useLiveQuery } = require('dexie-react-hooks');
    useLiveQuery.mockReturnValue([]);

    render(<MovementsPage />);

    expect(screen.getByText(/No hay movimientos registrados/i)).toBeInTheDocument();
  });
});
