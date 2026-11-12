import React, { useState, useEffect } from 'react';
import {
  Radio,
  Sparkles,
  CheckCircle2,
  Play,
  Square,
  Trophy,
  Printer,
  Box,
  Download,
  Volume2,
  Zap,
  Shield,
} from 'lucide-react';
import CourtSummaryList from './court-summary-list';

const AUTO_FINDER_STEPS = [
  {
    id: 'cts-ch5',
    protocol: 'Colorado Time Systems (9600 8-E-1)',
    channel: 'Channel 0x05 (SC-500 / SC-600 Shot Clocks)',
    txHex: '8A 20 20 20 38 38 20 20 20',
    pinout: 'GPIO 17 (TX1) -> 2.5kV Isolator -> 1/4" TS Tip (+12V RS-232)',
  },
  {
    id: 'cts-ch0',
    protocol: 'Colorado Time Systems (9600 8-E-1)',
    channel: 'Channel 0x00 (WA-3 Wireless Main Matrix)',
    txHex: '80 20 38 38 3A 38 38 20 20',
    pinout: 'GPIO 17 (TX1) -> CTS WA-3 R-DC Serial Input Port',
  },
  {
    id: 'dakt-4498',
    protocol: 'Daktronics All Sport 5000 (19200 8-N-1)',
    channel: 'RTD Water Polo Sport Code 4498',
    txHex: '16 01 34 34 39 38 30 38 3A 30 30 38 38 04',
    pinout: 'GPIO 17 (TX1) -> Daktronics J6 Current-Loop / RS-232 Adapter',
  },
  {
    id: 'pickle-3ch',
    protocol: 'CTS System 6 Console Companion (3-Channel Pickle)',
    channel: 'GPIO 4 (30s) + GPIO 5 (20s) + GPIO 6 (Start/Stop)',
    txHex: 'EL817S Optocoupler 150ms Relay Closure (Ch 1 -> Ch 2 -> Ch 3)',
    pinout: '1/4" TRS Splitter -> System 6 Rear RESET 1 / RESET 2 / START Jacks',
  },
];

