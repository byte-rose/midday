/**
 * Realtime event types for Redis pub/sub
 * Mirrors Supabase Realtime postgres_changes API for compatibility
 */

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

export type TableName =
  | "activities"
  | "inbox"
  | "vault"
  | "transactions"
  | "documents"
  | "tracker_entries"
  | "tracker_projects";

export interface RealtimeRecord {
  id: string;
  [key: string]: unknown;
}

export interface RealtimeEvent<T extends RealtimeRecord = RealtimeRecord> {
  type: RealtimeEventType;
  table: TableName;
  schema: string;
  record: T;
  old_record?: Partial<T>;
  timestamp: string;
}

export interface RealtimeFilter {
  table: TableName;
  schema?: string;
  filter?: string; // e.g., "team_id=eq.123" or "user_id=eq.abc"
  event?: RealtimeEventType;
}

export interface RealtimeSubscription {
  channelName: string;
  filter: RealtimeFilter;
  unsubscribe: () => Promise<void>;
}

/**
 * Parse a filter string like "team_id=eq.123" into components
 */
export function parseFilter(filter: string): { column: string; value: string } | null {
  const match = filter.match(/^(\w+)=eq\.(.+)$/);
  if (!match) return null;
  return { column: match[1], value: match[2] };
}

/**
 * Build a Redis channel name from table and filter
 * Format: realtime:{schema}:{table}:{column}:{value}
 * Example: realtime:public:inbox:team_id:123
 */
export function buildChannelName(
  table: TableName,
  schema = "public",
  filter?: string
): string {
  const base = `realtime:${schema}:${table}`;
  if (!filter) return base;

  const parsed = parseFilter(filter);
  if (!parsed) return base;

  return `${base}:${parsed.column}:${parsed.value}`;
}
