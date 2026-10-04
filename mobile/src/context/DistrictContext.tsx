import React, { createContext, useContext, useState } from 'react';

interface DistrictContextValue {
  selectedDistrict: string;
  isPickerVisible: boolean;
  openPicker: () => void;
  closePicker: () => void;
  selectDistrict: (district: string) => void;
}

const DistrictContext = createContext<DistrictContextValue | undefined>(undefined);

export function DistrictProvider({ children }: { children: React.ReactNode }) {
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả khu vực');
  const [isPickerVisible, setPickerVisible] = useState(false);

  const value: DistrictContextValue = {
    selectedDistrict,
    isPickerVisible,
    openPicker: () => setPickerVisible(true),
    closePicker: () => setPickerVisible(false),
    selectDistrict: (district: string) => {
      setSelectedDistrict(district);
      setPickerVisible(false);
    },
  };

  return <DistrictContext.Provider value={value}>{children}</DistrictContext.Provider>;
}

export function useDistrict() {
  const context = useContext(DistrictContext);
  if (!context) {
    throw new Error('useDistrict must be used within a DistrictProvider');
  }
  return context;
}
