import { useEffect, useMemo, useState } from 'react';
import { request } from '../../../../shared/api/httpClient';

export type BoardCaseSummary = {
  id: number;
  case_id: string;
  title: string;
  status: string;
  score?: number | null;
  score_max?: number | null;
  fields?: Record<string, unknown>;
  results?: Record<string, unknown>;
};

export type BoardCaseFilters = {
  available: boolean;
  loading: boolean;
  cases: BoardCaseSummary[];
  filteredCases: BoardCaseSummary[];
  selectedCaseId: number | null;
  caseSearch: string;
  caseStatus: string;
  caseMinScore: string;
  setSelectedCaseId: (id: number | null) => void;
  setCaseSearch: (search: string) => void;
  setCaseStatus: (status: string) => void;
  setCaseMinScore: (score: string) => void;
  clear: () => void;
};

export function useBoardCaseFilters({ projectId, active, available }: {
  projectId: number;
  active: boolean;
  available: boolean;
}): BoardCaseFilters {
  const [cases, setCases] = useState<BoardCaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatus, setCaseStatus] = useState('');
  const [caseMinScore, setCaseMinScore] = useState('');

  useEffect(() => {
    if (!active || !available) return undefined;
    let cancelled = false;
    setLoading(true);
    void request<BoardCaseSummary[]>(`/api/cases?project_id=${projectId}&limit=500`).then((rows) => {
      if (cancelled) return;
      setCases(rows);
      setSelectedCaseId((current) => current && rows.some((item) => item.id === current) ? current : null);
    }).catch(() => {
      if (!cancelled) setCases([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [active, available, projectId]);

  const filteredCases = useMemo(() => cases.filter((item) => {
    const query = caseSearch.trim().toLocaleLowerCase();
    const searchableFields = Object.values(item.fields || {}).map((value) => String(value)).join(' ');
    if (query && !`${item.case_id} ${item.title} ${searchableFields}`.toLocaleLowerCase().includes(query)) return false;
    if (selectedCaseId && item.id !== selectedCaseId) return false;
    if (caseStatus && item.status !== caseStatus) return false;
    if (caseMinScore && (item.score == null || Number(item.score) < Number(caseMinScore))) return false;
    return true;
  }), [caseMinScore, caseSearch, caseStatus, cases, selectedCaseId]);

  return {
    available,
    loading,
    cases,
    filteredCases,
    selectedCaseId,
    caseSearch,
    caseStatus,
    caseMinScore,
    setSelectedCaseId,
    setCaseSearch,
    setCaseStatus,
    setCaseMinScore,
    clear: () => {
      setSelectedCaseId(null);
      setCaseSearch('');
      setCaseStatus('');
      setCaseMinScore('');
    },
  };
}
