import React, { createContext, useContext, useState } from 'react';

interface LanguageContextValue {
  isLanguageSheetVisible: boolean;
  openLanguageSheet: () => void;
  closeLanguageSheet: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [isLanguageSheetVisible, setLanguageSheetVisible] = useState(false);

  const value: LanguageContextValue = {
    isLanguageSheetVisible,
    openLanguageSheet: () => setLanguageSheetVisible(true),
    closeLanguageSheet: () => setLanguageSheetVisible(false),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
