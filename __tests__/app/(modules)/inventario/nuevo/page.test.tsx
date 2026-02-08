import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NewProductPage from '@/app/(modules)/inventario/nuevo/page';
import { Product, SyncStatus, MovementType } from '@/app/_db/db';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock database functions
const mockAdd = jest.fn();
const mockFirst = jest.fn();
const mockGet = jest.fn();
const mockRecordMovement = jest.fn();

jest.mock('@/app/_db/db', () => ({
  db: {
    products: {
      add: (...args: any[]) => mockAdd(...args),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      first: () => mockFirst(),
      get: (...args: any[]) => mockGet(...args),
    },
    inventoryMovements: {
      add: jest.fn().mockResolvedValue(undefined),
    },
  },
  generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  recordInventoryMovement: (...args: any[]) => mockRecordMovement(...args),
  MovementType: {
    INITIAL: 'initial' as const,
  },
  SyncStatus: {
    PENDING: 'pending' as const,
  },
}));

// Mock notifications
const mockSuccess = jest.fn();
const mockError = jest.fn();

jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

describe('NewProductPage - Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirst.mockResolvedValue(null); // No existing SKU
    mockAdd.mockResolvedValue(999); // New product ID
    mockGet.mockResolvedValue({
      id: 999,
      sku: 'PROD-250207-0001',
      name: 'Test Product',
      priceUsd: 50,
      stockQuantity: 10,
    });
    mockRecordMovement.mockResolvedValue(undefined);
  });

  it('successfully creates a new product', async () => {
    render(<NewProductPage />);

    // Fill in the form
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Test Product' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '10' },
      });
    });

    // Submit the form
    const submitButton = screen.getByText(/Crear Producto/i);
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for the add function to be called
    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Verify the product data passed to add()
    const addedProduct = mockAdd.mock.calls[0][0];
    expect(addedProduct.name).toBe('Test Product');
    expect(addedProduct.priceUsd).toBe(50);
    expect(addedProduct.stockQuantity).toBe(10);
    expect(addedProduct.sku).toBe('PROD-250207-0001');
    expect(addedProduct.syncStatus).toBe('pending');
    expect(addedProduct.createdAt).toBeInstanceOf(Date);
    expect(addedProduct.updatedAt).toBeInstanceOf(Date);

    // Verify success notification
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Producto Creado',
        expect.stringContaining('Test Product'),
        4000
      );
    });

    // Verify navigation
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/inventario');
    });
  });

  it('shows validation error when SKU already exists', async () => {
    // Mock existing product with same SKU
    mockFirst.mockResolvedValue({
      id: 1,
      sku: 'PROD-250207-0001',
      name: 'Existing Product',
    });

    render(<NewProductPage />);

    // Fill in the form
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Test Product' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '10' },
      });
    });

    // Submit the form
    const submitButton = screen.getByText(/Crear Producto/i);
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for form validation error (not notification)
    await waitFor(() => {
      expect(screen.getByText(/Este SKU ya existe/i)).toBeInTheDocument();
    });

    // Verify product was not added
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('handles database errors gracefully', async () => {
    // Mock database error
    mockAdd.mockRejectedValue(new Error('Database connection failed'));

    render(<NewProductPage />);

    // Fill in the form
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Test Product' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '10' },
      });
    });

    // Submit the form
    const submitButton = screen.getByText(/Crear Producto/i);
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for error notification
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Database connection failed'),
        5000
      );
    });
  });

  it('cleans empty optional fields before saving', async () => {
    render(<NewProductPage />);

    // Fill in required fields
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nombre del Producto/i), {
        target: { name: 'name', value: 'Test Product' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Precio de Venta/i), {
        target: { name: 'priceUsd', value: '50.00' },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Stock Actual/i), {
        target: { name: 'stockQuantity', value: '10' },
      });
    });

    // Leave optional fields empty (they should be undefined, not empty strings)

    // Submit the form
    const submitButton = screen.getByText(/Crear Producto/i);
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalled();
    });

    const addedProduct = mockAdd.mock.calls[0][0];
    
    // Verify empty optional fields are undefined
    expect(addedProduct.description).toBeUndefined();
    expect(addedProduct.supplier).toBeUndefined();
    expect(addedProduct.category).toBeUndefined();
    expect(addedProduct.barcode).toBeUndefined();
    expect(addedProduct.location).toBeUndefined();
  });
});
