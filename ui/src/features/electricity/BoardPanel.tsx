/**
 * BoardPanel — représentation graphique d'un tableau électrique.
 *
 * Affiche les appareils de protection placés dans leur rangée/position
 * physique, comme si on regardait le tableau ouvert.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ElectricityBoard, ProtectiveDevice } from '@/lib/api/electricity';

// ── Dimensions physiques (px) ─────────────────────────────────────────────────

const SLOT_W = 34; // largeur d'un module 1P
const SLOT_H = 88; // hauteur d'un module
const GAP = 3;     // gouttière entre modules

// ── Palette par type d'appareil ───────────────────────────────────────────────

const COLORS: Record<string, { bg: string; border: string; text: string; handle: string }> = {
  breaker:  { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-900',   handle: 'bg-blue-400'   },
  rcd:      { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900', handle: 'bg-purple-400' },
  combined: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-900', handle: 'bg-indigo-400' },
  main:     { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-900',  handle: 'bg-amber-400'  },
};

const PHASE_DOT: Record<string, string> = {
  L1: 'bg-red-500',
  L2: 'bg-yellow-400',
  L3: 'bg-blue-500',
};

function clr(type: string) {
  return COLORS[type] ?? COLORS.breaker;
}

// ── Types internes ────────────────────────────────────────────────────────────

interface BoardPanelProps {
  board: ElectricityBoard;
  devices: ProtectiveDevice[];
  /** Optionnel : clic sur un appareil (ex. ouvrir le dialog d'édition). */
  onDeviceClick?: (device: ProtectiveDevice) => void;
}

