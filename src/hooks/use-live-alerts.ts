"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { LiveAlert } from "@/lib/assessment-types";

export function useLiveAlerts(
  initialAlerts: LiveAlert[],
  options?: {
    enabled?: boolean;
    onNewAlert?: (alert: LiveAlert) => void;
  },
) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const seenIdsRef = useRef(new Set(initialAlerts.map((alert) => alert.event_id)));
  const handleNewAlert = useEffectEvent((alert: LiveAlert) => {
    options?.onNewAlert?.(alert);
  });

  useEffect(() => {
    if (options?.enabled === false) {
      return;
    }

    let isActive = true;

    async function loadAlerts() {
      try {
        const response = await fetch("/alerts/events?limit=20", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !isActive) {
          return;
        }

        const fetchedAlerts = (result.alerts ?? []) as LiveAlert[];
        const freshAlerts = fetchedAlerts
          .filter((alert) => !seenIdsRef.current.has(alert.event_id))
          .reverse();

        if (freshAlerts.length === 0) {
          return;
        }

        freshAlerts.forEach((alert) => {
          seenIdsRef.current.add(alert.event_id);
          handleNewAlert(alert);
        });

        setAlerts((current) => [...freshAlerts.reverse(), ...current].slice(0, 20));
      } catch {
        // Ignore polling failures and try again on the next interval.
      }
    }

    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [options?.enabled]);

  return alerts;
}
