import React, { useState } from 'react';
import {
  Play, Pause, RotateCcw, Shield, Zap, Radio, Tv, Smartphone,
  CheckCircle2, ArrowRight, Cpu, DollarSign, Trophy, Volume2,
  Layers, Sparkles, Bluetooth, FileText, Download, ExternalLink
} from 'lucide-react';

interface LandingPageProps {
  gameTimeFormatted: string;
  shotDisplay: string;
  shotSec: number;
  isBlanked: boolean;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  period: number;
  isRunning: boolean;
  onToggleStartStop: () => void;
  onReset30: () => void;
  onReset20: () => void;
  onFireHorn: () => void;
  onNavigateTab: (tab: 'console' | 'sixeight' | 'mockups' | 'overlay' | 'rack' | 'scoresheet' | 'bom' | 'landing') => void;
}

export default function LandingPage({
  gameTimeFormatted,
  shotDisplay,
  shotSec,
  isBlanked,
  scoreWhite,
  scoreDark,
  teamWhiteName,
  teamDarkName,
  period,
  isRunning,
  onToggleStartStop,
  onReset30,
  onReset20,
  onFireHorn,
  onNavigateTab,
}: LandingPageProps) {
  const [poolCount, setPoolCount] = useState<number>(2);
  const [includeStreaming, setIncludeStreaming] = useState<boolean>(true);

  // ROI Calculation: Legacy System 6 ($6,200) + 2 Wired Pickle Switches ($380) + Hardware Broadcast CG ($2,900)
  const legacyPerPool = 6200 + 380 + (includeStreaming ? 2900 : 0);
  const poloBridgePerPool = 50 + 499; // $49.85 Dongle BOM + $499 iPad (or BYO iPad)
  const totalSavings = (legacyPerPool - poloBridgePerPool) * poolCount;

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/35 via-sky-900 to-indigo-950 text-white">
      
      {/* ========================================================= */}
      {/* 1. HERO SECTION WITH INTERACTIVE LIVE MINI-CONSOLE        */}
      {/* ========================================================= */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
          
          {/* Left Column: Value Proposition & CTAs */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-400/20 border border-cyan-300/40 text-cyan-100 text-xs font-mono font-bold shadow-sm">
              <Sparkles size={13} className="text-amber-300" />
              <span>iOS 16+ Native SwiftUI &bull; Web Bluetooth PWA &bull; ESP32-S3 Hardware</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-[1.08]">
              Retire the $6,500 Pool Console &amp; Tangled Pickle Cords.
            </h1>

            <p className="text-base text-cyan-100/90 leading-relaxed">
              <strong>PoloBridge &amp; PoloPad Pro</strong> transform any iPad into a rugged, dual-thumb wireless water polo timing desk. Plug our $49 isolated RS-232 dongle into your existing <strong>Colorado Time Systems (System 6 / WA-3)</strong> or <strong>Daktronics All Sport 5000</strong> jack for <span className="text-emerald-300 font-bold">&lt;5ms BLE latency</span>, automatic <strong>Rule WP 20.15</strong> shot-clock blanking, <strong>6-8 Sports</strong> live stat sync, and a zero-cost <strong>OBS TV Scorebug</strong>.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onNavigateTab('console')}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 text-sky-950 font-black text-sm flex items-center gap-2 shadow-[0_10px_30px_rgba(16,185,129,0.4)] transition cursor-pointer"
              >
                <Layers size={17} />
                <span>Launch Dual-Thumb Console</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => onNavigateTab('bom')}
                className="px-5 py-3 rounded-2xl bg-sky-800/80 hover:bg-sky-700/90 border-2 border-cyan-300/50 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Cpu size={17} className="text-amber-300" />
                <span>Order Dongle Parts ($24–$49 BOM)</span>
              </button>

              <button
                onClick={() => onNavigateTab('mockups')}
                className="px-4 py-3 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 border border-cyan-400/30 text-cyan-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Smartphone size={15} />
                <span>3D Renders &amp; iOS Showcase</span>
              </button>
            </div>

            {/* Key Metric Badges */}
            <div className="grid grid-cols-4 gap-3 pt-3">
              {[
                { val: '1.8 ms', label: 'BLE 5.0 Latency' },
                { val: '2.5 kV', label: 'Galvanic Isolation' },
                { val: 'WP 20.15', label: 'Auto-Blanking' },
                { val: '$49.85', label: 'Pro Dongle BOM' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-sky-900/70 border border-cyan-400/30 text-center shadow-inner"
                >
                  <div className="text-lg font-black font-mono text-amber-300">{stat.val}</div>
                  <div className="text-[10px] font-mono text-cyan-200 uppercase mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Interactive Hero Hardware + iPad Preview Card */}
          <div className="rounded-3xl bg-gradient-to-b from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-300/50 p-5 shadow-[0_24px_70px_rgba(6,182,212,0.35)] space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-400/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-black text-cyan-200 uppercase tracking-wider">
                  Interactive Poolside Test Deck (Try Clicking!)
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-300 font-bold">
                Q{period} &bull; {teamWhiteName} {scoreWhite} - {scoreDark} {teamDarkName}
              </span>
            </div>

            {/* Hero Kit Photograph */}
            <div className="rounded-2xl overflow-hidden border border-cyan-300/40 aspect-video relative group">
              <img
                src="./assets/polobridge_kit_exploded_render.jpg"
                alt="PoloBridge Pro Hardware Kit & iPad Console"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sky-950/90 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-sky-950/85 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-100">
                  PB-S3-ISO Dongle + iPadOS 16+ SwiftUI &amp; PWA
                </span>
                <button
                  onClick={() => onNavigateTab('mockups')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-400/25 hover:bg-cyan-400/40 border border-cyan-300/50 text-[10px] font-mono font-bold text-white cursor-pointer"
                >
                  Inspect 4K Renders &rarr;
                </button>
              </div>
            </div>

            {/* Live Mini Plunger Controls Connected to Real Engine */}
            <div className="grid grid-cols-4 gap-2.5 pt-1">
              <button
                onClick={onToggleStartStop}
                className={`p-3 rounded-2xl font-mono font-black text-xs flex flex-col items-center justify-center gap-1 border-t border-white/50 shadow-lg active:translate-y-1 transition cursor-pointer ${
                  isRunning
                    ? 'bg-gradient-to-b from-rose-500 to-red-700 text-white'
                    : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white'
                }`}
              >
                {isRunning ? <Pause size={18} /> : <Play size={18} />}
                <span>{isRunning ? 'STOP' : 'START'}</span>
                <span className="text-[10px] opacity-90">{gameTimeFormatted}</span>
              </button>

              <button
                onClick={onReset30}
                className="p-3 rounded-2xl bg-gradient-to-b from-emerald-400 to-teal-600 border-t border-white/50 text-white font-mono font-black text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg active:translate-y-1 transition cursor-pointer"
              >
                <span className="text-xl leading-none">30s</span>
                <span className="text-[9px]">TURNOVER</span>
              </button>

              <button
                onClick={onReset20}
                className="p-3 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-600 border-t border-white/50 text-white font-mono font-black text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg active:translate-y-1 transition cursor-pointer"
              >
                <span className="text-xl leading-none">20s</span>
                <span className="text-[9px]">REBOUND</span>
              </button>

              <button
                onClick={onFireHorn}
                className="p-3 rounded-2xl bg-gradient-to-b from-rose-500 to-red-700 border-t border-white/50 text-white font-mono font-black text-xs flex flex-col items-center justify-center gap-1 shadow-lg active:translate-y-1 transition cursor-pointer"
              >
                <Volume2 size={18} />
                <span>HORN</span>
                <span className="text-[10px] text-amber-200">:{isBlanked ? '--' : shotDisplay}</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. WHY 2.4 GHz FAILS AT POOLS & HOW POLOBRIDGE WINS        */}
      {/* ========================================================= */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-3xl bg-gradient-to-r from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/25 pb-4">
            <div>
              <h2 className="text-xl font-black text-white">
                Engineered for Hostile Chlorinated Pool Decks
              </h2>
              <p className="text-xs text-cyan-200 mt-0.5">
                Every electrical, RF, and rule edge case documented in our engineering dossier is solved in hardware and firmware.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-300/40 text-xs font-mono font-bold text-cyan-100">
              World Aquatics &bull; NCAA &bull; NFHS &bull; USAWP
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center text-cyan-300">
                <Radio size={20} />
              </div>
              <h3 className="text-sm font-black text-white">
                1. Defeating 2.45 GHz Water Dielectric Loss
              </h3>
              <p className="text-xs text-sky-200/90 leading-relaxed">
                Liquid water absorbs 2.45 GHz microwave RF with 18–28 dB higher path loss across a 50m pool. PoloBridge keeps BLE 5.0 strictly at the scorer&apos;s table (&lt;2m) and drives hardwired ±12V RS-232 into your CTS WA-3 directional transmitter or 915 MHz Sub-GHz link.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
                <Zap size={20} />
              </div>
              <h3 className="text-sm font-black text-white">
                2. 2.5kV VFD Pump Ground-Loop Isolation
              </h3>
              <p className="text-xs text-sky-200/90 leading-relaxed">
                50HP variable-frequency filtration pumps induce up to 15V AC ripple on pool deck ground wiring. Our Tier 2 dongle uses an Analog Devices <strong>ADM3251E / ADuM1201</strong> 2.5kV RMS galvanic isolator and ±15kV TVS diodes so UART frames never corrupt.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300">
                <Shield size={20} />
              </div>
              <h3 className="text-sm font-black text-white">
                3. Automated Rule WP 20.15 &amp; WP 21 Logic
              </h3>
              <p className="text-xs text-sky-200/90 leading-relaxed">
                Inexperienced table workers constantly forget to blank the shot clock at the end of a period or release exclusions on a goal. PoloPad Pro automatically sends ASCII blanking spaces when <code className="text-amber-300">Game &le; Shot</code> and auto-releases defending exclusions on goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE ATHLETIC DIRECTOR ROI & COST CALCULATOR    */}
      {/* ========================================================= */}
      <section className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          
          {/* Feature Comparison Matrix */}
          <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl">
            <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-amber-300" />
              <span>Head-to-Head: Legacy Desk Consoles vs. PoloBridge Pro</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-cyan-400/30 bg-sky-950/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-cyan-400/30 bg-sky-900/80 font-mono text-[10px] uppercase text-cyan-200">
                    <th className="p-3">Capability</th>
                    <th className="p-3 text-rose-200">CTS System 6 / Dakt 5000</th>
                    <th className="p-3 text-emerald-300">PoloBridge + PoloPad Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-400/15">
                  {[
                    ['Hardware Cost', '$6,200 – $9,500 Console', '$24.40 – $49.85 Dongle + iPad'],
                    ['30s vs 20s Reset Ergonomics', 'Tiny membrane keys / corded switch', 'Giant Dual-Thumb 3D Plungers'],
                    ['1-Tap Mistake Undo', 'None (Manual keypad re-entry)', '15-State Instant Clock & Score Undo'],
                    ['Rule WP 20.15 Blanking', 'Manual toggle required', '100% Automatic at 100ms precision'],
                    ['3-Foul "Rolled" Cap Tracking', 'Paper scoresheet only', 'Automated per-cap 3/3 Cap-Out alerts'],
                    ['6-8 Sports Live Sync', 'None (Manual post-game entry)', 'Real-Time Play-by-Play & PI Roster Sync'],
                    ['Live Stream TV Scorebug', '$2,900 Hardware CG Box', 'Built-in 1080p60 OBS Browser Source'],
                  ].map(([cap, legacy, modern], idx) => (
                    <tr key={idx} className="hover:bg-sky-800/30">
                      <td className="p-2.5 font-bold text-white">{cap}</td>
                      <td className="p-2.5 text-sky-300/80 font-mono">{legacy}</td>
                      <td className="p-2.5 text-emerald-200 font-mono font-bold">{modern}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Facility Savings Calculator */}
          <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between border-b border-cyan-400/30 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-300" />
                  <h3 className="text-base font-black text-white">Athletic Department ROI Calculator</h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-200 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                  94% Cost Reduction
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-cyan-100">Number of Competition Pools / Courses:</span>
                    <span className="font-mono text-amber-300 text-sm">{poolCount} {poolCount === 1 ? 'Pool' : 'Pools'}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={poolCount}
                    onChange={(e) => setPoolCount(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-sky-950/70 border border-cyan-400/30 cursor-pointer">
                  <span className="text-xs font-bold text-white">Include Live Stream Broadcast Scorebug CG ($2,900 value)</span>
                  <input
                    type="checkbox"
                    checked={includeStreaming}
                    onChange={(e) => setIncludeStreaming(e.target.checked)}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-sky-950/80 border border-rose-400/30">
                    <div className="text-[10px] font-mono text-rose-200 uppercase">Legacy Consoles + CG</div>
                    <div className="text-2xl font-black font-mono text-rose-300 mt-1">
                      ${(legacyPerPool * poolCount).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-sky-950/80 border border-emerald-400/40">
                    <div className="text-[10px] font-mono text-emerald-200 uppercase">PoloBridge + iPads</div>
                    <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
                      ${(poloBridgePerPool * poolCount).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-cyan-500/25 border-2 border-emerald-300/50 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono font-bold text-emerald-200 uppercase">
                  Estimated Aquatic Facility Savings
                </div>
                <div className="text-3xl font-black font-mono text-white">
                  ${totalSavings.toLocaleString()} USD
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('bom')}
                className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
              >
                <span>View BOM</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. iOS & IPADOS DEPLOYMENT OPTIONS                        */}
      {/* ========================================================= */}
      <section className="max-w-6xl mx-auto px-6 pt-4 pb-12">
        <div className="rounded-3xl bg-gradient-to-r from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Smartphone size={19} className="text-cyan-300" />
                <span>Three Ways to Run PoloPad Pro on iPadOS &amp; iOS</span>
              </h3>
              <p className="text-xs text-cyan-200">
                Built from day one for iPad Pro, iPad Air, and iPad mini in waterproof poolside cases.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="font-mono font-black text-cyan-300 uppercase">Option A &bull; Native SwiftUI App</div>
              <div className="text-sm font-black text-white">Xcode / TestFlight (`ipad_app/`)</div>
              <p className="text-sky-200/90 leading-relaxed">
                Pure Swift 5.9 + SwiftUI + CoreBluetooth (`BluetoothManager.swift`, `WaterPoloGameModel.swift`, `PoloPadView.swift`) with heavy `UIImpactFeedbackGenerator` haptics and zero-latency GATT streaming.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="font-mono font-black text-emerald-300 uppercase">Option B &bull; iOS Standalone PWA</div>
              <div className="text-sm font-black text-white">Add to Home Screen / Bluefy BLE</div>
              <p className="text-sky-200/90 leading-relaxed">
                Includes full iOS WebApp manifest (`apple-mobile-web-app-capable`), offline assets, and Web Bluetooth GATT support via Chrome (Mac/PC/Android) or Bluefy Browser on iPadOS.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-950/75 border border-cyan-400/30 space-y-2">
              <div className="font-mono font-black text-amber-300 uppercase">Option C &bull; Capacitor iOS Wrapper</div>
              <div className="text-sm font-black text-white">1-Command Xcode App (`capacitor.config.ts`)</div>
              <p className="text-sky-200/90 leading-relaxed">
                Run <code className="text-amber-200">npx cap sync ios</code> in <code className="text-cyan-200">react_app/</code> or <code className="text-cyan-200">flutter build ipa</code> in <code className="text-cyan-200">flutter_app/</code> to deploy the full 6-8 Sports + BOM + Scorebug suite to the App Store.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. SCHOOL & BOOSTER CLUB COMMERCIAL PRICING TIERS         */}
      {/* ========================================================= */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl bg-gradient-to-r from-sky-900/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-2xl space-y-5">
          <div>
            <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/40">
              ATHLETIC DEPARTMENT &amp; BOOSTER CLUB PRICING
            </span>
            <h3 className="text-xl font-black text-white mt-2">
              Simple One-Time Hardware Purchase &bull; Free Forever iOS &amp; Web App
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-sky-950/80 border border-cyan-400/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="font-mono font-bold text-cyan-300 uppercase">Open-Hardware DIY</div>
                <div className="text-2xl font-black text-white mt-1">$24.40 – $49.85 <span className="text-xs font-normal text-cyan-200">/ build</span></div>
                <ul className="mt-3 space-y-1.5 text-sky-100">
                  <li>&bull; Complete DigiKey &amp; JLCPCB Turnkey SMT Files</li>
                  <li>&bull; 2.5kV Isolated RS-232 + 3-Ch Pickle Companion</li>
                  <li>&bull; Full PoloPad Pro iOS/Web Console Included Free</li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('bom')}
                className="w-full py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 border border-cyan-400/40 text-cyan-100 font-mono font-bold cursor-pointer"
              >
                Order Parts / JLCPCB CSV
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-teal-900/60 border-2 border-emerald-400 flex flex-col justify-between space-y-3 shadow-lg">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-emerald-300 uppercase">High School Turnkey Kit</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-400 text-sky-950 font-mono font-black text-[10px]">MOST POPULAR</span>
                </div>
                <div className="text-2xl font-black text-white mt-1">$279 <span className="text-xs font-normal text-emerald-200">one-time</span></div>
                <ul className="mt-3 space-y-1.5 text-sky-100">
                  <li>&bull; Factory-Assembled IP67 PoloBridge Rev 2.5 Dongle</li>
                  <li>&bull; Dual RS-232 + 3-Channel System 6 Pickle Splitter</li>
                  <li>&bull; Built-In 105dB Piezo Horn + 3 Emergency Lid Buttons</li>
                  <li>&bull; Simple Volunteer Mode + Full Varsity Desk App (Free)</li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('console')}
                className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black cursor-pointer"
              >
                Launch Live School Console
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-sky-950/80 border border-amber-400/40 flex flex-col justify-between space-y-3">
              <div>
                <div className="font-mono font-bold text-amber-300 uppercase">Tournament &amp; 6-8 Cloud Pro</div>
                <div className="text-2xl font-black text-white mt-1">+$99 <span className="text-xs font-normal text-amber-200">/ year (optional)</span></div>
                <ul className="mt-3 space-y-1.5 text-sky-100">
                  <li>&bull; Live 6-8 Sports Cloud Box-Score &amp; Roster Sync</li>
                  <li>&bull; Multi-Course Tournament Director Live Dashboard</li>
                  <li>&bull; 1080p60 Broadcast TV Scorebug Overlay for Hudl/OBS</li>
                  <li>&bull; Automated Official PDF Match Scoresheet Archive</li>
                </ul>
              </div>
              <button
                onClick={() => onNavigateTab('sixeight')}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-sky-950 font-mono font-black cursor-pointer"
              >
                Explore 6-8 Cloud Sync
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
