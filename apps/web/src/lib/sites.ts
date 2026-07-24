type NamedSite = Readonly<{
  name: string;
}>;

const preferredSiteOrder = ['joliette', 'janet'] as const;

function normalizedSiteName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');
}

function sitePriority(name: string): number {
  const normalizedName = normalizedSiteName(name);
  const priority = preferredSiteOrder.findIndex((siteName) =>
    normalizedName.includes(siteName),
  );

  return priority === -1 ? preferredSiteOrder.length : priority;
}

export function orderSites<T extends NamedSite>(sites: readonly T[]): T[] {
  return [...sites].sort((left, right) => {
    const priorityDifference =
      sitePriority(left.name) - sitePriority(right.name);

    return (
      priorityDifference ||
      left.name.localeCompare(right.name, 'fr-FR', { sensitivity: 'base' })
    );
  });
}
