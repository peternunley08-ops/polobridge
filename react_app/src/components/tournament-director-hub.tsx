import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Bluetooth,
  Check,
  Copy,
  LayoutGrid,
  Link2,
  Maximize2,
  Minimize2,
  Play,
  Printer,
  Radio,
  Settings,
  Square,
  Timer,
  Trophy,
  Volume2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  COURT_IDS,
  CourtAlert,
  CourtId,
  CourtView,
  DEFAULT_LOCAL_ROOM,
  formatGameClock,
  formatShotClock,
  periodLabel,
} from '../engine/court-link';
import { courtLinkSession } from '../engine/court-link-session';
import { phoneHaptics } from '../engine/phone-haptics';
import { useCourtAlerts, useCourtLinkStatus, useLiveCourtViews } from './use-court-link';

/**
 * Tournament Director Hub — four pool courses on one screen.
 *
 * Read-only by design: this screen watches the desks, it never controls a
 * clock. Each tile shows a court's score, period, game clock and shot clock,
 * projected between heartbeats so they tick at a tenth of a second, plus the
 * health of the link to that desk.
 */

export interface TournamentDirectorHubProps {
  /** Tactile click from the console's shared audio engine. */
  onPlayClick: () => void;
  /** Attention chime: a soft tone for match events, a sharper one for faults. */
  onPlayAlert: (severity: 'info' | 'warn') => void;
  /** Jump to this device's own scoring console. */
  onOpenConsole: () => void;
  /** True while the app masthead is hidden so the four courts fill the screen. */
  isFullScreen: boolean;
  onSetFullScreen: (enabled: boolean) => void;
}

const ALERTS_PREFERENCE_KEY = 'polopad_pro_director_alerts_v1';

