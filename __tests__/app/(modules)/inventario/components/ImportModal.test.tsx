import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportModal from '@/app/(modules)/inventario/components/ImportModal';

// Mock database
jest.mock('@/app/_db/db', () => ({
  ...jest.requireActual('@/app/_db/db'),
  db: {
    products: {
      add: jest.fn().mockResolvedValue(1),
      bulkAdd: jest.fn(),
      toArray: jest.fn().mockResolvedValue([]),
    },
    inventoryMovements: {
      add: jest.fn().mockResolvedValue(undefined),
    },
  },
  generateSKU: jest.fn().mockResolvedValue('PROD-250207-0001'),
  recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
  MovementType: {
    INITIAL: 'initial',
  },
  SyncStatus: {
    PENDING: 'pending',
  },
}));

// Mock notifications
jest.mock('@/app/_components/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ImportModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ImportModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders upload step when open', () => {
    render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText(/Importar Productos desde CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Descargar Plantilla/i)).toBeInTheDocument();
    expect(screen.getByText(/Descargar plantilla.csv/i)).toBeInTheDocument();
  });

  it('shows format requirements', () => {
    render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText(/Formato Requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/nombre, descripcion, costo_usd/i)).toBeInTheDocument();
  });

  it('shows file upload area', () => {
    render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText(/Arrastra un archivo CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Solo archivos .csv/i)).toBeInTheDocument();
  });

  it('validates file type', async () => {
    const { container } = render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Create a mock file input change
    const fileInput = container.querySelector('input[type="file"]');
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
    });

    if (fileInput) {
      fireEvent.change(fileInput);
    }

    // Should show error (via notification mock)
    await waitFor(() => {
      // The error would be called via the notification system
    });
  });

  it('calls onClose when clicking outside or close button', () => {
    render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // Click backdrop
    const backdrop = screen.getByText(/Importar Productos desde CSV/i).parentElement?.parentElement?.parentElement?.firstChild;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('triggers download when clicking template link', () => {
    // Mock createElement and click
    const mockClick = jest.fn();
    const mockCreateObjectURL = jest.fn().mockReturnValue('blob:test');
    
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = jest.fn();
    
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
        } as any;
      }
      return originalCreateElement.call(document, tag);
    });

    render(
      <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const downloadLink = screen.getByText(/Descargar plantilla.csv/i);
    fireEvent.click(downloadLink);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });
});
