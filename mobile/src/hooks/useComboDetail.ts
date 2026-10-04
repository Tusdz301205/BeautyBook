import { useCallback, useEffect, useState } from 'react';
import { branchesApi } from '../api/branches';
import { combosApi } from '../api/combos';
import { mapCombo, RemoteCombo } from '../mappers/catalog';

export function useComboDetail(comboId: string) {
  const [combo, setCombo] = useState<RemoteCombo | null>(null);
  const [similarCombos, setSimilarCombos] = useState<RemoteCombo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, branches] = await Promise.all([combosApi.listPublic(), branchesApi.list({ limit: 100 })]);
      const byId = new Map(branches.map((branch) => [branch.id, branch]));
      const mapped = rows.map((row) => mapCombo(row, byId.get(row.branchId)));
      const selected = mapped.find((item) => item.id === comboId) ?? null;
      setCombo(selected);
      setSimilarCombos(selected ? mapped.filter((item) => item.branchId === selected.branchId && item.id !== selected.id) : []);
      if (!selected) setError('Không tìm thấy ưu đãi này');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được ưu đãi');
    } finally {
      setLoading(false);
    }
  }, [comboId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { combo, similarCombos, isLoading, error, reload };
}