function readAlertsPreference(): boolean {
  try {
    return window.localStorage.getItem(ALERTS_PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function formatAge(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

function formatAlertTime(atMs: number): string {
  const date = new Date(atMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds()
  ).padStart(2, '0')}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

function inviteBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-900';

// ---------------------------------------------------------------------------
// Court tile
// ---------------------------------------------------------------------------

interface HealthBadge {
  label: string;
  className: string;
  dotClassName: string;
}

function healthBadge(view: CourtView): HealthBadge {
  switch (view.health) {
    case 'live':
      return {
        label: 'LIVE',
        className: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/60',
        dotClassName: 'bg-emerald-300 animate-pulse',
      };
    case 'lagging':
      return {
        label: `LAGGING ${formatAge(view.silenceMs)}`,
        className: 'bg-amber-400/25 text-amber-100 border-amber-300/70',
        dotClassName: 'bg-amber-300 animate-pulse',
      };
    case 'stale':
      return {
        label: `LINK LOST ${formatAge(view.silenceMs)}`,
        className: 'bg-rose-500/30 text-rose-100 border-rose-300/70',
        dotClassName: 'bg-rose-300',
      };
    case 'signed-off':
      return {
        label: 'DESK SIGNED OFF',
        className: 'bg-sky-400/20 text-sky-100 border-sky-300/50',
        dotClassName: 'bg-sky-300',
      };
    default:
      return {
        label: 'WAITING FOR DESK',
        className: 'bg-sky-950/70 text-cyan-200 border-cyan-400/30',
        dotClassName: 'bg-cyan-300/60',
      };
  }
}

function tileFrameClass(view: CourtView): string {
  if (view.health === 'empty') return 'border-dashed border-cyan-400/35';
  if (view.health === 'stale') return 'border-rose-400/70';
  if (view.health === 'lagging') return 'border-amber-400/70';
  if (view.health === 'signed-off') return 'border-sky-400/40';
  return view.projection && view.projection.isRunning
    ? 'border-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.28)]'
    : 'border-cyan-400/50 shadow-[0_18px_50px_rgba(6,182,212,0.2)]';
}

interface CourtTileProps {
  view: CourtView;
  /** 'fit' stretches the tile to share the screen and scales the digits up. */
  density: 'regular' | 'fit';
  isDemo: boolean;
  isOwnCourt: boolean;
  canClaim: boolean;
  isInviteCopied: boolean;
  onCopyInvite: (courtId: CourtId) => void;
  onClaim: (courtId: CourtId) => void;
  onClear: (courtId: CourtId) => void;
}

function CourtTile({
  view,
  density,
  isDemo,
  isOwnCourt,
  canClaim,
  isInviteCopied,
  onCopyInvite,
  onClaim,
  onClear,
}: CourtTileProps) {
  const badge = healthBadge(view);
  const { snapshot, projection } = view;
  const isFit = density === 'fit';
  // In fit mode the digits scale with the screen height, up to wall-display size.
  const digitClass = isFit
    ? 'text-3xl md:text-[clamp(2.25rem,5.6vh,5.5rem)]'
    : 'text-3xl sm:text-4xl';
  const shotDigitClass = isFit ? 'text-2xl md:text-[clamp(1.875rem,4.6vh,4.5rem)]' : 'text-2xl sm:text-3xl';
  // Secondary detail gives way first when four tiles share a short screen.
  const detailClass = isFit ? 'hidden md:[@media(min-height:640px)]:block' : '';
  const chipRowClass = isFit ? 'hidden md:flex' : 'flex';

  if (!snapshot || !projection) {
    return (
      <section
        aria-label={`Court ${view.courtId} — waiting for a scoring desk`}
        data-testid={`court-tile-${view.courtId}`}
        data-health={view.health}
        className={`relative overflow-hidden rounded-3xl border-2 bg-gradient-to-b from-sky-800/60 via-blue-900/70 to-indigo-950/80 flex flex-col justify-between ${
          isFit ? 'p-3 gap-2 min-h-0' : 'p-4 sm:p-5 gap-4 min-h-[200px]'
        } ${tileFrameClass(view)}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -bottom-10 text-[150px] leading-none font-black font-mono text-cyan-300/10 select-none"
        >
          {view.courtId}
        </span>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-black tracking-tight text-white">COURT {view.courtId}</h3>
          <span className={`px-2.5 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 ${badge.className}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dotClassName}`} />
            {badge.label}
          </span>
        </div>
        <p className={`text-sm text-cyan-100/90 max-w-sm ${isFit ? 'hidden md:block' : ''}`}>
          No scoring desk has joined this court yet. Send the desk volunteer the invite link, or score this court on
          this device.
        </p>
        <div className="relative flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCopyInvite(view.courtId)}
            className={`px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-cyan-400 to-sky-500 text-sky-950 font-mono font-black text-xs flex items-center gap-1.5 shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition cursor-pointer ${FOCUS_RING}`}
          >
            {isInviteCopied ? <Check size={14} /> : <Copy size={14} />}
            <span>{isInviteCopied ? 'INVITE LINK COPIED' : `COPY COURT ${view.courtId} INVITE LINK`}</span>
          </button>
          {canClaim && (
            <button
              type="button"
              onClick={() => onClaim(view.courtId)}
              className={`px-3.5 py-2.5 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-cyan-400/40 text-cyan-100 font-mono font-bold text-xs transition cursor-pointer ${FOCUS_RING}`}
            >
              Score Court {view.courtId} on this device
            </button>
          )}
        </div>
      </section>
    );
  }

  const isLastKnown = view.health === 'stale' || view.health === 'signed-off';
  const periodOver = projection.gameTimeMs <= 0;
  const shotSeconds = Math.floor(projection.shotTimeMs / 1000);
  const shotUrgent = !projection.isShotBlanked && shotSeconds <= 5;
  const lastEvent = view.events.length > 0 ? view.events[0] : null;
  const playedPeriods = snapshot.quarterScores.white
    .map((white, index) => ({ index, white, dark: snapshot.quarterScores.dark[index] }))
    .filter((entry) => entry.index < Math.min(snapshot.period, 6));

  let playState: { label: string; className: string };
  if (isLastKnown) {
    playState = { label: 'LAST KNOWN', className: 'bg-sky-950/80 text-sky-100 border-sky-300/40' };
  } else if (periodOver) {
    playState = {
      label: `END OF ${periodLabel(snapshot.period)}`,
      className: 'bg-amber-400/25 text-amber-100 border-amber-300/60',
    };
  } else if (projection.activeTimeout) {
    playState = { label: 'TIMEOUT', className: 'bg-amber-400/25 text-amber-100 border-amber-300/60' };
  } else if (projection.isRunning) {
    playState = { label: 'IN PLAY', className: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/60' };
  } else {
    playState = { label: 'WHISTLE', className: 'bg-rose-500/25 text-rose-100 border-rose-300/60' };
  }

  return (
    <section
      aria-label={`Court ${view.courtId} — ${snapshot.teamWhiteName} ${snapshot.scoreWhite}, ${snapshot.teamDarkName} ${snapshot.scoreDark}, ${badge.label}`}
      data-testid={`court-tile-${view.courtId}`}
      data-health={view.health}
      className={`relative rounded-3xl border-2 bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 flex flex-col backdrop-blur-xl ${
        isFit ? 'p-2.5 sm:p-3 gap-2 min-h-0' : 'p-3 sm:p-3.5 gap-2.5'
      } ${tileFrameClass(view)}`}
    >
      {/* Header: court, desk, period and link health */}
      <div className={`flex items-center justify-between gap-2 ${isFit ? '' : 'flex-wrap'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-300 to-amber-300 text-sky-950 font-black font-mono text-lg flex items-center justify-center shadow-lg shadow-cyan-400/25">
            {view.courtId}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-tight text-white leading-tight">COURT {view.courtId}</h3>
            <p
              className={`text-xs text-cyan-200/90 truncate ${isFit ? 'hidden md:block' : ''}`}
              title={view.deskLabel ?? undefined}
            >
              {view.deskLabel}
              {isOwnCourt ? ' · this device' : ''}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 justify-end ${isFit ? 'shrink-0' : 'flex-wrap'}`}>
          {isDemo && (
            <span className="px-2 py-1 rounded-lg bg-amber-400 text-sky-950 text-xs font-mono font-black" title="Simulated court">
              DEMO
            </span>
          )}
          {/* When the chip row is hidden (four tiles on a phone) keep the counts visible. */}
          {isFit && projection.exclusions.length > 0 && (
            <span className="md:hidden px-2 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-white text-xs font-mono font-black">
              {projection.exclusions.length} EXCL
            </span>
          )}
          {isFit && projection.activeTimeout && (
            <span className="md:hidden px-2 py-1 rounded-lg bg-amber-400/25 border border-amber-300/60 text-amber-50 text-xs font-mono font-black">
              T/O {Math.ceil(projection.activeTimeout.remainingMs / 1000)}s
            </span>
          )}
          <span
            data-testid={`court-period-${view.courtId}`}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-sky-950 text-xs font-mono font-black"
          >
            {periodLabel(snapshot.period)}
          </span>
          <span
            data-testid={`court-health-${view.courtId}`}
            className={`px-2.5 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 ${badge.className}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dotClassName}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Fault ribbons */}
      {view.conflict && (
        <div
          role="alert"
          className="px-3 py-2 rounded-xl bg-amber-400/25 border border-amber-300/70 text-amber-50 text-xs font-mono font-bold flex items-start gap-2"
        >
          <AlertTriangle size={15} className="text-amber-200 shrink-0 mt-0.5" />
          <span>
            {view.conflict.rivalLabels.length + 1} devices are publishing this court. Showing {view.deskLabel}; also
            heard: {view.conflict.rivalLabels.join(', ')}.
          </span>
        </div>
      )}
      {isLastKnown && (
        <div className="px-3 py-2 rounded-xl bg-sky-950/85 border border-rose-300/50 text-rose-50 text-xs font-mono flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <WifiOff size={15} className="text-rose-200 shrink-0" />
            <span>
              {view.health === 'stale'
                ? `No signal from this desk for ${formatAge(view.silenceMs)}. Showing the last confirmed values.`
                : 'This desk closed its scoring page. Showing its final values.'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onClear(view.courtId)}
            className={`shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer ${FOCUS_RING}`}
          >
            Clear
          </button>
        </div>
      )}

      {/* Scorebug: teams and scores on the left, recessed clocks on the right */}
      <div className={`grid grid-cols-[1fr_auto] gap-2.5 items-stretch ${isFit ? 'flex-1 min-h-0' : ''} ${isLastKnown ? 'opacity-75' : ''}`}>
        <div className="flex flex-col justify-center gap-1.5 min-w-0">
          <div className={`flex items-center justify-between gap-2 rounded-2xl bg-white/15 border border-white/30 px-3 py-1 ${isFit ? 'flex-1' : ''}`}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 shrink-0 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
              <span className="text-sm font-black text-white truncate">{snapshot.teamWhiteName}</span>
            </span>
            <span
              data-testid={`court-score-white-${view.courtId}`}
              className={`${digitClass} font-black font-mono tabular-nums text-white drop-shadow leading-none`}
            >
              {snapshot.scoreWhite}
            </span>
          </div>
          <div className={`flex items-center justify-between gap-2 rounded-2xl bg-blue-800/50 border border-cyan-400/40 px-3 py-1 ${isFit ? 'flex-1' : ''}`}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              <span className="text-sm font-black text-cyan-100 truncate">{snapshot.teamDarkName}</span>
            </span>
            <span
              data-testid={`court-score-dark-${view.courtId}`}
              className={`${digitClass} font-black font-mono tabular-nums text-cyan-300 drop-shadow leading-none`}
            >
              {snapshot.scoreDark}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-sky-950/85 border border-cyan-400/30 shadow-[inset_0_4px_18px_rgba(6,182,212,0.18)] px-3 py-1.5 flex flex-col items-end justify-between gap-1 min-w-[150px] sm:min-w-[190px]">
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-cyan-200">GAME</span>
            <span
              data-testid={`court-play-state-${view.courtId}`}
              className={`px-2 py-0.5 rounded-full border text-xs font-mono font-black ${playState.className}`}
            >
              {playState.label}
            </span>
          </div>
          <div
            data-testid={`court-game-clock-${view.courtId}`}
            className={`${digitClass} font-black font-mono tabular-nums text-amber-300 leading-none drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]`}
          >
            {formatGameClock(projection.gameTimeMs)}
          </div>
          <div className="w-full flex items-end justify-between gap-2 border-t border-cyan-400/20 pt-1">
            <span className="text-xs font-mono font-bold text-rose-200">
              SHOT{projection.isShotBlanked ? ' · WP 20.15' : ''}
            </span>
            <span
              data-testid={`court-shot-clock-${view.courtId}`}
              className={`${shotDigitClass} font-black font-mono tabular-nums leading-none ${
                projection.isShotBlanked
                  ? 'text-sky-300/60'
                  : shotUrgent
                  ? 'text-rose-400 animate-pulse drop-shadow-[0_0_18px_rgba(244,63,94,0.8)]'
                  : 'text-rose-400'
              }`}
            >
              {formatShotClock(projection.shotTimeMs, projection.isShotBlanked)}
            </span>
          </div>
        </div>
      </div>

      {/* Live situation chips. The row is always reserved so tiles never jump. */}
      {
        <div className={`${chipRowClass} flex-wrap items-center gap-1.5 min-h-[26px]`}>
          {projection.exclusions.length === 0 &&
            !projection.activeTimeout &&
            !snapshot.hornActive &&
            snapshot.cappedOut.white.length + snapshot.cappedOut.dark.length === 0 && (
              <span className="text-xs font-mono text-sky-200/70">Full strength · no timeout</span>
            )}
          {projection.activeTimeout && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-400/25 border border-amber-300/60 text-amber-50 text-xs font-mono font-bold flex items-center gap-1.5">
              <Timer size={13} />
              {projection.activeTimeout.type} TIMEOUT ·{' '}
              {projection.activeTimeout.team === 'white' ? snapshot.teamWhiteName : snapshot.teamDarkName} ·{' '}
              {Math.ceil(projection.activeTimeout.remainingMs / 1000)}s
            </span>
          )}
          {projection.exclusions.map((exclusion) => (
            <span
              key={exclusion.id}
              className="px-2.5 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-white text-xs font-mono font-bold flex items-center gap-1.5"
              title="20-second exclusion"
            >
              <Zap size={13} className="text-amber-200" />
              {exclusion.team === 'white' ? 'W' : 'D'}#{exclusion.cap}
              <span className="text-amber-200">{Math.ceil(exclusion.remainingMs / 1000)}s</span>
            </span>
          ))}
          {(['white', 'dark'] as const).flatMap((team) =>
            snapshot.cappedOut[team].map((cap) => (
              <span
                key={`${team}-${cap}`}
                className="px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-400/60 text-rose-100 text-xs font-mono font-bold"
                title="Rule WP 22.3: three personal fouls"
              >
                CAP-OUT {team === 'white' ? 'W' : 'D'}#{cap}
              </span>
            ))
          )}
          {snapshot.hornActive && !isLastKnown && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-500 border border-amber-300 text-white text-xs font-mono font-black flex items-center gap-1.5 animate-pulse">
              <Volume2 size={13} />
              HORN
            </span>
          )}
        </div>
      }

      {/* Period scores, desk hardware and the last play */}
      <div className={`${detailClass} space-y-1 border-t border-cyan-400/20 pt-1.5 ${isFit ? '' : 'mt-auto'}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-mono text-cyan-100/90">
            {playedPeriods.map((entry) => (
              <span key={entry.index}>
                <span className="text-cyan-300/80">{periodLabel(entry.index + 1)}</span> {entry.white}–{entry.dark}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono font-bold">
            <span
              className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                snapshot.hardwareLink === 'connected'
                  ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/40'
                  : snapshot.hardwareLink === 'reconnecting'
                  ? 'bg-amber-400/20 text-amber-100 border-amber-300/60'
                  : 'bg-sky-950/70 text-sky-200 border-cyan-400/25'
              }`}
              title="Bluetooth link between this desk and its PoloBridge dongle"
            >
              <Bluetooth size={12} />
              {snapshot.hardwareLink === 'connected'
                ? 'DONGLE LIVE'
                : snapshot.hardwareLink === 'reconnecting'
                ? 'DONGLE RECONNECTING'
                : 'NO DONGLE'}
            </span>
            <span className="px-2 py-0.5 rounded-md border bg-sky-950/70 text-cyan-200 border-cyan-400/25">
              {snapshot.scoreboardProtocol === 'cts' ? 'CTS 9600' : 'DAKT 4498'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md border ${
                snapshot.ruleset === 'nfhs'
                  ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/40'
                  : 'bg-amber-400/15 text-amber-200 border-amber-300/40'
              }`}
              title={
                snapshot.ruleset === 'nfhs'
                  ? 'NFHS high school: every shot-clock reset is 30 seconds'
                  : 'NCAA / World Aquatics: 20-second reset on rebound and exclusion'
              }
            >
              {snapshot.ruleset === 'nfhs' ? 'NFHS 30s' : 'NCAA/WA 20s·30s'}
            </span>
          </div>
        </div>
        <p className="text-xs text-sky-100/90 truncate" title={lastEvent ? lastEvent.text : undefined}>
          {lastEvent ? (
            <>
              <span className="font-mono font-bold text-amber-200">
                {periodLabel(lastEvent.period)} {lastEvent.clock}
              </span>{' '}
              {lastEvent.text}
            </>
          ) : (
            <span className="text-sky-200/70">No plays logged yet.</span>
          )}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Printable summary (landscape)
// ---------------------------------------------------------------------------

function PrintSummary({ views, room, isDemoMode }: { views: CourtView[]; room: string; isDemoMode: boolean }) {
  const printedAt = new Date();
  return (
    <div className="hidden print:block bg-white text-sky-950 p-2 font-sans">
      <style>{'@media print { @page { size: landscape; margin: 12mm; } }'}</style>
      <h1 className="text-xl font-black">PoloPad Pro — Tournament Court Summary</h1>
      <p className="text-xs mt-1">
        Room {room} · printed {printedAt.toLocaleString()}
        {isDemoMode ? ' · DEMONSTRATION DATA — NOT A REAL MATCH' : ''}
      </p>
      <table className="w-full mt-4 border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-sky-950 text-left">
            <th className="py-1.5 pr-2">Court</th>
            <th className="py-1.5 pr-2">White</th>
            <th className="py-1.5 pr-2">Score</th>
            <th className="py-1.5 pr-2">Dark</th>
            <th className="py-1.5 pr-2">Period</th>
            <th className="py-1.5 pr-2">Game clock</th>
            <th className="py-1.5 pr-2">By period (W–D)</th>
            <th className="py-1.5 pr-2">Desk</th>
            <th className="py-1.5">Link</th>
          </tr>
        </thead>
        <tbody>
          {views.map((view) => {
            const snapshot = view.snapshot;
            const projection = view.projection;
            return (
              <tr key={view.courtId} className="border-b border-sky-900/40 align-top">
                <td className="py-1.5 pr-2 font-black">{view.courtId}</td>
                <td className="py-1.5 pr-2">{snapshot ? snapshot.teamWhiteName : '—'}</td>
                <td className="py-1.5 pr-2 font-mono font-black">
                  {snapshot ? `${snapshot.scoreWhite} – ${snapshot.scoreDark}` : '—'}
                </td>
                <td className="py-1.5 pr-2">{snapshot ? snapshot.teamDarkName : '—'}</td>
                <td className="py-1.5 pr-2">{snapshot ? periodLabel(snapshot.period) : '—'}</td>
                <td className="py-1.5 pr-2 font-mono">{projection ? formatGameClock(projection.gameTimeMs) : '—'}</td>
                <td className="py-1.5 pr-2 font-mono">
                  {snapshot
                    ? snapshot.quarterScores.white
                        .slice(0, Math.min(snapshot.period, 6))
                        .map((white, index) => `${periodLabel(index + 1)} ${white}–${snapshot.quarterScores.dark[index]}`)
                        .join('  ')
                    : '—'}
                </td>
                <td className="py-1.5 pr-2">{view.deskLabel ?? '—'}</td>
                <td className="py-1.5">{healthBadge(view).label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-10 mt-12 text-xs">
        <div className="border-t border-sky-950 pt-1">Tournament Director Signature</div>
        <div className="border-t border-sky-950 pt-1">Date / Time</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function TournamentDirectorHub({
  onPlayClick,
  onPlayAlert,
  onOpenConsole,
  isFullScreen,
  onSetFullScreen,
}: TournamentDirectorHubProps) {
  const status = useCourtLinkStatus();
  const { views, nowMs } = useLiveCourtViews(100);
  const { config } = status;

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(readAlertsPreference);
  const alertsEnabledRef = useRef(alertsEnabled);
  alertsEnabledRef.current = alertsEnabled;

  const handleAlert = useCallback(
    (alert: CourtAlert) => {
      if (!alertsEnabledRef.current) return;
      onPlayAlert(alert.severity);
      phoneHaptics.trigger(alert.severity === 'warn' ? 'warning' : 'tap');
    },
    [onPlayAlert]
  );
  const alerts = useCourtAlerts(handleAlert);

  const heardCourts = views.filter((view) => view.health !== 'empty').length;
  const liveCourts = views.filter((view) => view.health === 'live' || view.health === 'lagging').length;

  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(() => courtLinkSession.getCourtViews().every((view) => view.health === 'empty'));
  const [roomDraft, setRoomDraft] = useState<string>(config.room);
  const [relayDraft, setRelayDraft] = useState<string>(config.relayUrl);
  const [labelDraft, setLabelDraft] = useState<string>(config.deskLabel);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  // Keep the form in step with changes made elsewhere (an invite link, a new room).
  useEffect(() => setRoomDraft(config.room), [config.room]);
  useEffect(() => setRelayDraft(config.relayUrl), [config.relayUrl]);
  useEffect(() => setLabelDraft(config.deskLabel), [config.deskLabel]);
  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    []
  );

  const diagnostics = courtLinkSession.getDiagnostics();
  const ownView = config.deskCourtId ? views[COURT_IDS.indexOf(config.deskCourtId)] : null;
  const relayHost = config.relayUrl ? config.relayUrl.replace(/^wss?:\/\//, '') : '';

  const flashCopied = (key: string) => {
    setCopiedKey(key);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleCopyInvite = async (courtId: CourtId | null) => {
    onPlayClick();
    const link = courtLinkSession.buildInviteLink(inviteBaseUrl(), courtId);
    const copied = await copyToClipboard(link);
    if (copied) {
      flashCopied(courtId ?? 'dashboard');
      setFormError(null);
    } else {
      setFormError(`Could not copy automatically. Invite link: ${link}`);
    }
  };

  const applyConfig = (patch: Parameters<typeof courtLinkSession.updateConfig>[0]): boolean => {
    const result = courtLinkSession.updateConfig(patch);
    setFormError(result.ok ? null : result.error);
    return result.ok;
  };

  const handleSelectDeskCourt = (courtId: CourtId | null) => {
    onPlayClick();
    applyConfig({ deskCourtId: courtId });
  };

  const handleClaimCourt = (courtId: CourtId) => {
    onPlayClick();
    if (applyConfig({ deskCourtId: courtId })) onOpenConsole();
  };

  const handleToggleAlerts = () => {
    onPlayClick();
    setAlertsEnabled((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(ALERTS_PREFERENCE_KEY, next ? 'on' : 'off');
      } catch {
        // The preference simply lasts for this page load.
      }
      if (next) phoneHaptics.trigger('tap');
      return next;
    });
  };

  // ---- Full-screen mode: hide the app masthead so four courts fill the screen.
  // The browser Fullscreen API is used when it is available; without it (an
  // installed iPad app, for instance) hiding the masthead is already enough.
  const usedBrowserFullScreen = useRef(false);
  const setFullScreenRef = useRef(onSetFullScreen);
  setFullScreenRef.current = onSetFullScreen;

  const leaveBrowserFullScreen = () => {
    if (usedBrowserFullScreen.current && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    }
    usedBrowserFullScreen.current = false;
  };

  const exitFullScreen = useCallback(() => {
    leaveBrowserFullScreen();
    setFullScreenRef.current(false);
  }, []);

  const enterFullScreen = useCallback(() => {
    setFullScreenRef.current(true);
    const root = document.documentElement;
    if (typeof root.requestFullscreen === 'function') {
      root
        .requestFullscreen()
        .then(() => {
          usedBrowserFullScreen.current = true;
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!isFullScreen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFullScreen();
    };
    const handleFullScreenChange = () => {
      // The browser left full screen by itself (Esc or a system gesture): follow it.
      if (usedBrowserFullScreen.current && !document.fullscreenElement) exitFullScreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, [isFullScreen, exitFullScreen]);

  // Leaving the dashboard always gives the masthead back.
  useEffect(
    () => () => {
      leaveBrowserFullScreen();
      setFullScreenRef.current(false);
    },
    []
  );

  const relayPill = (() => {
    if (!config.relayUrl) {
      return { label: 'RELAY OFF', className: 'bg-sky-950/80 text-sky-100 border-cyan-400/30', icon: WifiOff };
    }
    if (status.relayStatus === 'open') {
      return {
        label: `RELAY LIVE${diagnostics.relayRttMs !== null ? ` · ${diagnostics.relayRttMs} ms` : ''}`,
        className: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/60',
        icon: Wifi,
      };
    }
    if (status.relayStatus === 'unsupported') {
      return { label: 'RELAY UNSUPPORTED', className: 'bg-rose-500/30 text-rose-100 border-rose-300/70', icon: WifiOff };
    }
    return {
      label: status.relayStatus === 'reconnecting' ? `RELAY RECONNECTING · TRY ${diagnostics.relayReconnectAttempt}` : 'RELAY CONNECTING',
      className: 'bg-amber-400/25 text-amber-100 border-amber-300/70 animate-pulse',
      icon: Wifi,
    };
  })();
  const RelayIcon = relayPill.icon;

  const toolbarButton = `px-2.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${FOCUS_RING}`;
  const relayTitle =
    status.relayDetail ??
    (relayHost ? `Relay ${relayHost}` : 'No relay configured: only desks open in this same browser are visible');

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-900 to-indigo-950 print:bg-none print:bg-white">
      <PrintSummary views={views} room={status.isDemoMode ? 'DEMO' : config.room} isDemoMode={status.isDemoMode} />

      <div
        className={`max-w-[1700px] mx-auto print:hidden ${
          isFullScreen ? 'p-2 sm:p-3 space-y-2 sm:space-y-3' : 'p-3 sm:p-4 space-y-3'
        }`}
      >
        {/* ================================================================= */}
        {/* TOOLBAR (one compact row: labels collapse to icons below xl)      */}
        {/* ================================================================= */}
        <div
          className={`rounded-3xl bg-gradient-to-r from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 px-3 py-2 shadow-2xl flex items-center justify-between gap-2 ${
            isFullScreen ? 'min-h-[3.5rem]' : 'flex-wrap lg:flex-nowrap'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-300 via-teal-400 to-cyan-400 items-center justify-center text-sky-950 shadow-lg ${
                isFullScreen ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <LayoutGrid size={22} />
            </div>
            <div className="min-w-0">
              <h2
                className={`text-sm sm:text-base font-black text-white tracking-tight leading-tight truncate ${
                  isFullScreen ? 'hidden lg:block' : ''
                }`}
              >
                Tournament Director — 4-Court Live Dashboard
              </h2>
              <p className="text-xs text-cyan-200/90 font-mono truncate" data-testid="director-summary">
                {status.isDemoMode && (
                  <span
                    data-testid="demo-ribbon"
                    className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-sky-950 font-black"
                    title="Four simulated courts. None of this is a real match, and nothing is sent to other devices."
                  >
                    DEMO DATA
                  </span>
                )}
                {status.isDemoMode ? 'simulated courts' : `ROOM ${config.room}`} · {liveCourts} of 4 courts live
                {heardCourts > liveCourts ? ` · ${heardCourts - liveCourts} offline` : ''}
                {status.isDemoMode ? ' · nothing is sent to other devices' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              data-testid="relay-status"
              role="status"
              aria-label={relayPill.label}
              className={`px-2.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${relayPill.className}`}
              title={`${relayPill.label}. ${relayTitle}`}
            >
              <RelayIcon size={14} />
              <span className="hidden xl:inline">{relayPill.label}</span>
            </span>

            <button
              type="button"
              onClick={handleToggleAlerts}
              aria-pressed={alertsEnabled}
              aria-label={alertsEnabled ? 'Alerts on' : 'Alerts off'}
              className={`${toolbarButton} ${
                alertsEnabled
                  ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/50'
                  : 'bg-sky-950/80 text-sky-200 border-cyan-400/30'
              }`}
              title="Chime and vibrate on goals, period ends, cap-outs and lost links"
            >
              {alertsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              <span className="hidden xl:inline">{alertsEnabled ? 'ALERTS ON' : 'ALERTS OFF'}</span>
            </button>

            <button
              type="button"
              data-testid="demo-toggle"
              onClick={() => {
                onPlayClick();
                courtLinkSession.setDemoMode(!status.isDemoMode);
              }}
              aria-pressed={status.isDemoMode}
              aria-label={status.isDemoMode ? 'Stop the four-court demo' : 'Run the four-court demo'}
              title="Four simulated courts, shown on this screen only"
              className={`${toolbarButton} font-black ${
                status.isDemoMode
                  ? 'bg-amber-400 text-sky-950 border-amber-200 shadow-md shadow-amber-400/30'
                  : 'bg-sky-950/80 text-amber-200 border-amber-300/40 hover:bg-amber-400/20'
              }`}
            >
              {status.isDemoMode ? <Square size={13} /> : <Play size={13} />}
              <span className="hidden sm:inline">{status.isDemoMode ? 'STOP DEMO' : 'DEMO'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onPlayClick();
                window.print();
              }}
              aria-label="Print a landscape court summary"
              className={`${toolbarButton} bg-sky-950/80 hover:bg-sky-900 border-cyan-400/40 text-cyan-100`}
              title="Print a landscape court summary"
            >
              <Printer size={14} />
              <span className="hidden xl:inline">PRINT</span>
            </button>

            <button
              type="button"
              data-testid="setup-toggle"
              onClick={() => {
                onPlayClick();
                setIsSetupOpen((previous) => !previous);
              }}
              aria-expanded={isSetupOpen}
              aria-label="Link setup"
              title="Room, this device's court, relay and invite links"
              className={`${toolbarButton} ${
                isSetupOpen
                  ? 'bg-cyan-400 text-sky-950 border-cyan-200'
                  : 'bg-sky-950/80 hover:bg-sky-900 text-cyan-100 border-cyan-400/40'
              }`}
            >
              <Settings size={14} />
              <span className="hidden xl:inline">LINK SETUP</span>
            </button>

            <button
              type="button"
              data-testid="fullscreen-toggle"
              onClick={() => {
                onPlayClick();
                if (isFullScreen) exitFullScreen();
                else enterFullScreen();
              }}
              aria-pressed={isFullScreen}
              aria-label={isFullScreen ? 'Exit full screen' : 'Fit all four courts on the screen'}
              title={isFullScreen ? 'Exit full screen (Esc)' : 'Hide the app header and fit all four courts on the screen'}
              className={`${toolbarButton} font-black ${
                isFullScreen
                  ? 'bg-rose-500 hover:bg-rose-400 text-white border-rose-200/60'
                  : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border-white/40 shadow-[0_3px_0_#065f46] active:translate-y-0.5 active:shadow-none'
              }`}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">{isFullScreen ? 'EXIT' : 'FULL SCREEN'}</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* NOTICES                                                           */}
        {/* ================================================================= */}
        {status.appliedInvite && (
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/25 border border-emerald-300/60 text-emerald-50 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Check size={16} className="text-emerald-200 shrink-0" />
              <span>
                Invite link applied: this device joined room <strong className="font-mono">{status.appliedInvite.room}</strong>
                {status.appliedInvite.courtId ? (
                  <>
                    {' '}
                    and is scoring <strong>Court {status.appliedInvite.courtId}</strong>
                  </>
                ) : (
                  ' as a dashboard'
                )}
                {status.appliedInvite.relayUrl ? ` (relay ${status.appliedInvite.relayUrl.replace(/^wss?:\/\//, '')})` : ''}.
              </span>
            </span>
            <span className="flex items-center gap-2">
              {status.appliedInvite.courtId && (
                <button
                  type="button"
                  onClick={() => {
                    onPlayClick();
                    onOpenConsole();
                  }}
                  className={`px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black text-xs cursor-pointer ${FOCUS_RING}`}
                >
                  OPEN SCORING CONSOLE
                </button>
              )}
              <button
                type="button"
                onClick={() => courtLinkSession.dismissInviteNotice()}
                aria-label="Dismiss invite notice"
                className={`p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer ${FOCUS_RING}`}
              >
                <X size={14} />
              </button>
            </span>
          </div>
        )}

        {status.deskSlot === 'blocked' && config.deskCourtId && (
          <div
            role="alert"
            className="px-4 py-2.5 rounded-2xl bg-rose-500/25 border border-rose-300/70 text-rose-50 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-200 shrink-0" />
              <span>
                Court {config.deskCourtId} is already being published from another tab of this browser, so this tab is
                watching only. Close the other tab to publish from here.
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                onPlayClick();
                courtLinkSession.retryDeskSlot();
              }}
              className={`px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-mono font-bold text-xs cursor-pointer ${FOCUS_RING}`}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* FOUR COURTS                                                       */}
        {/* ================================================================= */}
        <div
          data-testid="court-grid"
          className={
            isFullScreen
              ? 'grid grid-cols-1 md:grid-cols-2 auto-rows-fr gap-2 sm:gap-3 min-h-[calc(100vh-5.75rem)] supports-[height:100dvh]:min-h-[calc(100dvh-5.75rem)]'
              : 'grid grid-cols-1 md:grid-cols-2 gap-3'
          }
        >
          {views.map((view) => (
            <CourtTile
              key={view.courtId}
              view={view}
              density={isFullScreen ? 'fit' : 'regular'}
              isDemo={status.isDemoMode}
              isOwnCourt={!status.isDemoMode && config.deskCourtId === view.courtId && status.deskSlot === 'publishing'}
              canClaim={!status.isDemoMode && config.deskCourtId === null}
              isInviteCopied={copiedKey === view.courtId}
              onCopyInvite={handleCopyInvite}
              onClaim={handleClaimCourt}
              onClear={(courtId) => {
                onPlayClick();
                courtLinkSession.clearCourt(courtId);
              }}
            />
          ))}
        </div>

        <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${isSetupOpen ? 'lg:grid-cols-[1fr_1.15fr]' : ''}`}>
          {/* =============================================================== */}
          {/* TOURNAMENT TICKER                                               */}
          {/* =============================================================== */}
          <div className="rounded-3xl bg-gradient-to-b from-sky-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-400/25">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Trophy size={16} className="text-amber-300" />
                Tournament Ticker
              </h3>
              <span className="text-xs font-mono text-cyan-200">{alerts.length} recent</span>
            </div>
            <div role="log" aria-live="polite" aria-label="Tournament alerts" className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <p className="text-xs text-sky-200/80 py-4 text-center">
                  Goals, period ends, timeouts, cap-outs and link faults from every court appear here.
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'warn'
                        ? 'bg-rose-500/20 border-rose-300/50 text-rose-50'
                        : 'bg-sky-900/60 border-cyan-400/20 text-sky-50'
                    }`}
                  >
                    <span className="font-mono text-cyan-200/90 shrink-0">{formatAlertTime(alert.atMs)}</span>
                    <span className="font-bold">{alert.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* LINK SETUP                                                      */}
          {/* =============================================================== */}
          {isSetupOpen && (
            <div
              data-testid="link-setup"
              className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-4 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-400/25">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Link2 size={16} className="text-cyan-300" />
                  Link Setup
                </h3>
                <span className="text-xs font-mono text-cyan-200">
                  {diagnostics.framesReceived} frames in · {diagnostics.framesRejected} rejected
                </span>
              </div>

              {formError && (
                <div role="alert" className="px-3 py-2 rounded-xl bg-rose-500/25 border border-rose-300/60 text-rose-50 text-xs break-all">
                  {formError}
                </div>
              )}

              {/* 1. Room */}
              <form
                className="space-y-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  onPlayClick();
                  applyConfig({ room: roomDraft });
                }}
              >
                <label htmlFor="court-link-room" className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider">
                  1. Tournament room code
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="court-link-room"
                    data-testid="room-input"
                    type="text"
                    value={roomDraft}
                    onChange={(event) => setRoomDraft(event.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-[150px] px-3 py-2 rounded-xl bg-sky-950/80 border border-cyan-400/40 text-white font-mono font-bold text-sm tracking-widest focus:outline-none focus:border-cyan-300"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-mono font-black text-xs cursor-pointer ${FOCUS_RING}`}
                  >
                    JOIN ROOM
                  </button>
                  <button
                    type="button"
                    data-testid="new-room"
                    onClick={() => {
                      onPlayClick();
                      const result = courtLinkSession.createRoom();
                      setFormError(result.ok ? null : result.error);
                    }}
                    className={`px-3 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-cyan-400/40 text-cyan-100 font-mono font-bold text-xs cursor-pointer ${FOCUS_RING}`}
                  >
                    NEW PRIVATE ROOM
                  </button>
                </div>
                <p className="text-xs text-sky-200/85">
                  Every desk and dashboard in the same room sees the same four courts.
                  {config.room === DEFAULT_LOCAL_ROOM && config.relayUrl
                    ? ' Generate a private room before sharing invite links: anyone who knows the code can watch.'
                    : ''}
                </p>
              </form>

              {/* 2. This device */}
              <div className="space-y-1.5">
                <span className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider">
                  2. This device scores
                </span>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Court scored by this device">
                  {([null, ...COURT_IDS] as Array<CourtId | null>).map((courtId) => {
                    const isSelected = config.deskCourtId === courtId;
                    return (
                      <button
                        key={courtId ?? 'none'}
                        type="button"
                        data-testid={`desk-court-${courtId ?? 'none'}`}
                        onClick={() => handleSelectDeskCourt(courtId)}
                        aria-pressed={isSelected}
                        className={`px-3 py-2 rounded-xl border text-xs font-mono font-black transition cursor-pointer ${FOCUS_RING} ${
                          isSelected
                            ? courtId === null
                              ? 'bg-sky-200 text-sky-950 border-white'
                              : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border-white/50 shadow-[0_3px_0_#065f46]'
                            : 'bg-sky-950/80 hover:bg-sky-900 text-cyan-100 border-cyan-400/35'
                        }`}
                      >
                        {courtId === null ? 'NO COURT (WATCH ONLY)' : `COURT ${courtId}`}
                      </button>
                    );
                  })}
                </div>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onPlayClick();
                    applyConfig({ deskLabel: labelDraft });
                  }}
                >
                  <label htmlFor="court-link-label" className="sr-only">
                    Name shown on the director screen
                  </label>
                  <input
                    id="court-link-label"
                    type="text"
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    maxLength={32}
                    placeholder="Device name, e.g. iPad — Table 2"
                    className="flex-1 min-w-[150px] px-3 py-2 rounded-xl bg-sky-950/80 border border-cyan-400/40 text-white text-xs focus:outline-none focus:border-cyan-300 placeholder:text-sky-300/60"
                  />
                  <button
                    type="submit"
                    className={`px-3 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-cyan-400/40 text-cyan-100 font-mono font-bold text-xs cursor-pointer ${FOCUS_RING}`}
                  >
                    SAVE NAME
                  </button>
                </form>
                <p className="text-xs text-sky-200/85" data-testid="desk-status">
                  {status.deskSlot === 'publishing' && config.deskCourtId
                    ? `Publishing Court ${config.deskCourtId} as "${config.deskLabel}"${
                        diagnostics.lastSentAtMs !== null
                          ? ` · last frame ${formatAge(Math.max(0, nowMs - diagnostics.lastSentAtMs))} ago · ${diagnostics.framesSent} sent`
                          : ' · waiting for the scoring console'
                      }`
                    : status.deskSlot === 'acquiring'
                    ? 'Checking that no other tab is publishing this court…'
                    : status.deskSlot === 'blocked'
                    ? 'Another tab of this browser is publishing this court.'
                    : 'Watching only. Choose a court to publish this device’s scoring console.'}
                </p>
                {ownView && ownView.conflict && (
                  <p role="alert" className="text-xs font-bold text-amber-200">
                    Another device is also publishing Court {config.deskCourtId}: {ownView.conflict.rivalLabels.join(', ')}.
                    One of the two must pick a different court.
                  </p>
                )}
              </div>

              {/* 3. Relay */}
              <form
                className="space-y-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  onPlayClick();
                  applyConfig({ relayUrl: relayDraft });
                }}
              >
                <label htmlFor="court-link-relay" className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider">
                  3. Cross-device relay (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="court-link-relay"
                    data-testid="relay-input"
                    type="url"
                    inputMode="url"
                    value={relayDraft}
                    onChange={(event) => setRelayDraft(event.target.value)}
                    placeholder="wss://your-relay.workers.dev"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-sky-950/80 border border-cyan-400/40 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-300 placeholder:text-sky-300/60"
                  />
                  <button
                    type="submit"
                    data-testid="relay-save"
                    className={`px-3 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-mono font-black text-xs cursor-pointer ${FOCUS_RING}`}
                  >
                    SAVE RELAY
                  </button>
                </div>
                <p className="text-xs text-sky-200/85">
                  Without a relay the dashboard only sees desks open in this same browser. To link tablets on different
                  pools, deploy the small relay in <code className="text-amber-200">cloudflare/court-relay</code> and
                  paste its address here.
                  {status.relayDetail ? ` Status: ${status.relayDetail}.` : ''}
                </p>
              </form>

              {/* 4. Invites */}
              <div className="space-y-1.5">
                <span className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider">
                  4. Invite links (room{config.relayUrl ? ', court and relay' : ' and court'} pre-filled)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COURT_IDS.map((courtId) => (
                    <button
                      key={courtId}
                      type="button"
                      onClick={() => handleCopyInvite(courtId)}
                      className={`px-3 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-cyan-400/40 text-cyan-100 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer ${FOCUS_RING}`}
                    >
                      {copiedKey === courtId ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                      DESK {courtId}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCopyInvite(null)}
                    className={`px-3 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-amber-300/40 text-amber-100 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer ${FOCUS_RING}`}
                  >
                    {copiedKey === 'dashboard' ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                    SECOND DASHBOARD
                  </button>
                </div>
                <p className="text-xs text-sky-200/85">
                  Opening a desk link on a tablet sets its room and court in one tap. The dashboard never controls a
                  desk: it only displays what each desk publishes.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-400/25 text-xs font-mono text-cyan-200/90">
                <span className="flex items-center gap-1.5">
                  <Radio size={13} className="text-cyan-300" />
                  Same-device channel: {status.localStatus.toUpperCase()}
                  {diagnostics.lastRejectReason ? ` · last reject: ${diagnostics.lastRejectReason}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onPlayClick();
                    onOpenConsole();
                  }}
                  className={`text-amber-300 hover:underline font-bold cursor-pointer ${FOCUS_RING}`}
                >
                  Open this device’s scoring console &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
