import React, { createContext, useContext, useState } from 'react';
import { CustomTimeRange, TimeFilterKey } from '../components/TimeFilterSheet';

interface TimeFilterContextValue {
  timeFilter: TimeFilterKey;
  customRange: CustomTimeRange | null;
  isTimeSheetVisible: boolean;
  openTimeSheet: () => void;
  closeTimeSheet: () => void;
  applyTimeFilter: (key: TimeFilterKey, range?: CustomTimeRange) => void;
}

const TimeFilterContext = createContext<TimeFilterContextValue | undefined>(undefined);

export function TimeFilterProvider({ children }: { children: React.ReactNode }) {
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('any');
  const [customRange, setCustomRange] = useState<CustomTimeRange | null>(null);
  const [isTimeSheetVisible, setTimeSheetVisible] = useState(false);

  const value: TimeFilterContextValue = {
    timeFilter,
    customRange,
    isTimeSheetVisible,
    openTimeSheet: () => setTimeSheetVisible(true),
    closeTimeSheet: () => setTimeSheetVisible(false),
    applyTimeFilter: (key: TimeFilterKey, range?: CustomTimeRange) => {
      setTimeFilter(key);
      setCustomRange(key === 'custom' && range ? range : null);
    },
  };

  return <TimeFilterContext.Provider value={value}>{children}</TimeFilterContext.Provider>;
}

export function useTimeFilter() {
  const context = useContext(TimeFilterContext);
  if (!context) {
    throw new Error('useTimeFilter must be used within a TimeFilterProvider');
  }
  return context;
}