type Cell =
  | { kind: 'device'; device: ProtectiveDevice; span: number }
  | { kind: 'empty' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCells(
  devices: ProtectiveDevice[],
  row: number,
  totalSlots: number,
): Cell[] {
  const rowDevices = devices
    .filter((d) => d.row === row && d.position != null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const cells: Cell[] = [];
  let cursor = 1;

  for (const d of rowDevices) {
    const start = d.position!;
    const end = d.position_end ?? start;

    for (let s = cursor; s < start && s <= totalSlots; s++) {
      cells.push({ kind: 'empty' });
    }

    if (start <= totalSlots) {
      cells.push({
        kind: 'device',
        device: d,
        span: Math.min(end, totalSlots) - start + 1,
      });
    }
    cursor = Math.max(cursor, end + 1);
  }

  for (let s = cursor; s <= totalSlots; s++) {
    cells.push({ kind: 'empty' });
  }

  return cells;
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div
      className="flex-none rounded border border-dashed border-slate-600"
      style={{ width: SLOT_W, height: SLOT_H }}
      aria-hidden
    />
  );
}

interface DeviceModuleProps {
  device: ProtectiveDevice;
  span: number;
  onClick?: (d: ProtectiveDevice) => void;
}

function DeviceModule({ device, span, onClick }: DeviceModuleProps) {
  const colors = clr(device.device_type);
  const width = span * SLOT_W + (span - 1) * GAP;
  const isRcd = device.device_type === 'rcd' || device.device_type === 'combined';

  return (
    <button
      type="button"
      onClick={() => onClick?.(device)}
      className={cn(
        'relative flex flex-shrink-0 flex-col items-center overflow-hidden rounded border-2 transition-opacity',
        colors.bg,
        colors.border,
        onClick ? 'cursor-pointer hover:opacity-75 active:scale-95' : 'cursor-default',
        device.is_spare && 'opacity-40',
        !device.is_active && 'grayscale opacity-50',
      )}
      style={{ width, height: SLOT_H }}
      title={[
        device.label,
        device.rating_amps != null ? `${device.rating_amps}A` : null,
        device.notes || null,
      ]
        .filter(Boolean)
        .join(' — ')}
    >
      {/* Phase indicator dot */}
      {device.phase && (
        <span
          className={cn(
            'absolute right-1 top-1 h-2 w-2 rounded-full',
            PHASE_DOT[device.phase] ?? 'bg-slate-400',
          )}
        />
      )}

      {/* Toggle handle / TEST button */}
      <div className="mt-2 flex justify-center">
        {isRcd ? (
          <div
            className={cn(
              'rounded-full border px-1.5 py-px text-[7px] font-bold uppercase',
              colors.border,
              colors.text,
            )}
          >
            TEST
          </div>
        ) : (
          <div className={cn('h-5 w-3 rounded-sm shadow-inner', colors.handle)} />
        )}
      </div>

      {/* Ampérage */}
      <div className={cn('mt-1 text-center text-xs font-bold leading-none', colors.text)}>
        {device.rating_amps != null ? `${device.rating_amps}A` : '—'}
      </div>

      {/* Sensibilité RCD */}
      {device.sensitivity_ma != null && (
        <div className={cn('text-[9px] leading-none', colors.text)}>
          {device.sensitivity_ma}mA
        </div>
      )}

      {/* Type code RCD (AC, A, F…) */}
      {device.type_code && (
        <div className={cn('text-[8px] leading-none uppercase', colors.text)}>
          {device.type_code}
        </div>
      )}

      {/* Courbe (disjoncteurs) */}
      {device.curve_type && !isRcd && (
        <div className={cn('text-[8px] leading-none uppercase', colors.text)}>
          {device.curve_type}
        </div>
      )}

      {/* Étiquette */}
      <div
        className={cn(
          'mt-auto truncate px-0.5 pb-1 text-center font-mono text-[8px]',
          colors.text,
        )}
      >
        {device.label ?? ''}
      </div>

      {/* Mention RÉSERVE */}
      {device.is_spare && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 text-[8px] font-semibold text-slate-500">
            RÉSE.
          </span>
        </div>
      )}
    </button>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function BoardPanel({ board, devices, onDeviceClick }: BoardPanelProps) {
  const { t } = useTranslation();

  const placedDevices = devices.filter((d) => d.row != null && d.position != null);
  const unplacedDevices = devices.filter((d) => d.row == null || d.position == null);

  const totalRows =
    board.rows ??
    (placedDevices.length > 0
      ? Math.max(...placedDevices.map((d) => d.row ?? 0))
      : 0);

  const totalSlots =
    board.slots_per_row ??
    (placedDevices.length > 0
      ? Math.max(...placedDevices.map((d) => d.position_end ?? d.position ?? 0))
      : 13);

  // Ne rien rendre si aucune donnée de position et pas de config grille
  if (totalRows === 0 && placedDevices.length === 0 && unplacedDevices.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center">
    <div className="inline-block overflow-hidden rounded-2xl bg-slate-800 shadow-xl">
      {/* En-tête du tableau */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-slate-700 px-4 py-2.5">
        <div>
          {board.label ? (
            <span className="font-mono text-xs text-slate-400">{board.label}</span>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-slate-100">{board.name}</span>
        <div className="flex justify-end">
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
          {board.supply_type === 'three_phase' ? '3~' : '1~'}
        </span>
        </div>
      </div>

      {/* Intérieur de l'armoire */}
      <div className="space-y-2 p-3">
        {totalRows > 0
          ? Array.from({ length: totalRows }, (_, i) => i + 1).map((row) => {
              const cells = buildCells(placedDevices, row, totalSlots);
              return (
                <div key={row} className="rounded-lg bg-slate-700 px-3 py-2">
                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {t('electricity.board.rowLabel', { n: row })}
                  </div>
                  <div className="flex items-end overflow-x-auto pb-0.5" style={{ gap: GAP }}>
                    {cells.map((cell, idx) =>
                      cell.kind === 'device' ? (
                        <DeviceModule
                          key={cell.device.id}
                          device={cell.device}
                          span={cell.span}
                          onClick={onDeviceClick}
                        />
                      ) : (
                        <EmptySlot key={idx} />
                      ),
                    )}
                  </div>
                </div>
              );
            })
          : null}

        {/* Appareils sans position */}
        {unplacedDevices.length > 0 && (
          <div className="rounded-lg border border-dashed border-slate-600 px-3 py-2">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {t('electricity.board.unplaced')}
            </div>
            <div className="flex flex-wrap" style={{ gap: GAP }}>
              {unplacedDevices.map((d) => (
                <DeviceModule
                  key={d.id}
                  device={d}
                  span={d.pole_count ?? 1}
                  onClick={onDeviceClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
