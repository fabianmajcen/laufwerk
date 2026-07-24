import { ScreenHeader, EmptyState } from "../components/ScreenHeader";

export function TrendsTab() {
  return (
    <div>
      <ScreenHeader title="Trends" />
      <EmptyState text="Trends need a few weeks of synced data — HRV baseline, training load and VO₂max land here." />
    </div>
  );
}
