import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

interface Household {
  id: string;
  name: string;
}

interface Me {
  active_household: string | null;
}

function fetchHouseholds() {
  return api.get<Household[]>('/households/').then((r) => r.data);
}

function fetchMe() {
  return api.get<Me>('/accounts/me/').then((r) => r.data);
}

export default function HouseholdSwitcher() {
  const qc = useQueryClient();

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: fetchHouseholds,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  const switchHousehold = useMutation({
    mutationFn: (householdId: string) =>
      api.post('/households/switch/', { household_id: householdId }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });

  if (households.length <= 1) return null;

  return (
    <select
      value={me?.active_household ?? ''}
      onChange={(e) => switchHousehold.mutate(e.target.value)}
      className="w-full text-sm rounded border bg-background px-2 py-1"
    >
      {households.map((h) => (
        <option key={h.id} value={h.id}>{h.name}</option>
      ))}
    </select>
  );
}
