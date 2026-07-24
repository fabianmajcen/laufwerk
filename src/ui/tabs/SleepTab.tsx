import { ScreenHeader, EmptyState } from "../components/ScreenHeader";

export function SleepTab() {
  return (
    <div>
      <ScreenHeader title="Sleep" />
      <EmptyState text="Sleep data arrives with the first sync — hypnogram, stages and consistency live here." />
    </div>
  );
}
