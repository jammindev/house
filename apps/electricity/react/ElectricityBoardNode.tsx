// frontend/src/electricity/ElectricityBoardNode.tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';

type RefItem = { id: string; label: string; name?: string };
type ActiveLinkItem = { id: string; circuitLabel: string; usagePointLabel: string };

type ElectricityPageProps = {
  isOwner: boolean;
  board: { id: string; name: string; supplyType: string } | null;
  summary: {
    circuitsCount: number;
    breakersCount: number;
    usagePointsCount: number;
    activeLinksCount: number;
  };
  initialLookup: unknown;
  initialData: {
    breakers: RefItem[];
    circuits: RefItem[];
    usagePoints: RefItem[];
    activeLinks: ActiveLinkItem[];
  };
  apiBase: string;
};

function getCookie(name: string): string {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return '';
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && 'results' in payload) {
    const results = (payload as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  }
  return [];
}

export default function ElectricityBoardNode(props: ElectricityPageProps) {
  const { t } = useTranslation();
  const apiBase = props.apiBase.replace(/\/+$/, '');

  const [board, setBoard] = useState(props.board);
  const [breakers, setBreakers] = useState<RefItem[]>(props.initialData?.breakers ?? []);
  const [circuits, setCircuits] = useState<RefItem[]>(props.initialData?.circuits ?? []);
  const [usagePoints, setUsagePoints] = useState<RefItem[]>(props.initialData?.usagePoints ?? []);
  const [activeLinks, setActiveLinks] = useState<ActiveLinkItem[]>(props.initialData?.activeLinks ?? []);

  const [reference, setReference] = useState('');
  const [result, setResult] = useState<unknown>(props.initialLookup ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [boardSupplyType, setBoardSupplyType] = useState<'single_phase' | 'three_phase'>('single_phase');
  const [breakerLabel, setBreakerLabel] = useState('');
  const [breakerRating, setBreakerRating] = useState('20');
  const [breakerCurve, setBreakerCurve] = useState('c');

  const [circuitLabel, setCircuitLabel] = useState('');
  const [circuitName, setCircuitName] = useState('');
  const [circuitBreakerId, setCircuitBreakerId] = useState('');
  const [circuitPhase, setCircuitPhase] = useState('');

  const [usageLabel, setUsageLabel] = useState('');
  const [usageName, setUsageName] = useState('');
  const [usageKind, setUsageKind] = useState('socket');

  const [linkCircuitId, setLinkCircuitId] = useState('');
  const [linkUsagePointId, setLinkUsagePointId] = useState('');

  const counts = useMemo(
    () => ({
      circuits: circuits.length,
      breakers: breakers.length,
      usagePoints: usagePoints.length,
      activeLinks: activeLinks.length,
    }),
    [circuits.length, breakers.length, usagePoints.length, activeLinks.length]
  );

  function buildQuery(params?: Record<string, string>): string {
    const searchParams = new URLSearchParams(params ?? {});
    return searchParams.toString();
  }

  async function apiRequest(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<Response> {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRFToken'] = getCookie('csrftoken');
    }
    return fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function refreshCollections() {
    const [boardsResp, breakersResp, circuitsResp, usageResp, linksResp] = await Promise.all([
      apiRequest(`${apiBase}/boards/?${buildQuery()}`, 'GET'),
      apiRequest(`${apiBase}/breakers/?${buildQuery()}`, 'GET'),
      apiRequest(`${apiBase}/circuits/?${buildQuery()}`, 'GET'),
      apiRequest(`${apiBase}/usage-points/?${buildQuery()}`, 'GET'),
      apiRequest(`${apiBase}/links/?${buildQuery()}`, 'GET'),
    ]);

    const breakersPayload = breakersResp.ok ? extractList<{ id: string; label: string }>(await breakersResp.json()) : [];
    const circuitsPayload = circuitsResp.ok
      ? extractList<{ id: string; label: string; name?: string }>(await circuitsResp.json())
      : [];
    const usagePayload = usageResp.ok
      ? extractList<{ id: string; label: string; name?: string }>(await usageResp.json())
      : [];

    setBreakers(breakersPayload);
    setCircuits(circuitsPayload);
    setUsagePoints(usagePayload);

    if (boardsResp.ok) {
      const boards = extractList<{ id: string; name: string; supply_type: string }>(await boardsResp.json());
      const firstBoard = boards[0] ?? null;
      setBoard(firstBoard ? { id: firstBoard.id, name: firstBoard.name, supplyType: firstBoard.supply_type } : null);
    }

    if (linksResp.ok) {
      const links = extractList<{ id: string; is_active: boolean; circuit: string; usage_point: string }>(await linksResp.json());
      const circuitMap = new Map(circuitsPayload.map((item) => [item.id, item.label]));
      const usageMap = new Map(usagePayload.map((item) => [item.id, item.label]));
      setActiveLinks(
        links
          .filter((item) => item.is_active)
          .map((item) => ({
            id: item.id,
            circuitLabel: circuitMap.get(item.circuit) ?? item.circuit,
            usagePointLabel: usageMap.get(item.usage_point) ?? item.usage_point,
          }))
      );
    }
  }

  async function handleLookup() {
    if (!reference.trim()) {
      setError('Reference required.');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await apiRequest(`${apiBase}/mapping/lookup/?${buildQuery({ ref: reference.trim() })}`, 'GET');
    if (!response.ok) {
      setResult(null);
      setError(response.status === 404 ? 'Not found.' : 'Lookup failed.');
      setIsLoading(false);
      return;
    }

    const data = await response.json();
    setResult(data);
    setIsLoading(false);
  }

  async function runWrite(
    path: string,
    body: Record<string, unknown>,
    successMessage: string,
    reset?: () => void
  ) {
    setError(null);
    setSuccess(null);
    const response = await apiRequest(path, 'POST', body);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload ? JSON.stringify(payload) : 'Request failed.');
      return;
    }
    if (reset) reset();
    setSuccess(successMessage);
    await refreshCollections();
  }

  return (
    <>
    <PageHeader title={t('electricity.title', { defaultValue: 'Electricity' })} />
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">Electricity API workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">SSR initializes data, all in-app actions call the API.</p>

      <div className="mt-3 text-xs text-muted-foreground">
        <p>Owner: {props.isOwner ? 'yes' : 'no'}</p>
        <p>Circuits: {counts.circuits}</p>
        <p>Breakers: {counts.breakers}</p>
        <p>Usage points: {counts.usagePoints}</p>
      </div>

      {props.isOwner ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-sm font-medium">Board</p>
            <div className="mt-2 flex gap-2">
              <select value={boardSupplyType} onChange={(e) => setBoardSupplyType(e.target.value as 'single_phase' | 'three_phase')} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="single_phase">single_phase</option>
                <option value="three_phase">three_phase</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (board) {
                    setError('An active board already exists for this household.');
                    return;
                  }
                  runWrite(`${apiBase}/boards/`, { name: 'Tableau principal', supply_type: boardSupplyType }, 'Board created.');
                }}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Create
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-sm font-medium">Breaker</p>
            <div className="mt-2 grid gap-2">
              <input value={breakerLabel} onChange={(e) => setBreakerLabel(e.target.value)} placeholder="BRK-01" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={breakerRating} onChange={(e) => setBreakerRating(e.target.value)} type="number" min={1} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <select value={breakerCurve} onChange={(e) => setBreakerCurve(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="b">b</option><option value="c">c</option><option value="d">d</option><option value="other">other</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!board) {
                    setError('Create board first.');
                    return;
                  }
                  runWrite(
                    `${apiBase}/breakers/`,
                    { board: board.id, label: breakerLabel, rating_amps: Number(breakerRating), curve_type: breakerCurve },
                    'Breaker created.',
                    () => setBreakerLabel('')
                  );
                }}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Create
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-sm font-medium">Circuit</p>
            <div className="mt-2 grid gap-2">
              <input value={circuitLabel} onChange={(e) => setCircuitLabel(e.target.value)} placeholder="CIR-01" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={circuitName} onChange={(e) => setCircuitName(e.target.value)} placeholder="Circuit name" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <select value={circuitBreakerId} onChange={(e) => setCircuitBreakerId(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select breaker</option>
                {breakers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <select value={circuitPhase} onChange={(e) => setCircuitPhase(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="" disabled={board?.supplyType === 'three_phase'}>No phase</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!board) {
                    setError('Create board first.');
                    return;
                  }
                  if (!circuitLabel.trim() || !circuitName.trim()) {
                    setError('Circuit label and name are required.');
                    return;
                  }
                  if (!circuitBreakerId) {
                    setError('Select a breaker before creating a circuit.');
                    return;
                  }
                  if (board.supplyType === 'three_phase' && !circuitPhase) {
                    setError('Select a phase (L1/L2/L3) for a three-phase board.');
                    return;
                  }
                  runWrite(
                    `${apiBase}/circuits/`,
                    {
                      board: board.id,
                      breaker: circuitBreakerId,
                      label: circuitLabel.trim(),
                      name: circuitName.trim(),
                      phase: board.supplyType === 'three_phase' ? circuitPhase : null,
                      is_active: true,
                    },
                    'Circuit created.',
                    () => {
                      setCircuitLabel('');
                      setCircuitName('');
                      setCircuitBreakerId('');
                      setCircuitPhase('');
                    }
                  );
                }}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Create
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-sm font-medium">Usage point and link</p>
            <div className="mt-2 grid gap-2">
              <input value={usageLabel} onChange={(e) => setUsageLabel(e.target.value)} placeholder="UP-01" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={usageName} onChange={(e) => setUsageName(e.target.value)} placeholder="Usage point name" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <select value={usageKind} onChange={(e) => setUsageKind(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="socket">socket</option>
                <option value="light">light</option>
              </select>
              <button
                type="button"
                onClick={() => runWrite(`${apiBase}/usage-points/`, { label: usageLabel, name: usageName, kind: usageKind }, 'Usage point created.', () => {
                  setUsageLabel('');
                  setUsageName('');
                })}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Create usage point
              </button>
              <select value={linkCircuitId} onChange={(e) => setLinkCircuitId(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select circuit</option>
                {circuits.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <select value={linkUsagePointId} onChange={(e) => setLinkUsagePointId(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select usage point</option>
                {usagePoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => runWrite(`${apiBase}/links/`, { circuit: linkCircuitId, usage_point: linkUsagePointId, is_active: true }, 'Link created.')}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Create link
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {props.isOwner && activeLinks.length > 0 ? (
        <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">Active links</p>
          <ul className="mt-2 space-y-2">
            {activeLinks.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.circuitLabel} → {item.usagePointLabel}</span>
                <button
                  type="button"
                  onClick={() => runWrite(`${apiBase}/links/${item.id}/deactivate/`, {}, 'Link deactivated.')}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                >
                  Deactivate
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {success ? <p className="mt-3 text-xs text-muted-foreground">{success}</p> : null}

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Find by label (breaker/circuit/usage point)"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={isLoading}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          {isLoading ? 'Loading...' : 'Lookup'}
        </button>
      </div>

      {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}
      {result ? (
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
    </>
  );
}
