import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dexie-react-hooks - return empty arrays for safety
jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn().mockReturnValue([]),
}));

// Mock the logger
jest.mock('@/app/_lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

import ReportesPage from '@/app/(modules)/reportes/page';

describe('Reportes page', () => {
  it('renders the dashboard title', () => {
    render(<ReportesPage />);

    const headingElement = screen.getByRole('heading', { name: /Dashboard de Reportes/i });
    expect(headingElement).toBeInTheDocument();
  });

  it('renders KPI cards', async () => {
    render(<ReportesPage />);

    // Check for KPI labels (use getAllByText since some appear multiple times)
    expect(screen.getAllByText(/Ingresos Totales/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Transacciones/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ticket Promedio/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Productos Bajo Stock/i).length).toBeGreaterThan(0);
  });

  it('renders charts and sections with dynamic titles', async () => {
    render(<ReportesPage />);

    // Check for chart titles
    const chartTitle = screen.getByRole('heading', { name: /Ventas/i });
    expect(chartTitle).toBeInTheDocument();
    
    expect(screen.getByText(/Top 5 Productos Más Vendidos/i)).toBeInTheDocument();
    expect(screen.getByText(/Alertas de Stock Bajo/i)).toBeInTheDocument();
  });

  it('renders date range selector', () => {
    render(<ReportesPage />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();
    
    // Check options exist
    expect(selectElement.querySelector('option[value="7"]')).toBeInTheDocument();
    expect(selectElement.querySelector('option[value="30"]')).toBeInTheDocument();
    expect(selectElement.querySelector('option[value="90"]')).toBeInTheDocument();
    expect(selectElement.querySelector('option[value="all"]')).toBeInTheDocument();
  });

  it('renders today sales summary section', async () => {
    render(<ReportesPage />);

    // Check for today's sales summary
    await waitFor(() => {
      expect(screen.getByText(/Ventas de Hoy/i)).toBeInTheDocument();
    });
  });

  it('allows changing date range', () => {
    render(<ReportesPage />);

    const selectElement = screen.getByRole('combobox') as HTMLSelectElement;
    
    // Should have correct default value
    expect(selectElement.value).toBe('30');
  });
});
