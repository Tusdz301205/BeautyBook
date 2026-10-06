import React from 'react';
import { OperationsProvider, useOperations } from './OperationsContext';
import { useAuth } from '../context/AuthContext';
import { mobileShell } from '../utils/operationSession';
import StaffTabs from './staff/StaffTabs';
import OwnerTabs from './owner/OwnerTabs';
import UnsupportedWorkspace from './UnsupportedWorkspace';
function Shell() {
  const { mode, contextKey } = useOperations();
  const { user } = useAuth();
  if (mobileShell(user) === 'UNSUPPORTED') return <UnsupportedWorkspace />;
  return mode === 'OWNER' ? <OwnerTabs key={contextKey} /> : <StaffTabs key={contextKey} />;
}
export default function OperationsNavigator() { return <OperationsProvider><Shell /></OperationsProvider>; }
