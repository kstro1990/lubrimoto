import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mocks must be defined before imports
jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@/app/_lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

jest.mock('dexie-react-hooks', () => ({
  useLiveQuery: jest.fn(),
}));

jest.mock('@/app/_db/db', () => ({
  db: {
    products: {
      where: jest.fn().mockReturnThis(),
      equalsIgnoreCase: jest.fn().mockReturnThis(),
      first: jest.fn(),
      toArray: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    },
    customers: {
      add: jest.fn(),
      get: jest.fn(),
    },
    sales: {
      add: jest.fn(),
      get: jest.fn(),
    },
    saleItems: {
      add: jest.fn(),
      where: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
    },
    transaction: jest.fn(),
  },
  SyncStatus: {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error',
  },
}));

jest.mock('@/app/_lib/printing', () => ({
  printFiscalInvoice: jest.fn(),
}));

jest.mock('@/app/_lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: { message: "Email sent" }, error: null }),
    },
  },
}));

// Import after mocks
import SaleTerminal from '@/app/(modules)/ventas/nueva/_components/SaleTerminal';
import { db } from '@/app/_db/db';

const mockDb = db as jest.Mocked<typeof db>;

const mockProducts = [
  { id: 1, sku: 'PROD-001', name: 'Aceite de Motor 1L', stockQuantity: 10, priceUsd: 40.00, costUsd: 28.00, supplier: 'Proveedor A' },
  { id: 2, sku: 'PROD-002', name: 'Filtro de Aire', stockQuantity: 5, priceUsd: 22.50, costUsd: 15.00, supplier: 'Proveedor B' },
  { id: 3, sku: 'PROD-003', name: 'Bujías Iridium', stockQuantity: 15, priceUsd: 15.00, costUsd: 10.00, supplier: 'Proveedor A' },
];

describe('SaleTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb.products.toArray as jest.Mock).mockResolvedValue(mockProducts);
  });

  it('renders the initial state with empty cart and customer form', async () => {
    render(<SaleTerminal />);
    
    expect(screen.getByText('Selección de Productos')).toBeInTheDocument();
    expect(screen.getByText('Carrito de Compras')).toBeInTheDocument();
    expect(screen.getByText(/El carrito está vacío/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre del Cliente/i)).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText(/Email del Cliente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar Venta/i })).toBeDisabled();
  });

  it('displays product list on load', async () => {
    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor 1L')).toBeInTheDocument();
      expect(screen.getByText('Filtro de Aire')).toBeInTheDocument();
      expect(screen.getByText('Bujías Iridium')).toBeInTheDocument();
    });

    // Check that products display price and stock
    expect(screen.getByText(/\$40\.00 \| Stock: 10/)).toBeInTheDocument();
  });

  it('adds product to cart and calculates total correctly', async () => {
    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor 1L')).toBeInTheDocument();
    });

    // Add first product to cart
    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    fireEvent.click(addButtons[0]);

    // Check cart
    expect(screen.queryByText(/El carrito está vacío/i)).not.toBeInTheDocument();
    expect(screen.getByText('Aceite de Motor 1L (x1)')).toBeInTheDocument();
    expect(screen.getByText('$40.00')).toBeInTheDocument(); // Subtotal

    // Add second product
    fireEvent.click(addButtons[1]);
    expect(screen.getByText('Filtro de Aire (x1)')).toBeInTheDocument();
    
    // Check total (40 + 22.50 = 62.50)
    expect(screen.getByText(/Total: \$62\.50/)).toBeInTheDocument();
  });

  it('increments quantity when adding same product multiple times', async () => {
    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor 1L')).toBeInTheDocument();
    });

    // Add same product twice
    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[0]);

    // Should show quantity 2
    expect(screen.getByText('Aceite de Motor 1L (x2)')).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument(); // 40 * 2
  });

  it('removes product from cart', async () => {
    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor 1L')).toBeInTheDocument();
    });

    // Add product
    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    fireEvent.click(addButtons[0]);
    
    expect(screen.getByText('Aceite de Motor 1L (x1)')).toBeInTheDocument();

    // Remove product
    const removeButton = screen.getByRole('button', { name: /Remover/i });
    fireEvent.click(removeButton);

    // Cart should be empty again
    expect(screen.getByText(/El carrito está vacío/i)).toBeInTheDocument();
  });

  it('disables add button when product has zero stock', async () => {
    (mockDb.products.toArray as jest.Mock).mockResolvedValue([
      { id: 1, sku: 'PROD-001', name: 'Producto Sin Stock', stockQuantity: 0, priceUsd: 10.00 },
    ]);

    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Producto Sin Stock')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Agregar/i });
    expect(addButton).toBeDisabled();
  });

  it('shows processing state during sale finalization', async () => {
    // Delay the transaction to test loading state
    (mockDb.transaction as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 100;
    });

    render(<SaleTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('Aceite de Motor 1L')).toBeInTheDocument();
    });

    // Add product
    const addButtons = screen.getAllByRole('button', { name: /Agregar/i });
    fireEvent.click(addButtons[0]);

    // Click finalize
    const finalizeButton = screen.getByRole('button', { name: /Finalizar Venta/i });
    fireEvent.click(finalizeButton);

    // Should show processing state
    expect(screen.getByRole('button', { name: /Procesando/i })).toBeInTheDocument();
  });
});
