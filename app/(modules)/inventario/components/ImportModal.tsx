"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download, FileSpreadsheet } from 'lucide-react';
import {
  Product,
  db,
  generateSKU,
  SyncStatus,
  recordInventoryMovement,
  MovementType,
} from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { PMScope, T, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

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
    const lines = content.split('\n').filter((line) => line.trim());
    return lines.map((line) => {
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
      row: index + 2,
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

      const dataRows = rows.slice(1);

      const previewData = dataRows.map((row, index) => validateRow(row, index));
      setPreview(previewData);
      setStep('preview');
    };

    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    const validRows = preview.filter((p) => p.isValid);
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
          const sku = await generateSKU();

          const product: Product = {
            ...row.data,
            sku,
            syncStatus: SyncStatus.PENDING,
            createdAt: now,
            updatedAt: now,
          } as Product;

          const id = await db.products.add(product);

          await recordInventoryMovement(
            { ...product, id },
            MovementType.INITIAL,
            product.stockQuantity,
            undefined,
            'Importado desde CSV',
          );

          imported++;
        } catch (err) {
          console.error('Error importing row:', row.row, err);
          errors++;
        }
      }

      success(
        'Importación Completada',
        `${imported} productos importados exitosamente${
          errors > 0 ? `, ${errors} con errores` : ''
        }`,
        5000,
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
    const headers =
      'nombre,descripcion,costo_usd,precio_usd,stock,stock_minimo,proveedor,categoria,codigo_barras,ubicacion';
    const example =
      'Aceite 10W-40,Aceite sintético 1 litro,25.00,35.00,50,5,Proveedor A,Lubricantes,7501234567890,Estante A-1';
    const csvContent = `${headers}\n${example}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_productos.csv';
    link.click();
  };

  const validCount = preview.filter((p) => p.isValid).length;
  const invalidCount = preview.filter((p) => !p.isValid).length;

  return (
    <PMScope className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0"
          style={{ background: T.backdrop }}
          onClick={handleClose}
        />

        <div
          className="relative transform overflow-hidden rounded text-left transition-all w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          style={{
            background: T.surface,
            border: `1px solid ${T.slate200}`,
            boxShadow: `0 20px 40px ${T.shadowStrong}`,
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex justify-between items-center sticky top-0 z-10"
            style={{
              background: T.slate50,
              borderBottom: `1px solid ${T.slate200}`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-8 w-8 rounded"
                style={{ background: T.accentFill, color: T.onAccentFill }}
              >
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: T.slate500 }}
                >
                  Importación por lotes
                </div>
                <h3
                  className="text-[16px] font-semibold leading-5"
                  style={{ color: T.headline }}
                >
                  Importar Productos desde CSV
                </h3>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded transition-colors"
              style={{ color: T.slate500 }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = T.slate100)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper */}
          <Stepper step={step} />

          <div className="p-6" style={{ background: T.bg }}>
            {step === 'upload' && (
              <div className="space-y-4">
                {/* Template Download */}
                <div
                  className="px-4 py-3 rounded flex items-start gap-3"
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.slate200}`,
                  }}
                >
                  <div
                    className="flex items-center justify-center h-9 w-9 rounded shrink-0"
                    style={{ background: T.slate100 }}
                  >
                    <Download className="h-4 w-4" style={{ color: T.charcoal }} />
                  </div>
                  <div className="flex-1">
                    <div
                      className="text-[11px] font-bold uppercase tracking-[0.05em]"
                      style={{ color: T.slate500 }}
                    >
                      Paso 1 · Plantilla
                    </div>
                    <h4
                      className="text-[14px] font-semibold"
                      style={{ color: T.charcoal }}
                    >
                      Descargar plantilla CSV
                    </h4>
                    <p className="text-[13px] mt-0.5" style={{ color: T.slate500 }}>
                      Usa la plantilla con el orden correcto de columnas.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold"
                      style={{ color: T.orange }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar plantilla.csv
                    </button>
                  </div>
                </div>

                {/* Format Info */}
                <div
                  className="px-4 py-3 rounded"
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.slate200}`,
                  }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.05em] mb-2"
                    style={{ color: T.slate500 }}
                  >
                    Formato requerido
                  </div>
                  <div
                    className="font-mono text-[12px] p-3 rounded"
                    style={{
                      background: T.slate50,
                      border: `1px solid ${T.slate200}`,
                      color: T.charcoal,
                    }}
                  >
                    nombre, descripcion, costo_usd, precio_usd, stock, stock_minimo, proveedor,
                    categoria, codigo_barras, ubicacion
                  </div>
                  <p className="text-[12px] mt-2" style={{ color: T.slate500 }}>
                    * Solo <strong>nombre</strong> y <strong>precio_usd</strong> son obligatorios.
                    El SKU se generará automáticamente.
                  </p>
                </div>

                {/* File Upload */}
                <div
                  className="rounded p-10 text-center transition-colors"
                  style={{
                    background: T.surface,
                    border: `2px dashed ${T.slate300}`,
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLDivElement).style.borderColor = T.orange;
                  }}
                  onDragLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = T.slate300;
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    aria-label="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer block">
                    <div
                      className="inline-flex items-center justify-center h-14 w-14 rounded mb-3"
                      style={{ background: T.slate100 }}
                    >
                      <FileSpreadsheet
                        className="h-7 w-7"
                        style={{ color: T.charcoal }}
                      />
                    </div>
                    <p
                      className="text-[16px] font-semibold"
                      style={{ color: T.charcoal }}
                    >
                      Arrastra un archivo CSV o haz clic para seleccionar
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: T.slate500 }}>
                      Solo archivos .csv · máximo 1000 productos
                    </p>
                  </label>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Stat
                      icon={<CheckCircle className="h-4 w-4" />}
                      label="Válidos"
                      value={validCount}
                      tone="success"
                    />
                    {invalidCount > 0 && (
                      <Stat
                        icon={<AlertCircle className="h-4 w-4" />}
                        label="Con errores"
                        value={invalidCount}
                        tone="danger"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setStep('upload');
                      setPreview([]);
                      setFile(null);
                    }}
                    className="text-[13px] font-semibold"
                    style={{ color: T.orange }}
                  >
                    Subir otro archivo
                  </button>
                </div>

                {/* Preview Table */}
                <div
                  className="max-h-96 overflow-y-auto rounded"
                  style={{ border: `1px solid ${T.slate200}`, background: T.surface }}
                >
                  <table className="min-w-full text-[13px]">
                    <thead className="sticky top-0 z-10">
                      <tr style={{ background: T.slate100 }}>
                        <ImpTh>Fila</ImpTh>
                        <ImpTh>Nombre</ImpTh>
                        <ImpTh align="right">Precio</ImpTh>
                        <ImpTh align="right">Stock</ImpTh>
                        <ImpTh>Estado</ImpTh>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderTop: `1px solid ${T.slate200}`,
                            background: !row.isValid ? T.redSoft : undefined,
                          }}
                        >
                          <td
                            className="px-3 py-2 pm-tnum"
                            style={{ color: T.slate500 }}
                          >
                            {row.row}
                          </td>
                          <td className="px-3 py-2" style={{ color: T.charcoal }}>
                            {row.data.name || '—'}
                          </td>
                          <td
                            className="px-3 py-2 pm-tnum text-right"
                            style={{ color: T.charcoal }}
                          >
                            ${row.data.priceUsd}
                          </td>
                          <td
                            className="px-3 py-2 pm-tnum text-right"
                            style={{ color: T.charcoal }}
                          >
                            {row.data.stockQuantity}
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                                style={{
                                  background: T.greenSoft,
                                  color: T.green,
                                }}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Válido
                              </span>
                            ) : (
                              <div className="text-[12px]" style={{ color: T.red }}>
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
                <div
                  className="flex justify-end gap-2 pt-3"
                  style={{ borderTop: `1px solid ${T.slate200}` }}
                >
                  <PMBtnSecondary onClick={() => setStep('upload')}>Volver</PMBtnSecondary>
                  <PMBtnPrimary
                    onClick={handleImport}
                    disabled={validCount === 0 || isProcessing}
                  >
                    {isProcessing
                      ? 'Importando…'
                      : `Importar ${validCount} producto${validCount === 1 ? '' : 's'}`}
                  </PMBtnPrimary>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-12">
                <div
                  className="animate-spin rounded-full h-10 w-10 mx-auto mb-4"
                  style={{
                    border: `3px solid ${T.slate200}`,
                    borderTopColor: T.orange,
                  }}
                />
                <p
                  className="text-[16px] font-semibold"
                  style={{ color: T.charcoal }}
                >
                  Importando productos…
                </p>
                <p className="text-[13px] mt-1" style={{ color: T.slate500 }}>
                  Por favor no cierres esta ventana
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PMScope>
  );
}

function Stepper({ step }: { step: 'upload' | 'preview' | 'importing' }) {
  const steps = [
    { key: 'upload', label: 'Subir archivo' },
    { key: 'preview', label: 'Revisar datos' },
    { key: 'importing', label: 'Importar' },
  ] as const;
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <div
      className="px-5 py-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em]"
      style={{
        background: T.surface,
        borderBottom: `1px solid ${T.slate200}`,
      }}
    >
      {steps.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center h-5 w-5 rounded-full"
                style={{
                  background: isActive || isDone ? T.orange : T.slate200,
                  color: isActive || isDone ? '#fff' : T.slate500,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  color: isActive ? T.charcoal : T.slate500,
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px"
                style={{ background: T.slate200 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ImpTh({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em]"
      style={{
        color: T.slate700,
        borderBottom: `1px solid ${T.slate200}`,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'danger';
}) {
  const color = tone === 'success' ? T.green : T.red;
  const bg = tone === 'success' ? T.greenSoft : T.redSoft;
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded"
      style={{ background: bg, color }}
    >
      {icon}
      <span className="text-[13px]">
        <span className="pm-tnum font-bold">{value}</span>{' '}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </span>
    </div>
  );
}
