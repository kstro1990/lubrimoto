import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductForm from '@/app/(modules)/inventario/components/ProductForm';
import { Product, SyncStatus } from '@/app/_db/db';

// Mock the database
jest.mock('@/app/_db/db', () => ({
  ...jest.requireActual('@/app/_db/db'),
  generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  db: {
    products: {
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    },
  },
}));

describe('ProductForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('renders form with all required fields', () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/SKU/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombre del Producto/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Precio de Venta/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Stock Actual/i)).toBeInTheDocument();
      expect(screen.getByText(/Crear Producto/i)).toBeInTheDocument();
    });

    it('auto-generates SKU on mount', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const skuInput = screen.getByDisplayValue('PROD-250207-0001');
        expect(skuInput).toBeInTheDocument();
      });
    });

    it('validates required fields', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Submit empty form
      const submitButton = screen.getByText(/Crear Producto/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/El nombre debe tener al menos 2 caracteres/i)).toBeInTheDocument();
        expect(screen.getByText(/El precio debe ser mayor a 0/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('submits form with valid data', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Fill in the form
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Test Product' },
      });

      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });

      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '10' },
      });

      // Submit form
      const submitButton = screen.getByText(/Crear Producto/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      const submittedProduct = mockOnSubmit.mock.calls[0][0];
      expect(submittedProduct.name).toBe('Test Product');
      expect(submittedProduct.priceUsd).toBe(50);
      expect(submittedProduct.stockQuantity).toBe(10);
      expect(submittedProduct.syncStatus).toBe(SyncStatus.PENDING);
    });

    it('calculates and displays profit margin', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Fill cost and price
      fireEvent.change(screen.getByLabelText(/Costo/i), {
        target: { name: 'costUsd', value: '30.00' },
      });

      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });

      await waitFor(() => {
        expect(screen.getByText(/40.0%/)).toBeInTheDocument();
        expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
      });
    });

    it('allows selecting category', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const categorySelect = screen.getByLabelText(/Categoría/i);
      fireEvent.change(categorySelect, {
        target: { name: 'category', value: 'Lubricantes' },
      });

      expect(categorySelect).toHaveValue('Lubricantes');
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText(/Cancelar/i);
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    const existingProduct: Product = {
      id: 1,
      sku: 'PROD-001',
      name: 'Existing Product',
      description: 'A test product',
      costUsd: 25,
      priceUsd: 40,
      stockQuantity: 15,
      minStockAlert: 5,
      supplier: 'Test Supplier',
      category: 'Filtros',
      barcode: '123456789',
      location: 'Shelf A-1',
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('pre-fills form with existing product data', () => {
      render(
        <ProductForm
          product={existingProduct}
          mode="edit"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('Existing Product')).toBeInTheDocument();
      expect(screen.getByDisplayValue('PROD-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('40')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    });

    it('shows save button instead of create button', () => {
      render(
        <ProductForm
          product={existingProduct}
          mode="edit"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Guardar Cambios/i)).toBeInTheDocument();
      expect(screen.queryByText(/Crear Producto/i)).not.toBeInTheDocument();
    });

    it('submits updated data', async () => {
      render(
        <ProductForm
          product={existingProduct}
          mode="edit"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Update name
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Updated Product' },
      });

      const submitButton = screen.getByText(/Guardar Cambios/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      const submittedProduct = mockOnSubmit.mock.calls[0][0];
      expect(submittedProduct.name).toBe('Updated Product');
      expect(submittedProduct.id).toBe(1);
    });
  });

  describe('Validation', () => {
    it('shows error for negative stock', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '-5' },
      });

      fireEvent.blur(screen.getByLabelText(/Stock Actual/i));

      await waitFor(() => {
        expect(screen.getByText(/El stock no puede ser negativo/i)).toBeInTheDocument();
      });
    });

    it('shows error for name too short', async () => {
      render(
        <ProductForm
          product={null}
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'A' },
      });

      fireEvent.blur(screen.getByLabelText(/Nombre del Producto/i));

      await waitFor(() => {
        expect(screen.getByText(/El nombre debe tener al menos 2 caracteres/i)).toBeInTheDocument();
      });
    });
  });
});
