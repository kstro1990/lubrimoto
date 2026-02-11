import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dexie-react-hooks
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn().mockReturnValue([]),
}));

// Mock the logger
jest.mock('@/app/_lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

// Mock NotificationProvider - ADDED THIS
jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock ProductSearch
jest.mock('@/app/_components/ui/ProductSearch', () => {
  return function MockProductSearch() {
    return <input data-testid="product-search" placeholder="Buscar productos..." />;
  };
});

// Mock child modals
jest.mock('@/app/(modules)/inventario/components/ProductModal', () => {
  return function MockProductModal() {
    return null;
  };
});

jest.mock('@/app/(modules)/inventario/components/StockAdjustmentModal', () => {
  return function MockStockAdjustmentModal() {
    return null;
  };
});

jest.mock('@/app/(modules)/inventario/components/ImportModal', () => {
  return function MockImportModal() {
    return null;
  };
});

import InventarioPage from '@/app/(modules)/inventario/page';

describe('Inventario page', () => {
  it('renders the main heading', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });
    
    const headingElement = screen.getByRole('heading', { name: /Módulo de Inventario/i });
    expect(headingElement).toBeInTheDocument();
  });

  it('renders the table headers', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('SKU')).toBeInTheDocument();
      expect(screen.getByText('Producto')).toBeInTheDocument();
      expect(screen.getByText('Stock')).toBeInTheDocument();
      expect(screen.getByText('Proveedor')).toBeInTheDocument();
      expect(screen.getByText('Costo (USD)')).toBeInTheDocument();
      expect(screen.getByText('Precio (USD)')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });
  });

  it('shows loading or empty state initially', async () => {
    await act(async () => {
      render(<InventarioPage />);
    });
    
    // Should show loading or empty state
    const loadingText = screen.getByText(/Cargando|No hay productos/i);
    expect(loadingText).toBeInTheDocument();
  });
});
