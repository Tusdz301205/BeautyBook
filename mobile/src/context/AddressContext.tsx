import React, { createContext, useCallback, useContext, useState } from 'react';

export type AddressType = 'home' | 'work';

interface AddressContextValue {
  homeAddress: string;
  workAddress: string;
  setAddress: (type: AddressType, value: string) => void;
}

const AddressContext = createContext<AddressContextValue | undefined>(undefined);

export function AddressProvider({ children }: { children: React.ReactNode }) {
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');

  const setAddress = useCallback((type: AddressType, value: string) => {
    if (type === 'home') setHomeAddress(value);
    else setWorkAddress(value);
  }, []);

  return (
    <AddressContext.Provider value={{ homeAddress, workAddress, setAddress }}>{children}</AddressContext.Provider>
  );
}

export function useAddresses() {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddresses must be used within an AddressProvider');
  }
  return context;
}
