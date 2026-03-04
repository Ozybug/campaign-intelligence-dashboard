import { Campaign, CollisionWarning } from '@/types/campaign';

export function detectCollisions(campaigns: Campaign[]): CollisionWarning[] {
  const warnings: CollisionWarning[] = [];
  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'active' || c.status === 'scheduled'
  );

  for (let i = 0; i < activeCampaigns.length; i++) {
    for (let j = i + 1; j < activeCampaigns.length; j++) {
      const a = activeCampaigns[i];
      const b = activeCampaigns[j];

      const aStart = new Date(a.start_time).getTime();
      const aEnd = new Date(a.end_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      // Check overlap
      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);

      if (overlapStart < overlapEnd) {
        // Check if we already have a warning that includes both
        const existing = warnings.find(
          (w) =>
            w.campaigns.some((c) => c.id === a.id) &&
            w.campaigns.some((c) => c.id === b.id)
        );

        if (!existing) {
          warnings.push({
            campaigns: [a, b],
            overlapStart: new Date(overlapStart).toISOString().split('T')[0],
            overlapEnd: new Date(overlapEnd).toISOString().split('T')[0],
          });
        }
      }
    }
  }

  return warnings;
}