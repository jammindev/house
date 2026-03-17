import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ElectricityBoardNode from './ElectricityBoardNode';
import {
  electricityKeys,
  useElectricityBoards,
  useBreakers,
  useCircuits,
  useUsagePoints,
  useLinks,
} from './hooks';

// ── Board selector ─────────────────────────────────────────────────────────────

interface BoardSelectorProps {
  boards: { id: string; name: string; supply_type: string }[];
  selectedId: string;
  onChange: (id: string) => void;
}

function BoardSelector({ boards, selectedId, onChange }: BoardSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center gap-3">
      <label className="text-sm font-medium text-slate-700" htmlFor="board-select">
        {t('electricity.panel_board')}
      </label>
      <select
        id="board-select"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ElectricityPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: boards = [], isLoading: boardsLoading, error: boardsError } = useElectricityBoards();

  const [selectedBoardId, setSelectedBoardId] = React.useState<string | undefined>(undefined);

  // Once boards load, set default selection to first board
  React.useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  const { data: breakers = [], isLoading: breakersLoading } = useBreakers(selectedBoardId);
  const { data: circuits = [], isLoading: circuitsLoading } = useCircuits(selectedBoardId);
  const { data: usagePoints = [], isLoading: usageLoading } = useUsagePoints(selectedBoardId);
  const { data: links = [], isLoading: linksLoading } = useLinks(selectedBoardId);

  const isLoading =
    boardsLoading ||
    (Boolean(selectedBoardId) && (breakersLoading || circuitsLoading || usageLoading || linksLoading));

  const selectedBoard = React.useMemo(
    () => boards.find((b) => b.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  const boardForNode = React.useMemo(
    () =>
      selectedBoard
        ? { id: selectedBoard.id, name: selectedBoard.name, supplyType: selectedBoard.supply_type }
        : null,
    [selectedBoard],
  );

  const activeLinks = React.useMemo(() => {
    const circuitMap = new Map(circuits.map((c) => [c.id, c.label]));
    const usageMap = new Map(usagePoints.map((u) => [u.id, u.label]));
    return links
      .filter((l) => l.is_active)
      .map((l) => ({
        id: l.id,
        circuitLabel: circuitMap.get(l.circuit) ?? l.circuit,
        usagePointLabel: usageMap.get(l.usage_point) ?? l.usage_point,
      }));
  }, [links, circuits, usagePoints]);

  const initialData = React.useMemo(
    () => ({
      breakers,
      circuits,
      usagePoints,
      activeLinks,
    }),
    [breakers, circuits, usagePoints, activeLinks],
  );

  const summary = React.useMemo(
    () => ({
      circuitsCount: circuits.length,
      breakersCount: breakers.length,
      usagePointsCount: usagePoints.length,
      activeLinksCount: activeLinks.length,
    }),
    [circuits.length, breakers.length, usagePoints.length, activeLinks.length],
  );

  if (boardsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('electricity.loadFailed', { defaultValue: 'Failed to load electricity data.' })}
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: electricityKeys.all })}
          className="ml-2 underline hover:no-underline"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      {boards.length > 1 && selectedBoardId ? (
        <BoardSelector
          boards={boards}
          selectedId={selectedBoardId}
          onChange={setSelectedBoardId}
        />
      ) : null}

      <ElectricityBoardNode
        isOwner
        board={boardForNode}
        summary={summary}
        initialLookup={null}
        initialData={initialData}
        apiBase="/api/electricity"
      />
    </>
  );
}
