"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { Product, db, generateSKU, SyncStatus, recordInventoryMovement, MovementType } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ImportPreview {
  row: number;
  data: Partial<Product>;
  errors: string[];
  isValid: boolean;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const { success, error: showError } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseCSV = (content: string): string[][] => {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    });
  };

  const validateRow = (row: string[], index: number): ImportPreview => {
    const errors: string[] = [];
    const data: Partial<Product> = {
      name: row[0]?.trim(),
      description: row[1]?.trim(),
      costUsd: row[2] ? parseFloat(row[2]) : undefined,
      priceUsd: row[3] ? parseFloat(row[3]) : 0,
      stockQuantity: row[4] ? parseInt(row[4]) : 0,
      minStockAlert: row[5] ? parseInt(row[5]) : 5,
      supplier: row[6]?.trim(),
      category: row[7]?.trim(),
      barcode: row[8]?.trim(),
      location: row[9]?.trim(),
    };

    // Validations
    if (!data.name || data.name.length < 2) {
      errors.push('Nombre es requerido (mínimo 2 caracteres)');
    }

    if (!data.priceUsd || data.priceUsd <= 0) {
      errors.push('Precio de venta es requerido y debe ser mayor a 0');
    }

    if (data.stockQuantity === undefined || data.stockQuantity < 0) {
      errors.push('Stock no puede ser negativo');
    }

    if (data.costUsd !== undefined && data.costUsd < 0) {
      errors.push('Costo no puede ser negativo');
    }

    return {
      row: index + 2, // +2 because of header row and 0-index
      data,
      errors,
      isValid: errors.length === 0,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      showError('Error', 'El archivo debe ser formato CSV', 3000);
      return;
    }

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);
      
      // Skip header row
      const dataRows = rows.slice(1);
      
      const previewData = dataRows.map((row, index) => validateRow(row, index));
      setPreview(previewData);
      setStep('preview');
    };
    
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    const validRows = preview.filter(p => p.isValid);
    if (validRows.length === 0) {
      showError('Error', 'No hay productos válidos para importar', 3000);
      return;
    }

    setStep('importing');
    setIsProcessing(true);

    try {
      const now = new Date();
      let imported = 0;
      let errors = 0;

      for (const row of validRows) {
        try {
          // Generate SKU
          const sku = await generateSKU();
          
          const product: Product = {
            ...row.data,
            sku,
            syncStatus: SyncStatus.PENDING,
            createdAt: now,
            updatedAt: now,
          } as Product;

          const id = await db.products.add(product);
          
          // Record initial stock
          await recordInventoryMovement(
            { ...product, id },
            MovementType.INITIAL,
            product.stockQuantity,
            undefined,
            'Importado desde CSV'
          );
          
          imported++;
        } catch (err) {
          console.error('Error importing row:', row.row, err);
          errors++;
        }
      }

      success(
        'Importación Completada',
        `${imported} productos importados exitosamente${errors > 0 ? `, ${errors} con errores` : ''}`,
        5000
      );

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Import error:', err);
      showError('Error', 'Ocurrió un error durante la importación', 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setStep('upload');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const headers = 'nombre,descripcion,costo_usd,precio_usd,stock,stock_minimo,proveedor,categoria,codigo_barras,ubicacion';
    const example = 'Aceite 10W-40,Aceite sintético 1 litro,25.00,35.00,50,5,Proveedor A,Lubricantes,7501234567890,Estante A-1';
    const csvContent = `${headers}\n${example}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_productos.csv';
    link.click();
  };

  const validCount = preview.filter(p => p.isValid).length;
  const invalidCount = preview.filter(p => !p.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Importar Productos desde CSV
            </h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {step === 'upload' && (
              <div className="space-y-6">
                {/* Template Download */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start">
                    <Download className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Descargar Plantilla</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Descarga la plantilla CSV con el formato correcto para importar tus productos.
                      </p>
                      <button
                        onClick={downloadTemplate}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Descargar plantilla.csv
                      </button>
                    </div>
                  </div>
                </div>

                {/* Format Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Formato Requerido</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    El archivo CSV debe tener las siguientes columnas en orden:
                  </p>
                  <div className="text-sm text-gray-700 font-mono bg-white p-3 rounded border">
                    nombre, descripcion, costo_usd, precio_usd, stock, stock_minimo, proveedor, categoria, codigo_barras, ubicacion
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Solo nombre y precio_usd son obligatorios. El SKU se generará automáticamente.
                  </p>
                </div>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900">
                      Arrastra un archivo CSV o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Solo archivos .csv (máximo 1000 productos)
                    </p>
                  </label>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold">{validCount}</span> válidos
                      </span>
                    </div>
                    {invalidCount > 0 && (
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                        <span className="text-sm text-gray-700">
                          <span className="font-semibold">{invalidCount}</span> con errores
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setStep('upload');
                      setPreview([]);
                      setFile(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Subir otro archivo
                  </button>
                </div>

                {/* Preview Table */}
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fila</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.map((row, idx) => (
                        <tr key={idx} className={!row.isValid ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 text-sm text-gray-500">{row.row}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{row.data.name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">${row.data.priceUsd}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{row.data.stockQuantity}</td>
                          <td className="px-3 py-2 text-sm">
                            {row.isValid ? (
                              <span className="text-green-600">✓ Válido</span>
                            ) : (
                              <div className="text-red-600 text-xs">
                                {row.errors.map((err, i) => (
                                  <div key={i}>• {err}</div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0 || isProcessing}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Importando...' : `Importar ${validCount} productos`}
                  </button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Importando productos...</p>
                <p className="text-sm text-gray-500 mt-1">Por favor no cierres esta ventana</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
