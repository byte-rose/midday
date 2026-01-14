import { createClient, type RedisClientType } from "redis";
import type { RealtimeEvent, RealtimeFilter, RealtimeRecord } from "./types";
import { buildChannelName } from "./types";

type EventCallback<T extends RealtimeRecord = RealtimeRecord> = (
  event: RealtimeEvent<T>
) => void;

/**
 * Subscriber class for SSE endpoint
 * Creates a dedicated Redis connection for pub/sub
 */
export class RealtimeSubscriber {
  private client: RedisClientType;
  private subscriptions: Map<string, EventCallback[]> = new Map();
  private connected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is required");
    }

    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    });

    this.client.on("error", (err) => {
      console.error("[Realtime Subscriber] Redis error:", err);
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.client.quit();
    this.connected = false;
    this.subscriptions.clear();
  }

  /**
   * Subscribe to a realtime channel
   */
  async subscribe<T extends RealtimeRecord = RealtimeRecord>(
    filter: RealtimeFilter,
    callback: EventCallback<T>
  ): Promise<() => Promise<void>> {
    await this.connect();

    const channel = buildChannelName(filter.table, filter.schema, filter.filter);

    // Add callback to subscriptions
    const callbacks = this.subscriptions.get(channel) || [];
    callbacks.push(callback as EventCallback);
    this.subscriptions.set(channel, callbacks);

    // Subscribe to Redis channel if this is the first callback
    if (callbacks.length === 1) {
      await this.client.subscribe(channel, (message) => {
        try {
          const event = JSON.parse(message) as RealtimeEvent<T>;

          // Filter by event type if specified
          if (filter.event && filter.event !== "*" && event.type !== filter.event) {
            return;
          }

          // Call all callbacks for this channel
          const cbs = this.subscriptions.get(channel) || [];
          for (const cb of cbs) {
            try {
              cb(event as RealtimeEvent);
            } catch (err) {
              console.error("[Realtime Subscriber] Callback error:", err);
            }
          }
        } catch (err) {
          console.error("[Realtime Subscriber] Parse error:", err);
        }
      });
    }

    // Return unsubscribe function
    return async () => {
      const cbs = this.subscriptions.get(channel) || [];
      const index = cbs.indexOf(callback as EventCallback);
      if (index > -1) {
        cbs.splice(index, 1);
      }

      if (cbs.length === 0) {
        this.subscriptions.delete(channel);
        await this.client.unsubscribe(channel);
      } else {
        this.subscriptions.set(channel, cbs);
      }
    };
  }

  /**
   * Subscribe to multiple channels (pattern-based)
   */
  async subscribePattern<T extends RealtimeRecord = RealtimeRecord>(
    pattern: string,
    callback: EventCallback<T>
  ): Promise<() => Promise<void>> {
    await this.connect();

    await this.client.pSubscribe(pattern, (message) => {
      try {
        const event = JSON.parse(message) as RealtimeEvent<T>;
        callback(event);
      } catch (err) {
        console.error("[Realtime Subscriber] Parse error:", err);
      }
    });

    return async () => {
      await this.client.pUnsubscribe(pattern);
    };
  }
}

/**
 * Create a new subscriber instance
 * Each SSE connection should use its own subscriber
 */
export function createRealtimeSubscriber(): RealtimeSubscriber {
  return new RealtimeSubscriber();
}
