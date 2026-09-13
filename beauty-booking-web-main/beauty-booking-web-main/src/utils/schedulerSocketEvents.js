export function bindSchedulerSocketEvents(socket, { refresh, clearScopedData, authFailed }) {
  const handlers = {
    connect: refresh,
    booking_updated: refresh,
    booking_created: refresh,
    booking_deleted: refresh,
    scheduler_resync: refresh,
    scheduler_access_changed: () => { clearScopedData(); refresh(); },
    scheduler_auth_failed: authFailed,
    connect_error: (error) => {
      if (error?.data?.code === 'WS_AUTH_FAILED') authFailed();
    },
  };
  for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
  return () => {
    for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
  };
}
