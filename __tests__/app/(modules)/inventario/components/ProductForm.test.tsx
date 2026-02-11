import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Product, SyncStatus } from '@/app/_db/db';

// Mock the database
jest.mock('@/app/_db/db', () => ({
  generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  db: {
    products: {
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    },
  },
  SyncStatus: {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error',
  },
}));

import ProductForm from '@/app/(modules)/inventario/components/ProductForm';

describe('ProductForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('renders form with all required fields', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      expect(screen.getByLabelText(/SKU/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombre del Producto/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Precio de Venta \(USD\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Stock Actual/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Crear Producto/i })).toBeInTheDocument();
    });

    it('auto-generates SKU on mount', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      await waitFor(() => {
        const skuInput = screen.getByDisplayValue('PROD-250207-0001');
        expect(skuInput).toBeInTheDocument();
      });
    });

    it('validates required fields', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      // Wait for SKU to be auto-generated
      await waitFor(() => {
        expect(screen.getByDisplayValue('PROD-250207-0001')).toBeInTheDocument();
      });

      // Fill name with invalid value (too short)
      const nameInput = screen.getByLabelText(/Nombre del Producto/i);
      await act(async () => {
        fireEvent.change(nameInput, { target: { name: 'name', value: 'A' } });
      });
      
      // Trigger blur to mark as touched
      await act(async () => {
        fireEvent.blur(nameInput);
      });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/El nombre debe tener al menos 2 caracteres/i)).toBeInTheDocument();
      });

      // Verify submit was not called
      const submitButton = screen.getByRole('button', { name: /Crear Producto/i });
      await act(async () => {
        fireEvent.click(submitButton);
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('submits form with valid data', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      // Fill in the form
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
          target: { name: 'name', value: 'Test Product' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Precio de Venta \(USD\)/i), {
          target: { name: 'priceUsd', value: '50.00' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
          target: { name: 'stockQuantity', value: '10' },
        });
      });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Crear Producto/i });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });

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
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      // Fill cost and price
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Costo \(USD\)/i), {
          target: { name: 'costUsd', value: '30.00' },
        });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Precio de Venta \(USD\)/i), {
          target: { name: 'priceUsd', value: '50.00' },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/40.0%/)).toBeInTheDocument();
        expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
      });
    });

    it('allows selecting category', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      const categorySelect = screen.getByLabelText(/Categoría/i);
      
      await act(async () => {
        fireEvent.change(categorySelect, {
          target: { name: 'category', value: 'Lubricantes' },
        });
      });

      expect(categorySelect).toHaveValue('Lubricantes');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      // Use getByRole with name to avoid ambiguity
      const cancelButton = screen.getByRole('button', { name: /^Cancelar$/i });
      
      await act(async () => {
        fireEvent.click(cancelButton);
      });

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

    it('pre-fills form with existing product data', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={existingProduct}
            mode="edit"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      expect(screen.getByDisplayValue('Existing Product')).toBeInTheDocument();
      expect(screen.getByDisplayValue('PROD-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('40')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    });

    it('shows save button instead of create button', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={existingProduct}
            mode="edit"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      expect(screen.getByRole('button', { name: /Guardar Cambios/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Crear Producto/i })).not.toBeInTheDocument();
    });

    it('submits updated data', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={existingProduct}
            mode="edit"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      // Update name
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
          target: { name: 'name', value: 'Updated Product' },
        });
      });

      const submitButton = screen.getByRole('button', { name: /Guardar Cambios/i });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });

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
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
          target: { name: 'stockQuantity', value: '-5' },
        });
      });

      await act(async () => {
        fireEvent.blur(screen.getByLabelText(/Stock Actual/i));
      });

      await waitFor(() => {
        expect(screen.getByText(/El stock no puede ser negativo/i)).toBeInTheDocument();
      });
    });

    it('shows error for name too short', async () => {
      await act(async () => {
        render(
          <ProductForm
            product={null}
            mode="create"
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
          target: { name: 'name', value: 'A' },
        });
      });

      await act(async () => {
        fireEvent.blur(screen.getByLabelText(/Nombre del Producto/i));
      });

      await waitFor(() => {
        expect(screen.getByText(/El nombre debe tener al menos 2 caracteres/i)).toBeInTheDocument();
      });
    });
  });
});
