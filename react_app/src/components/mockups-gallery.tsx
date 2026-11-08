import React, { useState } from 'react';
import { 
  Tablet, Cpu, Eye, Tv, Shield, Radio, Volume2, 
  ExternalLink, Sparkles, CheckCircle2, Zap, AlertCircle,
  Camera, Image as ImageIcon, Download
} from 'lucide-react';

interface MockupGalleryProps {
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
}

type ShowcaseMode = 'renders' | 'ipad' | 'dongle' | 'shotclock' | 'broadcast';

export default function MockupsGallery({
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
}: MockupGalleryProps) {
  const [selectedMockup, setSelectedMockup] = useState<ShowcaseMode>('renders');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-600/30 via-sky-900 to-indigo-950">
      
      {/* Gallery Selector Tab Bar */}
      <div className="h-12 border-b border-cyan-400/30 bg-sky-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider">
            Mockup View:
          </span>
          <div className="flex p-0.5 rounded-xl bg-sky-900/60 border border-cyan-400/30 text-xs">
            {[
              { id: 'renders', label: 'Photorealistic Studio Shots', icon: Camera },
              { id: 'ipad', label: 'Handheld iPad in Case', icon: Tablet },
              { id: 'dongle', label: 'Hardware Dongle (3D)', icon: Cpu },
              { id: 'shotclock', label: 'Goal SC-500 Display', icon: Eye },
              { id: 'broadcast', label: 'Television Broadcast Bug', icon: Tv },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedMockup === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMockup(tab.id as ShowcaseMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30' 
                      : 'text-sky-200/80 hover:text-white hover:bg-cyan-400/15'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Product Design Suite</span>
        </div>
      </div>

      {/* Main Canvas Display Area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-y-auto">
        
        {/* ========================================================= */}
        {/* MOCKUP 0: PHOTOREALISTIC COMMERCIAL STUDIO RENDERS        */}
        {/* ========================================================= */}
        {selectedMockup === 'renders' && (
          <div className="w-full max-w-5xl space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>PoloBridge Official Product Photography</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-300/40">
                    4K Studio Renders
                  </span>
                </h2>
                <p className="text-xs text-sky-200 mt-1">
                  High-fidelity commercial marketing assets for athletic directors, aquatic coaches, and product launch decks.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              
              {/* Image Card 1: Hardware Dongle Studio Render */}
              <div className="rounded-3xl bg-gradient-to-b from-sky-800/80 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between group hover:border-cyan-300 transition">
                <div className="rounded-2xl overflow-hidden border border-cyan-300/30 aspect-[4/3] bg-sky-950 relative mb-4">
                  <img 
                    src="/assets/polobridge_hardware_dongle.jpg" 
                    alt="PoloBridge Hardware Dongle Commercial Render"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-sky-950/80 backdrop-blur-md text-[10px] font-mono text-cyan-100 font-bold border border-cyan-400/40">
                    Industrial CNC Aluminum &bull; ENIG Gold
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">PoloBridge Wireless Hardware Dongle</span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">Model PB-S3</span>
                  </div>
                  <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                    Rugged anodized aluminum chassis with 2.5kV galvanic isolation, laser-engraved typography, gold-plated 1/4" CTS mono phono plug, and Sub-GHz RF helical antenna.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-cyan-400/25 flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300">Asset: polobridge_hardware_dongle.jpg</span>
                  <a 
                    href="/assets/polobridge_hardware_dongle.jpg" 
                    download="polobridge_hardware_dongle.jpg"
                    className="flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 font-bold"
                  >
                    <Download size={13} />
                    <span>Download Full-Res</span>
                  </a>
                </div>
              </div>

              {/* Image Card 2: Handheld Deck Action POV */}
              <div className="rounded-3xl bg-gradient-to-b from-sky-800/80 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between group hover:border-emerald-300 transition">
                <div className="rounded-2xl overflow-hidden border border-cyan-300/30 aspect-[4/3] bg-sky-950 relative mb-4">
                  <img 
                    src="/assets/polobridge_deck_operator_pov.jpg" 
                    alt="PoloPad Handheld iPad Deck Action POV"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-sky-950/80 backdrop-blur-md text-[10px] font-mono text-cyan-100 font-bold border border-cyan-400/40">
                    Poolside Operator POV &bull; Outdoor Olympic Pool
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">PoloPad Handheld iPad Console</span>
                    <span className="text-xs font-mono text-emerald-300 font-bold">Dual-Thumb Grip</span>
                  </div>
                  <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                    In-context match action shot at an Olympic 50m pool facility. Two-handed ergonomic grip demonstrating thumb placement over giant Start/Stop and Reset buttons with glowing shot clock readout.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-cyan-400/25 flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300">Asset: polobridge_deck_operator_pov.jpg</span>
                  <a 
                    href="/assets/polobridge_deck_operator_pov.jpg" 
                    download="polobridge_deck_operator_pov.jpg"
                    className="flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-bold"
                  >
                    <Download size={13} />
                    <span>Download Full-Res</span>
                  </a>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 1: HANDHELD IPAD IN RUGGED DECK CHASSIS            */}
        {/* ========================================================= */}
        {selectedMockup === 'ipad' && (
          <div className="relative flex flex-col items-center">
            
            {/* Pool Deck Background Glow Simulation */}
            <div className="absolute -inset-10 bg-gradient-to-tr from-cyan-600/10 via-blue-700/10 to-transparent blur-3xl pointer-events-none" />

            {/* Two-Handed Grip Frame Container */}
            <div className="relative flex items-center">
              
              {/* Left Hand Silhouette / Grip Simulation */}
              <div className="w-16 h-72 rounded-l-3xl bg-neutral-800/80 border-l border-y border-white/10 flex flex-col items-center justify-center shadow-2xl relative z-0 -mr-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 -rotate-90 whitespace-nowrap">
                  LEFT HAND GRIP
                </span>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-14 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-[9px] font-bold text-cyan-300">
                  THUMB
                </div>
              </div>

              {/* Rugged iPad Shockproof Chassis */}
              <div className="w-[660px] h-[440px] rounded-[36px] bg-gradient-to-b from-sky-800 via-blue-900 to-indigo-950 border-4 border-cyan-400/60 p-4 shadow-[0_30px_90px_rgba(6,182,212,0.35)] flex flex-col justify-between relative z-10">
                
                {/* Protective Silicone Corner Bumper Accents */}
                <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-tl-xl border-t-4 border-l-4 border-cyan-300 pointer-events-none" />
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-tr-xl border-t-4 border-r-4 border-cyan-300 pointer-events-none" />
                <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-bl-xl border-b-4 border-l-4 border-cyan-300 pointer-events-none" />
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-br-xl border-b-4 border-r-4 border-cyan-300 pointer-events-none" />

                {/* Inner Screen Surface */}
                <div className="flex-1 rounded-2xl bg-gradient-to-b from-sky-900/90 to-indigo-950/95 border border-cyan-400/30 p-4 flex flex-col justify-between relative overflow-hidden">
                  
                  {/* Subtle Screen Specular Glass Reflection */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] to-transparent pointer-events-none" />

                  {/* Header Bar */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-xs">PoloPad Pro</span>
                      <span className="text-[10px] text-cyan-400 font-mono">Q{period}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-white">{teamWhiteName}: {scoreWhite}</span>
                      <span className="text-neutral-500">&bull;</span>
                      <span className="text-blue-400">{teamDarkName}: {scoreDark}</span>
                    </div>
                  </div>

                  {/* Ergonomic 3-Column Touch Zone Layout */}
                  <div className="flex-1 grid grid-cols-[110px_1fr_110px] gap-3 py-3 items-stretch">
                    
                    {/* Left Thumb Plunger (Clickable) */}
                    <button
                      onClick={onToggleStartStop}
                      className={`rounded-2xl p-3 flex flex-col items-center justify-between transition-transform active:scale-95 shadow-lg border-t border-white/40 ${
                        isRunning 
                          ? 'bg-gradient-to-b from-red-500 to-red-700 shadow-red-500/30' 
                          : 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-emerald-500/30'
                      }`}
                    >
                      <div className="w-8 flex flex-col gap-1 opacity-50">
                        <div className="h-0.5 rounded-full bg-white" />
                        <div className="h-0.5 rounded-full bg-white" />
                        <div className="h-0.5 rounded-full bg-white" />
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-black font-mono text-white">{isRunning ? 'STOP' : 'START'}</div>
                        <div className="text-[9px] font-bold text-white/80">{isRunning ? 'WHISTLE' : 'IN PLAY'}</div>
                      </div>
                      <span className="text-[9px] font-mono text-white/60">LEFT THUMB</span>
                    </button>

                    {/* Center Instrument Displays */}
                    <div className="flex flex-col justify-around bg-black/40 rounded-xl p-3 border border-white/10 text-center">
                      <div>
                        <div className="text-[9px] font-mono text-neutral-400">MASTER GAME CLOCK</div>
                        <div className="text-4xl font-black font-mono text-white tabular-nums tracking-tight">
                          {gameTimeFormatted}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-[9px] font-mono text-neutral-400">SHOT CLOCK (WP 20.15)</div>
                        <div className={`text-5xl font-black font-mono tabular-nums leading-none ${
                          isBlanked ? 'text-neutral-700' : (shotSec <= 5 ? 'text-red-500 animate-pulse' : 'text-amber-400')
                        }`}>
                          {shotDisplay}
                        </div>
                      </div>
                    </div>

                    {/* Right Thumb Dual Resets (Clickable) */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={onReset30}
                        className="flex-1 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 text-white flex flex-col items-center justify-center p-2 border-t border-white/40 shadow active:scale-95 transition-transform"
                      >
                        <span className="text-2xl font-black font-mono leading-none">30</span>
                        <span className="text-[9px] font-bold">RESET 30</span>
                      </button>
                      <button
                        onClick={onReset20}
                        className="flex-1 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 text-white flex flex-col items-center justify-center p-2 border-t border-white/40 shadow active:scale-95 transition-transform"
                      >
                        <span className="text-2xl font-black font-mono leading-none">20</span>
                        <span className="text-[9px] font-bold">RESET 20</span>
                      </button>
                    </div>

                  </div>

                  {/* Bottom System Bar */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 pt-2 border-t border-white/10">
                    <span>iPad Pro 11" &bull; High-Contrast Deck Mode</span>
                    <span className="text-cyan-400">BLE Linked: 0.4ms Latency</span>
                  </div>
                </div>
              </div>

              {/* Right Hand Silhouette / Grip Simulation */}
              <div className="w-16 h-72 rounded-r-3xl bg-neutral-800/80 border-r border-y border-white/10 flex flex-col items-center justify-center shadow-2xl relative z-0 -ml-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 rotate-90 whitespace-nowrap">
                  RIGHT HAND GRIP
                </span>
                <div className="absolute top-1/2 -translate-y-1/2 left-2 w-6 h-14 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-[9px] font-bold text-amber-300">
                  THUMB
                </div>
              </div>

            </div>

            <div className="mt-4 text-center">
              <span className="text-xs font-mono text-neutral-400">
                Thumb Reachability Index: <strong>100% Zero-Regrip Coverage</strong> on poolside iPad
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 2: POLOBRIDGE HARDWARE DONGLE (INDUSTRIAL DESIGN) */}
        {/* ========================================================= */}
        {selectedMockup === 'dongle' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            
            {/* Dongle Showcase Stage */}
            <div className="w-full rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-10 shadow-2xl relative flex flex-col items-center">
              
              {/* Product Badge */}
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-xs font-bold text-white">PB</div>
                <div>
                  <div className="text-xs font-black tracking-widest text-white uppercase">PoloBridge Dongle Pro</div>
                  <div className="text-[10px] font-mono text-neutral-500">Model: PB-S3-MAX • Rev C</div>
                </div>
              </div>

              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                IP67 SEALED &bull; ENIG GOLD
              </div>

              {/* Hardware Device Graphic */}
              <div className="my-10 relative flex items-center justify-center">
                
                {/* 1/4" Mono Phone Jack Plug Extrusion (Gold plated) */}
                <div className="w-28 h-6 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 rounded-l-md border-y border-amber-200 shadow-lg relative flex items-center">
                  <div className="absolute right-3 w-1.5 h-full bg-black/60" />
                  <div className="absolute left-6 w-2 h-full bg-black/60" />
                  <span className="text-[8px] font-mono font-bold text-amber-950 px-2 uppercase">1/4" TS Phono</span>
                </div>

                {/* Main Aluminum Body Enclosure */}
                <div className="w-72 h-44 rounded-2xl bg-gradient-to-b from-[#1b202c] via-[#10141e] to-[#0a0d14] border-2 border-white/20 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col justify-between relative overflow-hidden">
                  
                  {/* Subtle chamfered edge light */}
                  <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />

                  {/* Top Header of Device */}
                  <div className="flex justify-between items-center z-10">
                    <span className="text-xs font-black tracking-widest text-white font-mono">POLOBRIDGE</span>
                    <span className="text-[9px] font-mono text-neutral-400">ESP32-S3</span>
                  </div>

                  {/* Status LEDs & Micro Graphic */}
                  <div className="flex items-center justify-around py-3 z-10 bg-black/30 rounded-xl border border-white/5">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
                      <span className="text-[8px] font-mono text-neutral-400">BLE 5.0</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24]" />
                      <span className="text-[8px] font-mono text-neutral-400">CTS RS232</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                      <span className="text-[8px] font-mono text-neutral-400">2.5kV ISO</span>
                    </div>
                  </div>

                  {/* Bottom Branding / Specs */}
                  <div className="flex justify-between items-end text-[9px] font-mono text-neutral-500 z-10">
                    <span>9600-8-E-1 &bull; CTS/WA-3</span>
                    <span>USB-C PD 5V</span>
                  </div>
                </div>

                {/* Sub-GHz Rubberized Antenna */}
                <div className="w-5 h-36 bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-t-full border border-neutral-700 shadow-xl relative -ml-1 flex flex-col items-center justify-around py-2">
                  <div className="w-full h-0.5 bg-neutral-950" />
                  <div className="w-full h-0.5 bg-neutral-950" />
                  <div className="w-full h-0.5 bg-neutral-950" />
                  <span className="text-[7px] font-mono text-neutral-400 -rotate-90">915MHz</span>
                </div>

              </div>

              {/* Hardware Spec Callouts */}
              <div className="grid grid-cols-3 gap-4 w-full pt-6 border-t border-white/10 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Zap size={13} className="text-cyan-400" />
                    <span>Galvanic Isolation</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    2.5kV isolation eliminates 15V AC pool pump ground ripple.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Shield size={13} className="text-amber-400" />
                    <span>Trichloramine Proof</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    MG Chemicals 419D silicone conformal coating prevents chlorine gas rot.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Radio size={13} className="text-emerald-400" />
                    <span>Zero Lag Link</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Sub-2ms wireless latency for instant referee whistle synchronization.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 3: GOAL-MOUNTED PHYSICAL LED SHOT CLOCK (SC-500)   */}
        {/* ========================================================= */}
        {selectedMockup === 'shotclock' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            
            {/* Outdoor Aquatic Goal Perspective */}
            <div className="w-full h-[460px] rounded-3xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/40 via-[#070b14] to-black border-2 border-white/10 p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between items-center">
              
              {/* Pool Lane & Water Wave Graphic Background */}
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-cyan-600/20 to-transparent" />

              {/* Goal Crossbar Strut Frame */}
              <div className="relative z-10 flex flex-col items-center mt-2">
                
                {/* Physical Colorado SC-500 Heavy Duty Enclosure */}
                <div className="w-96 rounded-2xl bg-black border-4 border-neutral-700 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center relative">
                  
                  {/* Amber High-Intensity Shot Clock Numeral */}
                  <div className="text-[10px] font-mono font-black text-neutral-500 tracking-widest mb-1 uppercase">
                    COLORADO TIME SYSTEMS &bull; SC-500
                  </div>

                  <div className="w-full rounded-xl bg-[#030406] border-2 border-neutral-900 p-5 flex flex-col items-center">
                    <div className={`text-9xl font-mono font-black tabular-nums tracking-widest leading-none ${
                      isBlanked
                        ? 'text-neutral-900'
                        : (shotSec <= 5 
                            ? 'text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.9)] animate-pulse' 
                            : 'text-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.8)]')
                    }`}>
                      {shotDisplay}
                    </div>
                  </div>

                  {/* Game Clock Mini Secondary Display */}
                  <div className="w-full flex justify-between items-center mt-3 pt-3 border-t border-neutral-800 text-xs font-mono">
                    <span className="text-neutral-400">GAME: <strong className="text-cyan-400">{gameTimeFormatted}</strong></span>
                    <span className="text-neutral-400">PERIOD: <strong className="text-amber-400">{period}</strong></span>
                    <span className="text-emerald-400 font-bold">CTS SYNC</span>
                  </div>
                </div>

                {/* Heavy Duty Stainless Steel Goal Mounting Mast */}
                <div className="w-4 h-16 bg-gradient-to-r from-neutral-400 via-neutral-200 to-neutral-500 shadow-lg" />

                {/* Red Water Polo Goal Cage Crossbar */}
                <div className="w-[500px] h-6 bg-gradient-to-b from-red-500 to-red-700 rounded-full border border-red-400 shadow-xl flex items-center justify-center">
                  <span className="text-[9px] font-mono text-white/80 font-bold tracking-widest">
                    GOAL CAGE CROSSBAR (3.00m WIDTH)
                  </span>
                </div>
              </div>

              {/* Water Reflection Surface */}
              <div className="relative z-10 w-full text-center">
                <div className="text-xs font-mono text-cyan-300 font-bold">
                  Rule WP 20.15 Compliant: Automatic Shot Clock Blanking Above Goal
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 4: TELEVISION BROADCAST SCOREBUG (OBS / HUDL)      */}
        {/* ========================================================= */}
        {selectedMockup === 'broadcast' && (
          <div className="w-full max-w-4xl flex flex-col items-center">
            
            {/* 16:9 Broadcast Monitor Frame */}
            <div className="w-full aspect-video rounded-3xl bg-neutral-950 border-4 border-neutral-800 shadow-2xl relative overflow-hidden flex flex-col justify-between p-6">
              
              {/* Simulated Water Polo Game Action Scene Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-sky-950 to-neutral-950 opacity-90" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(14,165,233,0.3)_0%,transparent_60%)] pointer-events-none" />

              {/* TV Channel Bug & Live Tag (Top Left) */}
              <div className="relative z-10 flex items-center justify-between">
                
                {/* Official Broadcast Scorebug */}
                <div className="h-12 rounded-xl bg-[#080b12]/95 border border-white/20 shadow-2xl flex items-center overflow-hidden font-mono text-xs backdrop-blur-md">
                  {/* Tournament Logo */}
                  <div className="px-3 bg-blue-600 text-white font-black text-sm h-full flex items-center">
                    WP
                  </div>

                  {/* Team White */}
                  <div className="flex items-center gap-2 px-3 bg-white/10 h-full">
                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow" />
                    <span className="font-extrabold text-white">{teamWhiteName.substring(0, 3).toUpperCase()}</span>
                    <span className="text-lg font-black text-white px-2 rounded bg-black/40">{scoreWhite}</span>
                  </div>

                  {/* Period */}
                  <div className="px-2.5 font-bold text-neutral-400 h-full flex items-center bg-black/50">
                    Q{period}
                  </div>

                  {/* Team Dark */}
                  <div className="flex items-center gap-2 px-3 bg-blue-950/60 h-full">
                    <span className="text-lg font-black text-blue-400 px-2 rounded bg-black/40">{scoreDark}</span>
                    <span className="font-extrabold text-blue-400">{teamDarkName.substring(0, 3).toUpperCase()}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow" />
                  </div>

                  {/* Game Clock */}
                  <div className="px-3 font-black text-cyan-400 text-sm h-full flex items-center bg-black/80">
                    {gameTimeFormatted.split('.')[0]}
                  </div>

                  {/* Shot Clock */}
                  <div className={`px-3 font-black text-sm h-full flex items-center ${
                    isBlanked ? 'text-neutral-700 bg-black' : (shotSec <= 5 ? 'text-red-500 bg-red-950/80 animate-pulse' : 'text-amber-400 bg-amber-950/60')
                  }`}>
                    :{isBlanked ? '--' : `${shotSec}`}
                  </div>
                </div>

                {/* Broadcast Live Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black tracking-wider uppercase shadow-lg shadow-red-600/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>LIVE HUDL STREAM</span>
                </div>
              </div>

              {/* Lower Third Water Polo Scene Context */}
              <div className="relative z-10 flex justify-between items-end text-xs text-neutral-300 font-mono">
                <div className="p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 max-w-sm">
                  <div className="text-cyan-400 font-bold uppercase text-[10px]">Active Possession Event</div>
                  <div>Powerplay 6-on-5 &bull; Man-Up Advantage</div>
                </div>

                <div className="text-right text-[11px] text-neutral-400">
                  <div>1080p60 &bull; NDI / OBS Browser Source Ready</div>
                  <div className="text-neutral-500">http://ipad-ip:8080/overlay</div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
