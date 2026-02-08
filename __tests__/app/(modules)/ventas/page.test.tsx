import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dexie-react-hooks
const mockUseLiveQuery = jest.fn();
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: any[]) => mockUseLiveQuery(...args),
}));

// Mock the logger
jest.mock('@/app/_lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

import VentasPage from '@/app/(modules)/ventas/page';

describe('Ventas page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the main heading and "Nueva Venta" button when no sales are present', async () => {
    mockUseLiveQuery.mockReturnValue([]); // Simulate no sales
    render(<VentasPage />);

    const headingElement = screen.getByRole('heading', { name: 'Historial de Ventas' });
    expect(headingElement).toBeInTheDocument();

    const newSaleButton = screen.getByRole('link', { name: /Nueva Venta/i });
    expect(newSaleButton).toBeInTheDocument();
    expect(newSaleButton).toHaveAttribute('href', '/ventas/nueva');

    expect(screen.getByText('No hay ventas registradas.')).toBeInTheDocument();
  });

  it('renders sales data when sales are present', async () => {
    const mockSales = [
      { id: 1, customerId: 101, totalAmountUsd: 150.00, subtotalUsd: 129.31, ivaAmountUsd: 20.69, date: new Date('2024-01-15T10:00:00Z') },
      { id: 2, customerId: undefined, totalAmountUsd: 75.50, subtotalUsd: 65.09, ivaAmountUsd: 10.41, date: new Date('2024-01-16T11:30:00Z') },
    ];
    mockUseLiveQuery.mockReturnValue(mockSales);
    render(<VentasPage />);

    // Check table headers
    expect(screen.getByText('ID Venta')).toBeInTheDocument();
    expect(screen.getByText('Fecha')).toBeInTheDocument();
    expect(screen.getByText('Cliente ID')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();

    // Check sales data
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('$75.50')).toBeInTheDocument();
  });
});
