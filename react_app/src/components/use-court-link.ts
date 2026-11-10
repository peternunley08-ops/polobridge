/**
 * PoloPad Pro — React bindings for the Court Link session.
 *
 * Kept deliberately thin: all link logic lives in the engine and is unit
 * tested there; these hooks only subscribe a component to it.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CourtAlert, CourtView } from '../engine/court-link';
import { CourtLinkStatus, courtLinkSession } from '../engine/court-link-session';

/** Config and transport state; re-renders only when one of them changes. */
export function useCourtLinkStatus(): CourtLinkStatus {
  return useSyncExternalStore(courtLinkSession.subscribe, courtLinkSession.getStatus, courtLinkSession.getStatus);
}

/**
 * Keeps the link running while the calling component is on screen and returns
 * the four court views, re-projected every `refreshMs` so the clocks tick.
 */
export function useLiveCourtViews(refreshMs = 100): { views: CourtView[]; nowMs: number } {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => courtLinkSession.watch(), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return { views: courtLinkSession.getCourtViews(nowMs), nowMs };
}

/** Recent alerts (newest first); `onAlert` fires once for each new one. */
export function useCourtAlerts(onAlert?: (alert: CourtAlert) => void): CourtAlert[] {
  const [alerts, setAlerts] = useState<CourtAlert[]>(() => courtLinkSession.getRecentAlerts());
  const callbackRef = useRef(onAlert);
  callbackRef.current = onAlert;

  useEffect(() => {
    setAlerts(courtLinkSession.getRecentAlerts());
    return courtLinkSession.onAlert((alert) => {
      setAlerts(courtLinkSession.getRecentAlerts());
      if (callbackRef.current) callbackRef.current(alert);
    });
  }, []);

  return alerts;
}
