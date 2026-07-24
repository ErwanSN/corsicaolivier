export function scopedHeaders(organizationId: string, siteId: string) {
  return {
    'Content-Type': 'application/json',
    'x-organization-id': organizationId,
    'x-site-id': siteId,
  };
}
