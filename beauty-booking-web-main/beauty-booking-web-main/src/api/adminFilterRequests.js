// Management branch listings are arrays capped at 100 by the server.
export async function loadAllManagedBranches(getPage) {
  const branches = new Map();
  for (let page = 1; ; page += 1) {
    const response = await getPage({ page, limit: 100 });
    const rows = Array.isArray(response) ? response : response?.data || response?.items || [];
    rows.forEach((branch) => branches.set(branch.id, branch));
    if (rows.length < 100 || (response?.pagination && page >= response.pagination.totalPages)) break;
  }
  return [...branches.values()];
}

export function servicesForCanonicalGroup(services, canonicalServiceId) {
  return services.filter((service) => !canonicalServiceId || service.canonicalServiceId === canonicalServiceId);
}
