import { render, screen, waitFor } from '@testing-library/react';
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

import InventarioPage from '@/app/(modules)/inventario/page';

describe('Inventario page', () => {
  it('renders the main heading', () => {
    render(<InventarioPage />);
    const headingElement = screen.getByRole('heading', { name: /Módulo de Inventario/i });
    expect(headingElement).toBeInTheDocument();
  });

  it('renders the table headers', () => {
    render(<InventarioPage />);
    expect(screen.getByText('SKU')).toBeInTheDocument();
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Proveedor')).toBeInTheDocument();
    expect(screen.getByText('Costo (USD)')).toBeInTheDocument();
    expect(screen.getByText('Precio (USD)')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<InventarioPage />);
    // Should show loading or empty state
    const loadingText = screen.getByText(/Cargando productos|No hay productos/i);
    expect(loadingText).toBeInTheDocument();
  });
});
