"use client";

import { createClient } from "@midday/supabase/client";
import { isAuthBypassEnabled } from "@midday/supabase/client";
import type { Database } from "@midday/supabase/types";
import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRealtimeRedis } from "./use-realtime-redis";

type PublicSchema = Database[Extract<keyof Database, "public">];
type Tables = PublicSchema["Tables"];
type TableName = keyof Tables;

interface UseRealtimeProps<TN extends TableName> {
  channelName: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  table: TN;
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => void;
}

/**
 * useRealtime - Unified realtime hook that uses:
 * - Redis SSE when auth bypass is enabled (self-hosted/local dev)
 * - Supabase Realtime when using hosted Supabase
 */
export function useRealtime<TN extends TableName>({
  channelName,
  event = "*",
  table,
  filter,
  onEvent,
}: UseRealtimeProps<TN>) {
  const useBypass = isAuthBypassEnabled();

  // Cast table to the type expected by useRealtimeRedis
  type RedisTableName =
    | "activities"
    | "inbox"
    | "vault"
    | "transactions"
    | "documents"
    | "tracker_entries"
    | "tracker_projects";

  // Use Redis SSE in bypass mode
  useRealtimeRedis({
    table: table as RedisTableName,
    filter,
    event,
    enabled: useBypass && filter !== undefined,
    onEvent: useCallback((payload) => {
      // Adapt Redis payload to Supabase-compatible format
      onEvent({
        eventType: payload.eventType,
        new: payload.new as Tables[TN]["Row"],
        old: (payload.old || {}) as Partial<Tables[TN]["Row"]>,
        schema: "public",
        table: table as string,
        commit_timestamp: new Date().toISOString(),
        errors: null,
      } as RealtimePostgresChangesPayload<Tables[TN]["Row"]>);
    }, [onEvent, table]),
  });

  // Use Supabase Realtime when not in bypass mode
  const supabase: SupabaseClient = createClient();
  const onEventRef = useRef(onEvent);
  const [isReady, setIsReady] = useState(false);

  // Update the ref when onEvent changes
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Add a small delay to prevent rapid subscription creation/destruction
  useEffect(() => {
    if (useBypass) {
      return; // Skip Supabase setup in bypass mode
    }

    if (filter === undefined) {
      setIsReady(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); // Small delay to prevent race conditions

    return () => {
      clearTimeout(timer);
      setIsReady(false);
    };
  }, [filter, useBypass]);

  useEffect(() => {
    // Skip Supabase subscription in bypass mode
    if (useBypass) {
      return;
    }

    // Don't set up subscription if not ready or filter is undefined
    if (!isReady || filter === undefined) {
      return;
    }

    const filterConfig: RealtimePostgresChangesFilter<"*"> = {
      event: event as RealtimePostgresChangesFilter<"*">["event"],
      schema: "public",
      table,
      filter,
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        filterConfig,
        (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => {
          onEventRef.current(payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Note: supabase is intentionally not included in dependencies to avoid
    // dependency array size changes between renders
  }, [channelName, event, table, filter, isReady, useBypass]);
}
