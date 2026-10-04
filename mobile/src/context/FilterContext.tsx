import React, { createContext, useContext, useState } from 'react';
import type { AppliedSearchFilters } from '../components/FilterSheet';

export type ResultType = 'place' | 'expert';

interface FilterContextValue {
  resultType: ResultType;
  setResultType: (type: ResultType) => void;
  isFilterSheetVisible: boolean;
  openFilterSheet: () => void;
  closeFilterSheet: () => void;
  searchFilters: AppliedSearchFilters;
  applySearchFilters: (filters: AppliedSearchFilters) => void;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [resultType, setResultType] = useState<ResultType>('place');
  const [isFilterSheetVisible, setFilterSheetVisible] = useState(false);
  const [searchFilters, applySearchFilters] = useState<AppliedSearchFilters>({});

  const value: FilterContextValue = {
    resultType,
    setResultType,
    isFilterSheetVisible,
    openFilterSheet: () => setFilterSheetVisible(true),
    closeFilterSheet: () => setFilterSheetVisible(false),
    searchFilters,
    applySearchFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