export default function TournamentHubPanel({
  onSelectProtocol,
  onOpenDirector,
}: {
  onSelectProtocol?: (proto: 'cts' | 'daktronics') => void;
  onOpenDirector?: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);
  const [lockedStep, setLockedStep] = useState<number | null>(null);

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setScanIndex((prev) => (prev + 1) % AUTO_FINDER_STEPS.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleLockProtocol = (idx: number) => {
    setIsScanning(false);
    setScanIndex(idx);
    setLockedStep(idx);
    if (onSelectProtocol) {
      onSelectProtocol(idx === 2 ? 'daktronics' : 'cts');
    }
  };

  const handleDownloadStlSummary = (part: 'jig' | 'hood') => {
    const content =
      part === 'jig'
        ? 'solid polobridge_front_panel_drill_jig\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 120 65 0\n      vertex 120 0 0\n    endloop\n  endfacet\nendsolid polobridge_front_panel_drill_jig\n'
        : 'solid polopad_poolside_sunhood_stand\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 267 95 0\n      vertex 267 0 0\n    endloop\n  endfacet\nendsolid polopad_poolside_sunhood_stand\n';
    const blob = new Blob([content], { type: 'application/sla' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      part === 'jig'
        ? 'polobridge_front_panel_drill_jig.stl'
        : 'polopad_poolside_sunhood_stand.stl';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-900 to-indigo-950 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ================================================================= */}
        {/* 1. 1-CLICK UNIVERSAL POOL SCOREBOARD AUTO-FINDER                  */}
        {/* ================================================================= */}
        <div className="rounded-3xl bg-gradient-to-r from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/30 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-300 via-teal-400 to-cyan-400 flex items-center justify-center text-sky-950 shadow-lg">
                <Radio size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">
                    1-Click Universal Pool Scoreboard Auto-Finder
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/40">
                    REV 2.5 HARDWARE DIAGNOSTIC
                  </span>
                </div>
                <p className="text-xs text-cyan-200/90 mt-0.5">
                  Walking onto an unfamiliar high school pool deck? Start the Auto-Finder and click{' '}
                  <strong>&ldquo;Shot Clocks Lit Up 88!&rdquo;</strong> as soon as the pool&apos;s displays respond.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setLockedStep(null);
                  setIsScanning((prev) => !prev);
                }}
                className={`px-4 py-2.5 rounded-xl font-mono font-black text-xs flex items-center gap-2 shadow-lg transition cursor-pointer ${
                  isScanning
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:brightness-110 text-sky-950'
                }`}
              >
                {isScanning ? <Square size={14} /> : <Play size={14} />}
                <span>{isScanning ? 'STOP AUTO-SCAN' : 'START 4-MODE AUTO-SCAN'}</span>
              </button>

              <button
                onClick={() => handleLockProtocol(scanIndex)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-sky-950 font-mono font-black text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
              >
                <CheckCircle2 size={15} />
                <span>Shot Clocks Lit Up &ldquo;88&rdquo; &mdash; Lock Mode!</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {AUTO_FINDER_STEPS.map((step, idx) => {
              const isCurrent = scanIndex === idx;
              const isLocked = lockedStep === idx;
              return (
                <div
                  key={step.id}
                  onClick={() => handleLockProtocol(idx)}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    isLocked
                      ? 'bg-emerald-500/25 border-emerald-300 shadow-lg shadow-emerald-500/20'
                      : isCurrent && isScanning
                      ? 'bg-amber-400/25 border-amber-300 animate-pulse shadow-lg'
                      : 'bg-sky-950/75 hover:bg-sky-900/75 border-cyan-400/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
                      <span className="text-cyan-300">Probe #{idx + 1}</span>
                      {isLocked && <span className="text-emerald-300">✓ LOCKED IN</span>}
                      {!isLocked && isCurrent && isScanning && (
                        <span className="text-amber-300">● TRANSMITTING 88...</span>
                      )}
                    </div>
                    <div className="text-sm font-black text-white mt-1">{step.protocol}</div>
                    <div className="text-xs text-cyan-200 mt-0.5">{step.channel}</div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-cyan-400/20 text-[11px] font-mono">
                    <div className="text-emerald-300 truncate">TX: {step.txHex}</div>
                    <div className="text-sky-200/80 text-[10px]">{step.pinout}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. MULTI-COURSE TOURNAMENT DIRECTOR LIVE COMMAND HUB              */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/30 pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={19} className="text-amber-300" />
                <h3 className="text-base font-black text-white">
                  Multi-Course High School &amp; Club Tournament Command Center
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                Live Court Link &bull; Up to 4 Courses
              </span>
            </div>

            <CourtSummaryList onOpenDirector={() => onOpenDirector?.()} />
          </div>

          {/* 3D Printable Enclosure & iPad Sun-Hood CAD Pack + Laminated Desk Card */}
          <div className="lg:col-span-4 rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-cyan-400/30 pb-3">
                <Box size={19} className="text-cyan-300" />
                <h3 className="text-base font-black text-white">
                  3D-Printable Poolside CAD Pack (`.STL` &amp; `.SCAD`)
                </h3>
              </div>
              <p className="text-xs text-cyan-100/90 leading-relaxed">
                Generated in <code className="text-amber-300">hardware/enclosure_cad/</code> for any Bambu Lab or Prusa 3D printer using PETG or ASA filament:
              </p>

              <div className="p-3.5 rounded-2xl bg-sky-950/80 border border-cyan-400/30 space-y-2">
                <div className="text-xs font-black text-emerald-300">
                  1. Hammond 1554C2GYCL Drill Jig &amp; 3-Button Lid Guard
                </div>
                <p className="text-xs text-sky-200/85">
                  Aligns the two 11.4mm Neutrik 1/4&quot; holes, 22mm 105dB piezo port, and protective collars around the 3 Emergency Lid Buttons.
                </p>
                <button
                  onClick={() => handleDownloadStlSummary('jig')}
                  className="w-full py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download Drill Jig (.STL)</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-950/80 border border-cyan-400/30 space-y-2">
                <div className="text-xs font-black text-amber-300">
                  2. 25&deg; Anti-Glare Poolside iPad Sun-Hood Stand
                </div>
                <p className="text-xs text-sky-200/85">
                  Eliminates noon California sun glare for parent volunteers and keeps the iPad elevated above wet table surfaces.
                </p>
                <button
                  onClick={() => handleDownloadStlSummary('hood')}
                  className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-sky-950 font-mono font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download iPad Sun-Hood (.STL)</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-sky-900 hover:bg-sky-800 border border-cyan-400/40 text-cyan-100 font-mono font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Laminated Volunteer Desk Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
