import { render, screen } from '@testing-library/react';
import Home from '../../app/page';
import '@testing-library/jest-dom';

describe('Home page', () => {
  it('renders the main heading and subheading', () => {
    render(<Home />);

    const headingElement = screen.getByRole('heading', { name: 'Bienvenido a LubriMotos ERP' });
    const subheadingElement = screen.getByText('Tu solución Offline-First para la gestión de tu negocio.');

    expect(headingElement).toBeInTheDocument();
    expect(subheadingElement).toBeInTheDocument();
  });

  it('renders three module cards', () => {
    render(<Home />);

    const ventaModule = screen.getByRole('heading', { name: 'Ventas' });
    const inventarioModule = screen.getByRole('heading', { name: 'Inventario' });
    const reportesModule = screen.getByRole('heading', { name: 'Reportes' });

    expect(ventaModule).toBeInTheDocument();
    expect(inventarioModule).toBeInTheDocument();
    expect(reportesModule).toBeInTheDocument();
  });
});
