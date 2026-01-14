"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type TableName =
  | "activities"
  | "inbox"
  | "vault"
  | "transactions"
  | "documents"
  | "tracker_entries"
  | "tracker_projects";

type EventType = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimeEvent<T = unknown> {
  type: EventType;
  table: TableName;
  schema: string;
  record: T;
  old_record?: Partial<T>;
  timestamp: string;
}

interface RealtimePayload<T = unknown> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T> | null;
}

interface UseRealtimeRedisProps<T = unknown> {
  table: TableName;
  filter?: string;
  event?: EventType;
  onEvent: (payload: RealtimePayload<T>) => void;
  enabled?: boolean;
}

/**
 * useRealtimeRedis - SSE-based realtime updates via Redis pub/sub
 * Replacement for Supabase Realtime postgres_changes in local/self-hosted mode
 */
export function useRealtimeRedis<T = unknown>({
  table,
  filter,
  event = "*",
  onEvent,
  enabled = true,
}: UseRealtimeRedisProps<T>) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Keep callback ref updated
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!enabled || !filter) {
      return;
    }

    // Build SSE URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";
    const params = new URLSearchParams({
      table,
      filter,
      ...(event !== "*" && { event }),
    });
    const url = `${apiUrl}/realtime/subscribe?${params.toString()}`;

    setStatus("connecting");

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      setStatus("connected");
      reconnectAttemptsRef.current = 0;
    });

    eventSource.addEventListener("insert", (e) => {
      try {
        const data = JSON.parse(e.data) as RealtimeEvent<T>;
        onEventRef.current({
          eventType: "INSERT",
          new: data.record,
          old: null,
        });
      } catch (err) {
        console.error("[useRealtimeRedis] Parse error:", err);
      }
    });

    eventSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data) as RealtimeEvent<T>;
        onEventRef.current({
          eventType: "UPDATE",
          new: data.record,
          old: data.old_record || null,
        });
      } catch (err) {
        console.error("[useRealtimeRedis] Parse error:", err);
      }
    });

    eventSource.addEventListener("delete", (e) => {
      try {
        const data = JSON.parse(e.data) as RealtimeEvent<T>;
        onEventRef.current({
          eventType: "DELETE",
          new: data.record,
          old: data.old_record || null,
        });
      } catch (err) {
        console.error("[useRealtimeRedis] Parse error:", err);
      }
    });

    eventSource.onerror = () => {
      setStatus("error");
      eventSource.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [enabled, filter, table, event]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { status };
}
