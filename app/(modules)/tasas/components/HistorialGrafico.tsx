"use client";

import React from 'react';
import { HistorialTasa } from '@/app/_db/db';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TOKENS } from '@/app/_components/_pmTheme';
import { TrendingUp } from 'lucide-react';

interface HistorialGraficoProps {
  tasas: HistorialTasa[];
}

export default function HistorialGrafico({ tasas }: HistorialGraficoProps) {
  const data = React.useMemo(
    () =>
      tasas.map((tasa) => ({
        fecha: new Date(tasa.fecha).toLocaleDateString('es-VE', {
          month: 'short',
          day: 'numeric',
        }),
        hora: tasa.hora,
        bcv: tasa.tasaBCV,
        paralelo: tasa.tasaParalelo,
        brecha: tasa.brecha,
      })),
    [tasas],
  );

  const avgBCV = React.useMemo(
    () => tasas.reduce((sum, t) => sum + t.tasaBCV, 0) / tasas.length,
    [tasas],
  );

  const avgParalelo = React.useMemo(
    () => tasas.reduce((sum, t) => sum + t.tasaParalelo, 0) / tasas.length,
    [tasas],
  );

  const formatCurrency = (value: number) => `Bs. ${value.toFixed(2)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="text-[12px] px-3 py-2 rounded"
          style={{
            background: TOKENS.charcoal,
            color: '#fff',
            boxShadow: '0 8px 20px rgba(18, 24, 38, 0.18)',
          }}
        >
          <div
            className="font-bold uppercase tracking-wider text-[11px] mb-1"
            style={{ color: TOKENS.slate300 }}
          >
            {label}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 pm-tnum text-[13px]">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: entry.color }}
              />
              {entry.name}: <span className="font-bold">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <section className="pm-card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${TOKENS.slate200}`, background: TOKENS.slate50 }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
          <span className="pm-eyebrow" style={{ color: TOKENS.slate700 }}>
            Evolución de tasas
          </span>
        </div>
        <span className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
          {tasas.length} registros
        </span>
      </div>

      <div className="p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.slate200} />
              <XAxis dataKey="fecha" stroke={TOKENS.slate500} fontSize={11} tickMargin={8} />
              <YAxis
                stroke={TOKENS.slate500}
                fontSize={11}
                tickFormatter={(value) => `Bs.${value}`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine
                y={avgBCV}
                stroke={TOKENS.slate400}
                strokeDasharray="4 4"
                label={{
                  value: `Prom BCV: ${avgBCV.toFixed(2)}`,
                  fill: TOKENS.slate500,
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                y={avgParalelo}
                stroke={TOKENS.slate400}
                strokeDasharray="4 4"
                label={{
                  value: `Prom Par: ${avgParalelo.toFixed(2)}`,
                  fill: TOKENS.slate500,
                  fontSize: 11,
                }}
              />

              <Line
                type="monotone"
                dataKey="bcv"
                name="Tasa BCV"
                stroke={TOKENS.charcoal}
                strokeWidth={2}
                dot={{ fill: TOKENS.charcoal, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: TOKENS.charcoal }}
              />
              <Line
                type="monotone"
                dataKey="paralelo"
                name="Tasa Paralelo"
                stroke={TOKENS.orange}
                strokeWidth={2}
                dot={{ fill: TOKENS.orange, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: TOKENS.orange }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-5 text-[12px]">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: TOKENS.charcoal }}
            />
            <span style={{ color: TOKENS.slate500 }}>Tasa BCV (oficial)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: TOKENS.orange }}
            />
            <span style={{ color: TOKENS.slate500 }}>Tasa Paralelo</span>
          </div>
        </div>
      </div>
    </section>
  );
}
