import { fetchBountiesHeader } from '@/lib/streaming/chunk-data';

export async function BountiesHeaderSection() {
  const stats = await fetchBountiesHeader();

  return (
    <div className="mb-10">
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Open Bounties</h1>
      <p className="text-muted-foreground max-w-2xl">
        Discover paid opportunities from top creators. {stats.active} active bounties · ${stats.totalBudget.toLocaleString()} total budget.
      </p>
    </div>
  );
}
