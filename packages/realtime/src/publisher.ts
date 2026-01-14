import { getSharedRedisClient } from "@midday/cache/shared-redis";
import type { RealtimeEvent, RealtimeRecord, TableName, RealtimeEventType } from "./types";
import { buildChannelName } from "./types";

/**
 * Publish a realtime event to Redis
 */
export async function publishEvent<T extends RealtimeRecord>(
  event: RealtimeEvent<T>,
  filterValue?: string,
  filterColumn = "team_id"
): Promise<void> {
  const redis = getSharedRedisClient();

  // Build filter string if we have a filter value
  const filter = filterValue ? `${filterColumn}=eq.${filterValue}` : undefined;
  const channel = buildChannelName(event.table, event.schema, filter);

  const payload = JSON.stringify(event);

  try {
    await redis.publish(channel, payload);
  } catch (error) {
    console.error(`[Realtime] Failed to publish to ${channel}:`, error);
  }
}

/**
 * Helper to create a typed event
 */
function createEvent<T extends RealtimeRecord>(
  type: RealtimeEventType,
  table: TableName,
  record: T,
  oldRecord?: Partial<T>
): RealtimeEvent<T> {
  return {
    type,
    table,
    schema: "public",
    record,
    old_record: oldRecord,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Table-specific publishers for common use cases
 */
export const publishers = {
  inbox: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "inbox", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "inbox", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "inbox", record), teamId, "team_id"),
  },

  vault: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "vault", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "vault", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "vault", record), teamId, "team_id"),
  },

  transactions: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "transactions", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "transactions", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "transactions", record), teamId, "team_id"),
  },

  activities: {
    insert: (record: RealtimeRecord, userId: string) =>
      publishEvent(createEvent("INSERT", "activities", record), userId, "user_id"),
    update: (record: RealtimeRecord, userId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "activities", record, oldRecord), userId, "user_id"),
    delete: (record: RealtimeRecord, userId: string) =>
      publishEvent(createEvent("DELETE", "activities", record), userId, "user_id"),
  },

  documents: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "documents", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "documents", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "documents", record), teamId, "team_id"),
  },

  tracker_entries: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "tracker_entries", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "tracker_entries", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "tracker_entries", record), teamId, "team_id"),
  },

  tracker_projects: {
    insert: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("INSERT", "tracker_projects", record), teamId, "team_id"),
    update: (record: RealtimeRecord, teamId: string, oldRecord?: Partial<RealtimeRecord>) =>
      publishEvent(createEvent("UPDATE", "tracker_projects", record, oldRecord), teamId, "team_id"),
    delete: (record: RealtimeRecord, teamId: string) =>
      publishEvent(createEvent("DELETE", "tracker_projects", record), teamId, "team_id"),
  },
};
