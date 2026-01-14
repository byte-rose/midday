import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "@api/rest/types";
import { createRealtimeSubscriber } from "@midday/realtime/subscriber";
import type { RealtimeFilter, TableName } from "@midday/realtime/types";

const app = new Hono<Context>();

/**
 * SSE endpoint for realtime updates
 * Replaces Supabase Realtime postgres_changes
 *
 * Usage:
 *   GET /realtime/subscribe?table=inbox&filter=team_id=eq.123
 *   GET /realtime/subscribe?table=activities&filter=user_id=eq.abc
 */
app.get("/subscribe", async (c) => {
  const table = c.req.query("table") as TableName | undefined;
  const filter = c.req.query("filter");
  const event = c.req.query("event") as "INSERT" | "UPDATE" | "DELETE" | "*" | undefined;

  if (!table) {
    return c.json({ error: "Missing required query parameter: table" }, 400);
  }

  // Validate table name
  const validTables: TableName[] = [
    "activities",
    "inbox",
    "vault",
    "transactions",
    "documents",
    "tracker_entries",
    "tracker_projects",
  ];

  if (!validTables.includes(table)) {
    return c.json({ error: `Invalid table: ${table}` }, 400);
  }

  const realtimeFilter: RealtimeFilter = {
    table,
    schema: "public",
    filter,
    event: event || "*",
  };

  return streamSSE(c, async (stream) => {
    const subscriber = createRealtimeSubscriber();
    let unsubscribe: (() => Promise<void>) | null = null;

    try {
      // Subscribe to Redis channel
      unsubscribe = await subscriber.subscribe(realtimeFilter, (event) => {
        stream.writeSSE({
          event: event.type.toLowerCase(),
          data: JSON.stringify(event),
        });
      });

      // Send initial connection event
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          table,
          filter,
          timestamp: new Date().toISOString(),
        }),
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          });
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Keep connection open until client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat);
          resolve();
        });
      });
    } catch (err) {
      console.error("[Realtime SSE] Error:", err);
    } finally {
      // Cleanup
      if (unsubscribe) {
        await unsubscribe();
      }
      await subscriber.disconnect();
    }
  });
});

/**
 * Health check for realtime service
 */
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export { app as realtimeRouter };
