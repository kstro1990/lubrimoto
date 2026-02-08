import { render, screen } from '@testing-library/react';
import NuevaVentaPage from '../../../../../app/(modules)/ventas/nueva/page';
import '@testing-library/jest-dom';

// Mock the SaleTerminal component as it will be tested separately
jest.mock('../../../../../app/(modules)/ventas/nueva/_components/SaleTerminal', () => {
  return jest.fn(() => <div>Mock Sale Terminal</div>);
});

describe('NuevaVentaPage', () => {
  it('renders the main heading and the SaleTerminal component', () => {
    render(<NuevaVentaPage />);

    const headingElement = screen.getByRole('heading', { name: 'Nueva Venta / Facturación' });
    expect(headingElement).toBeInTheDocument();

    expect(screen.getByText('Mock Sale Terminal')).toBeInTheDocument();
  });
});
