import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { formatGameClock, periodLabel } from '../engine/court-link';
import { useCourtLinkStatus, useLiveCourtViews } from './use-court-link';

/**
 * Compact live read-out of the four courts for the Auto-Finder & Hub tab.
 * Shows real link data only; the full view lives in the Director dashboard.
 */
export default function CourtSummaryList({ onOpenDirector }: { onOpenDirector: () => void }) {
  const status = useCourtLinkStatus();
  // Whole-second resolution is plenty for a summary row.
  const { views } = useLiveCourtViews(500);
  const liveCourts = views.filter((view) => view.health === 'live' || view.health === 'lagging').length;

  return (
    <div className="space-y-3" data-testid="court-summary-list">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-cyan-200">
          {status.isDemoMode ? 'DEMO DATA' : `ROOM ${status.config.room}`} &bull; {liveCourts} of 4 courts live
        </span>
        <button
          type="button"
          onClick={onOpenDirector}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-cyan-400 to-sky-500 text-sky-950 font-black flex items-center gap-1.5 shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition cursor-pointer"
        >
          <LayoutGrid size={14} />
          <span>OPEN 4-COURT DIRECTOR DASHBOARD</span>
        </button>
      </div>

      {views.map((view) => {
        const snapshot = view.snapshot;
        const projection = view.projection;
        const isLive = view.health === 'live' || view.health === 'lagging';
        return (
          <div
            key={view.courtId}
            className="p-4 rounded-2xl bg-sky-950/80 border border-cyan-400/30 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-bold">COURT {view.courtId}</span>
                <span className="text-sky-300 truncate">{view.deskLabel ?? 'No desk connected'}</span>
              </div>
              <div className="text-base font-black text-white mt-1.5 truncate">
                {snapshot ? `${snapshot.teamWhiteName} (White) vs. ${snapshot.teamDarkName} (Dark)` : 'Waiting for a scoring desk'}
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-2xl font-black text-white tabular-nums">
                {snapshot ? (
                  <>
                    {snapshot.scoreWhite} &ndash; {snapshot.scoreDark}
                  </>
                ) : (
                  <>&mdash;</>
                )}
              </div>
              <div
                className={`text-xs font-bold ${
                  isLive ? 'text-emerald-300' : view.health === 'empty' ? 'text-amber-300' : 'text-rose-300'
                }`}
              >
                {snapshot && projection
                  ? `${isLive ? 'LIVE' : view.health === 'stale' ? 'LINK LOST' : 'SIGNED OFF'} • ${periodLabel(
                      snapshot.period
                    )} ${formatGameClock(projection.gameTimeMs)}`
                  : 'WAITING'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
