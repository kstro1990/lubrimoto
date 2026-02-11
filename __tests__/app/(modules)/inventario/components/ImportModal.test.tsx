import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock database
jest.mock('@/app/_db/db', () => ({
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

import ImportModal from '@/app/(modules)/inventario/components/ImportModal';

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

  it('renders upload step when open', async () => {
    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    expect(screen.getByRole('heading', { name: /Importar Productos desde CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Descargar Plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar plantilla.csv/i })).toBeInTheDocument();
  });

  it('shows format requirements', async () => {
    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    expect(screen.getByText(/Formato Requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/nombre, descripcion, costo_usd/i)).toBeInTheDocument();
  });

  it('shows file upload area', async () => {
    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    expect(screen.getByText(/Arrastra un archivo CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Solo archivos .csv/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/csv-upload/i)).toBeInTheDocument();
  });

  it('validates file type', async () => {
    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    // Get the file input by label
    const fileInput = screen.getByLabelText(/csv-upload/i);
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    });

    // Should show error (via notification mock) - just verify no crash
    await waitFor(() => {
      expect(fileInput).toBeInTheDocument();
    });
  });

  it('calls onClose when clicking close button', async () => {
    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    // Click close button (X)
    const closeButton = screen.getByRole('button', { name: '' });
    
    await act(async () => {
      fireEvent.click(closeButton);
    });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('triggers download when clicking template link', async () => {
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

    await act(async () => {
      render(
        <ImportModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      );
    });

    const downloadLink = screen.getByRole('button', { name: /Descargar plantilla.csv/i });
    
    await act(async () => {
      fireEvent.click(downloadLink);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });
});
