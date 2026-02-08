import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StockAdjustmentModal from '@/app/(modules)/inventario/components/StockAdjustmentModal';
import { Product, SyncStatus } from '@/app/_db/db';

// Mock the database and notifications
jest.mock('@/app/_db/db', () => ({
  ...jest.requireActual('@/app/_db/db'),
  db: {
    products: {
      update: jest.fn().mockResolvedValue(undefined),
    },
    inventoryMovements: {
      add: jest.fn().mockResolvedValue(undefined),
    },
  },
  recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
  MovementType: {
    PURCHASE: 'purchase',
    ADJUSTMENT: 'adjustment',
  },
  SyncStatus: {
    PENDING: 'pending',
  },
}));

jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('StockAdjustmentModal', () => {
  const mockProduct: Product = {
    id: 1,
    sku: 'PROD-001',
    name: 'Test Product',
    stockQuantity: 50,
    priceUsd: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: SyncStatus.PENDING,
  };

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <StockAdjustmentModal
        isOpen={false}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open', () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Ajustar Stock/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Product/i)).toBeInTheDocument();
    expect(screen.getByText(/50/i)).toBeInTheDocument();
  });

  it('allows selecting adjustment type', () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    const addButton = screen.getByText(/Agregar/i);
    const subtractButton = screen.getByText(/Restar/i);
    const setButton = screen.getByText(/Establecer/i);

    expect(addButton).toBeInTheDocument();
    expect(subtractButton).toBeInTheDocument();
    expect(setButton).toBeInTheDocument();

    // Default should be "Add"
    expect(addButton).toHaveClass('bg-green-100');
  });

  it('calculates new stock correctly for add operation', async () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    const quantityInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(quantityInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(screen.getByText(/60/i)).toBeInTheDocument();
    });
  });

  it('calculates new stock correctly for subtract operation', async () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    // Select subtract
    fireEvent.click(screen.getByText(/Restar/i));

    const quantityInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(quantityInput, { target: { value: '15' } });

    await waitFor(() => {
      expect(screen.getByText(/35/i)).toBeInTheDocument();
    });
  });

  it('calculates new stock correctly for set operation', async () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    // Select set
    fireEvent.click(screen.getByText(/Establecer/i));

    const quantityInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(quantityInput, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText(/100/i)).toBeInTheDocument();
    });
  });

  it('prevents subtracting more than available stock', async () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    // Select subtract
    fireEvent.click(screen.getByText(/Restar/i));

    const quantityInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(quantityInput, { target: { value: '60' } });

    await waitFor(() => {
      expect(screen.getByText(/No puedes restar más del stock disponible/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByText(/Aplicar Ajuste/i);
    expect(submitButton).toBeDisabled();
  });

  it('prevents submitting with zero or negative quantity', async () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    const quantityInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(quantityInput, { target: { value: '0' } });

    const submitButton = screen.getByText(/Aplicar Ajuste/i);
    expect(submitButton).toBeDisabled();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByText(/Cancelar/i);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows adding notes', () => {
    render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={mockProduct}
        onSuccess={mockOnSuccess}
      />
    );

    const notesInput = screen.getByLabelText(/Notas/i);
    fireEvent.change(notesInput, { target: { value: 'Stock de compra mensual' } });

    expect(notesInput).toHaveValue('Stock de compra mensual');
  });

  it('handles null product gracefully', () => {
    const { container } = render(
      <StockAdjustmentModal
        isOpen={true}
        onClose={mockOnClose}
        product={null}
        onSuccess={mockOnSuccess}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
