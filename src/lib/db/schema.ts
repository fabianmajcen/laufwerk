import Dexie, { type Table } from "dexie";
import type { ActivityData, ActivitySummary, WellnessRow } from "../garmin/types";

export interface SyncStateRow {
  key: string;
  value: unknown;
}

export interface KvRow {
  key: string;
  value: unknown;
}

export interface ActivityRow extends ActivitySummary {
  /** duplicated from activityType.typeKey for indexing */
  typeKey: string;
}

class LaufwerkDB extends Dexie {
  activities!: Table<ActivityRow, number>;
  activityData!: Table<ActivityData, number>;
  wellness!: Table<WellnessRow, [string, string]>;
  ranges!: Table<WellnessRow, [string, string]>;
  syncState!: Table<SyncStateRow, string>;
  kv!: Table<KvRow, string>;

  constructor() {
    super("laufwerk");
    this.version(1).stores({
      activities: "activityId, startTimeLocal, typeKey",
      activityData: "activityId",
      wellness: "[metric+date], date, metric",
      ranges: "[metric+date], date, metric",
      syncState: "key",
      kv: "key",
    });
  }
}

export const db = new LaufwerkDB();
