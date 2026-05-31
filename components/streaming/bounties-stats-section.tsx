import { fetchBountiesStats } from '@/lib/streaming/chunk-data';

export async function BountiesStatsSection() {
  const stats = await fetchBountiesStats();

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-2xl font-bold text-foreground">{stats.categories}</p>
        <p className="text-xs text-muted-foreground">Categories</p>
      </div>
      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-2xl font-bold text-foreground">${stats.avgBudget.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Avg Budget</p>
      </div>
      <div className="rounded-xl border border-border p-4 text-center">
        <p className="text-2xl font-bold text-foreground">{Math.round(stats.completionRate * 100)}%</p>
        <p className="text-xs text-muted-foreground">Completion</p>
      </div>
    </div>
  );
}
