import { db, generateSKU, generateUUID, recordInventoryMovement, MovementType, SyncStatus } from '@/app/_db/db';

// Mock Dexie
jest.mock('dexie', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      products: {
        count: jest.fn(),
        bulkAdd: jest.fn(),
        where: jest.fn().mockReturnThis(),
        equals: jest.fn().mockReturnThis(),
        above: jest.fn().mockReturnThis(),
        first: jest.fn(),
        add: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        toArray: jest.fn(),
        orderBy: jest.fn().mockReturnThis(),
      },
      inventoryMovements: {
        add: jest.fn(),
        orderBy: jest.fn().mockReturnThis(),
        reverse: jest.fn().mockReturnThis(),
        toArray: jest.fn(),
      },
      version: jest.fn().mockReturnThis(),
      stores: jest.fn().mockReturnThis(),
      open: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Database Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUUID', () => {
    it('generates a valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('generateSKU', () => {
    beforeEach(() => {
      // Reset date for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-07'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('generates SKU with correct format', async () => {
      (db.products.where as jest.Mock).mockReturnValue({
        above: jest.fn().mockReturnValue({
          count: jest.fn().mockResolvedValue(0),
        }),
        equals: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null),
        }),
      });

      const sku = await generateSKU();
      expect(sku).toMatch(/^PROD-250207-\d{4}$/);
    });

    it('increments sequential number', async () => {
      (db.products.where as jest.Mock).mockReturnValue({
        above: jest.fn().mockReturnValue({
          count: jest.fn().mockResolvedValue(5),
        }),
        equals: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null),
        }),
      });

      const sku = await generateSKU();
      expect(sku).toBe('PROD-250207-0006');
    });

    it('handles SKU collision by adding suffix', async () => {
      (db.products.where as jest.Mock).mockReturnValue({
        above: jest.fn().mockReturnValue({
          count: jest.fn().mockResolvedValue(0),
        }),
        equals: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ id: 1, sku: 'PROD-250207-0001' }),
        }),
      });

      const sku = await generateSKU();
      expect(sku).toMatch(/^PROD-250207-0001-[A-Z0-9]{3}$/);
    });
  });

  describe('recordInventoryMovement', () => {
    const mockProduct = {
      id: 1,
      sku: 'PROD-001',
      name: 'Test Product',
      stockQuantity: 50,
      priceUsd: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('records initial stock movement', async () => {
      await recordInventoryMovement(
        mockProduct,
        MovementType.INITIAL,
        50,
        undefined,
        'Stock inicial'
      );

      expect(db.inventoryMovements.add).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1,
          productSku: 'PROD-001',
          productName: 'Test Product',
          type: MovementType.INITIAL,
          quantity: 50,
          previousStock: 0,
          newStock: 50,
          notes: 'Stock inicial',
        })
      );
    });

    it('records purchase movement', async () => {
      await recordInventoryMovement(
        mockProduct,
        MovementType.PURCHASE,
        30,
        undefined,
        'Compra de proveedor'
      );

      expect(db.inventoryMovements.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.PURCHASE,
          quantity: 30,
          previousStock: 20,
          newStock: 50,
        })
      );
    });

    it('records sale movement with negative quantity', async () => {
      await recordInventoryMovement(
        mockProduct,
        MovementType.SALE,
        -10,
        123,
        'Venta #123'
      );

      expect(db.inventoryMovements.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.SALE,
          quantity: -10,
          previousStock: 60,
          newStock: 50,
          referenceId: 123,
        })
      );
    });

    it('includes createdBy when provided', async () => {
      await recordInventoryMovement(
        mockProduct,
        MovementType.ADJUSTMENT,
        5,
        undefined,
        'Ajuste manual',
        'Admin User'
      );

      expect(db.inventoryMovements.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MovementType.ADJUSTMENT,
          createdBy: 'Admin User',
        })
      );
    });
  });

  describe('Database Schema', () => {
    it('has correct table names', () => {
      expect(db.products).toBeDefined();
      expect(db.inventoryMovements).toBeDefined();
      expect(db.customers).toBeDefined();
      expect(db.sales).toBeDefined();
      expect(db.saleItems).toBeDefined();
    });
  });

  describe('SyncStatus Enum', () => {
    it('has all required statuses', () => {
      expect(SyncStatus.PENDING).toBe('pending');
      expect(SyncStatus.SYNCING).toBe('syncing');
      expect(SyncStatus.SYNCED).toBe('synced');
      expect(SyncStatus.ERROR).toBe('error');
    });
  });

  describe('MovementType Enum', () => {
    it('has all required movement types', () => {
      expect(MovementType.SALE).toBe('sale');
      expect(MovementType.PURCHASE).toBe('purchase');
      expect(MovementType.ADJUSTMENT).toBe('adjustment');
      expect(MovementType.INITIAL).toBe('initial');
      expect(MovementType.RETURN).toBe('return');
    });
  });
});
