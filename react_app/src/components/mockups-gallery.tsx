import React, { useState } from 'react';
import { 
  Tablet, Cpu, Eye, Tv, Shield, Radio, Volume2, 
  ExternalLink, Sparkles, CheckCircle2, Zap, AlertCircle,
  Camera, Image as ImageIcon, Download, Layers
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

type ShowcaseMode = 'renders' | 'ipad' | 'dongle' | 'pcb' | 'shotclock' | 'broadcast';

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
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-mono font-bold text-cyan-200 uppercase tracking-wider shrink-0">
            Mockup View:
          </span>
          <div className="flex p-0.5 rounded-xl bg-sky-900/60 border border-cyan-400/30 text-xs">
            {[
              { id: 'renders', label: '4K Studio Renders (3)', icon: Camera },
              { id: 'ipad', label: 'Handheld iPad in Case', icon: Tablet },
              { id: 'dongle', label: 'Hardware Dongle (3D)', icon: Cpu },
              { id: 'pcb', label: 'Isolated PCB Blueprint', icon: Layers },
              { id: 'shotclock', label: 'Goal SC-500 Display', icon: Eye },
              { id: 'broadcast', label: 'Television Broadcast Bug', icon: Tv },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedMockup === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMockup(tab.id as ShowcaseMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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

        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-cyan-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Industrial &amp; UI Design Suite</span>
        </div>
      </div>

      {/* Main Canvas Display Area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-y-auto">
        
        {/* ========================================================= */}
        {/* MOCKUP 0: PHOTOREALISTIC COMMERCIAL STUDIO RENDERS        */}
        {/* ========================================================= */}
        {selectedMockup === 'renders' && (
          <div className="w-full max-w-6xl space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>PoloBridge Official Product Photography &amp; Engineering Kit</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-300/40">
                    3 High-Res Studio Assets
                  </span>
                </h2>
                <p className="text-xs text-sky-200 mt-1">
                  Commercial marketing photography and hardware teardown renders for athletic directors, coaches, and hardware builders.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Image Card 1: Open PCB + iPad Workbench Kit Render */}
              <div className="rounded-3xl bg-gradient-to-b from-sky-800/80 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between group hover:border-amber-300 transition">
                <div className="rounded-2xl overflow-hidden border border-cyan-300/30 aspect-[4/3] bg-sky-950 relative mb-4">
                  <img 
                    src="./assets/polobridge_kit_exploded_render.jpg" 
                    alt="PoloBridge Pro Open PCB & iPad Poolside Kit"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-sky-950/85 backdrop-blur-md text-[10px] font-mono text-amber-200 font-bold border border-amber-400/40">
                    ENIG PCB Teardown &bull; Poolside Kit
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">Complete Hardware Kit &amp; iPad</span>
                    <span className="text-xs font-mono text-amber-300 font-bold">PB-S3-ISO</span>
                  </div>
                  <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                    Open CNC marine-blue enclosure revealing the ENIG gold-plated PCB, ESP32-S3 MCU, ADM3251E 2.5kV isolator, Neutrik 1/4&quot; plug, and rugged iPad console.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-cyan-400/25 flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300">polobridge_kit_exploded_render.jpg</span>
                  <a 
                    href="./assets/polobridge_kit_exploded_render.jpg" 
                    download="polobridge_kit_exploded_render.jpg"
                    className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-bold"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                </div>
              </div>

              {/* Image Card 2: Hardware Dongle Studio Render */}
              <div className="rounded-3xl bg-gradient-to-b from-sky-800/80 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between group hover:border-cyan-300 transition">
                <div className="rounded-2xl overflow-hidden border border-cyan-300/30 aspect-[4/3] bg-sky-950 relative mb-4">
                  <img 
                    src="./assets/polobridge_hardware_dongle.jpg" 
                    alt="PoloBridge Hardware Dongle Commercial Render"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-sky-950/85 backdrop-blur-md text-[10px] font-mono text-cyan-100 font-bold border border-cyan-400/40">
                    Industrial CNC Aluminum &bull; ENIG Gold
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">PoloBridge Wireless Dongle</span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">Model PB-S3</span>
                  </div>
                  <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                    Rugged anodized aluminum chassis with 2.5kV galvanic isolation, laser-engraved typography, gold-plated 1/4&quot; CTS mono phono plug, and Sub-GHz RF antenna.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-cyan-400/25 flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300">polobridge_hardware_dongle.jpg</span>
                  <a 
                    href="./assets/polobridge_hardware_dongle.jpg" 
                    download="polobridge_hardware_dongle.jpg"
                    className="flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 font-bold"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                </div>
              </div>

              {/* Image Card 3: Handheld Deck Action POV */}
              <div className="rounded-3xl bg-gradient-to-b from-sky-800/80 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between group hover:border-emerald-300 transition">
                <div className="rounded-2xl overflow-hidden border border-cyan-300/30 aspect-[4/3] bg-sky-950 relative mb-4">
                  <img 
                    src="./assets/polobridge_deck_operator_pov.jpg" 
                    alt="PoloPad Handheld iPad Deck Action POV"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-sky-950/85 backdrop-blur-md text-[10px] font-mono text-cyan-100 font-bold border border-cyan-400/40">
                    Poolside Operator POV &bull; Olympic Pool
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">PoloPad Handheld iPad Console</span>
                    <span className="text-xs font-mono text-emerald-300 font-bold">Dual-Thumb Grip</span>
                  </div>
                  <p className="text-xs text-sky-100/90 mt-1 leading-relaxed">
                    In-context match action shot at an Olympic 50m pool facility. Two-handed ergonomic grip demonstrating thumb placement over giant Start/Stop and Reset buttons.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-cyan-400/25 flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300">polobridge_deck_operator_pov.jpg</span>
                  <a 
                    href="./assets/polobridge_deck_operator_pov.jpg" 
                    download="polobridge_deck_operator_pov.jpg"
                    className="flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-bold"
                  >
                    <Download size={13} />
                    <span>Download</span>
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
            <div className="absolute -inset-10 bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-transparent blur-3xl pointer-events-none" />

            {/* Two-Handed Grip Frame Container */}
            <div className="relative flex items-center">
              
              {/* Left Hand Silhouette / Grip Simulation */}
              <div className="w-16 h-72 rounded-l-3xl bg-sky-950/90 border-l border-y border-cyan-400/40 flex flex-col items-center justify-center shadow-2xl relative z-0 -mr-3">
                <span className="text-[10px] font-mono font-bold text-cyan-200 -rotate-90 whitespace-nowrap">
                  LEFT HAND GRIP
                </span>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-14 rounded-full bg-cyan-400/25 border border-cyan-300/50 flex items-center justify-center text-[9px] font-bold text-cyan-200">
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
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] to-transparent pointer-events-none" />

                  {/* Header Bar */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-cyan-400/20">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-xs">PoloPad Pro iOS</span>
                      <span className="text-[10px] text-cyan-300 font-mono">Q{period}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-white">{teamWhiteName}: {scoreWhite}</span>
                      <span className="text-cyan-400">&bull;</span>
                      <span className="text-cyan-300">{teamDarkName}: {scoreDark}</span>
                    </div>
                  </div>

                  {/* Ergonomic 3-Column Touch Zone Layout */}
                  <div className="flex-1 grid grid-cols-[110px_1fr_110px] gap-3 py-3 items-stretch">
                    
                    {/* Left Thumb Plunger (Clickable) */}
                    <button
                      onClick={onToggleStartStop}
                      className={`rounded-2xl p-3 flex flex-col items-center justify-between transition-transform active:scale-95 shadow-lg border-t border-white/40 cursor-pointer ${
                        isRunning 
                          ? 'bg-gradient-to-b from-rose-500 to-red-700 shadow-rose-500/30' 
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
                      <span className="text-[9px] font-mono text-white/70">LEFT THUMB</span>
                    </button>

                    {/* Center Instrument Displays */}
                    <div className="flex flex-col justify-around bg-sky-950/85 rounded-xl p-3 border border-cyan-400/30 text-center shadow-inner">
                      <div>
                        <div className="text-[9px] font-mono text-cyan-200">MASTER GAME CLOCK</div>
                        <div className="text-4xl font-black font-mono text-white tabular-nums tracking-tight">
                          {gameTimeFormatted}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-cyan-400/20">
                        <div className="text-[9px] font-mono text-amber-200">SHOT CLOCK (WP 20.15)</div>
                        <div className={`text-5xl font-black font-mono tabular-nums leading-none ${
                          isBlanked ? 'text-sky-700' : (shotSec <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-300')
                        }`}>
                          {shotDisplay}
                        </div>
                      </div>
                    </div>

                    {/* Right Thumb Dual Resets (Clickable) */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={onReset30}
                        className="flex-1 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white flex flex-col items-center justify-center p-2 border-t border-white/40 shadow active:scale-95 transition-transform cursor-pointer"
                      >
                        <span className="text-2xl font-black font-mono leading-none">30</span>
                        <span className="text-[9px] font-bold">RESET 30</span>
                      </button>
                      <button
                        onClick={onReset20}
                        className="flex-1 rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-white flex flex-col items-center justify-center p-2 border-t border-white/40 shadow active:scale-95 transition-transform cursor-pointer"
                      >
                        <span className="text-2xl font-black font-mono leading-none">20</span>
                        <span className="text-[9px] font-bold">RESET 20</span>
                      </button>
                    </div>

                  </div>

                  {/* Bottom System Bar */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-cyan-200/80 pt-2 border-t border-cyan-400/20">
                    <span>iPad Pro 11&quot; &bull; Sunlit Aquatic Deck Mode</span>
                    <span className="text-emerald-300">BLE Linked: 1.8ms Latency</span>
                  </div>
                </div>
              </div>

              {/* Right Hand Silhouette / Grip Simulation */}
              <div className="w-16 h-72 rounded-r-3xl bg-sky-950/90 border-r border-y border-cyan-400/40 flex flex-col items-center justify-center shadow-2xl relative z-0 -ml-3">
                <span className="text-[10px] font-mono font-bold text-cyan-200 rotate-90 whitespace-nowrap">
                  RIGHT HAND GRIP
                </span>
                <div className="absolute top-1/2 -translate-y-1/2 left-2 w-6 h-14 rounded-full bg-amber-400/25 border border-amber-300/50 flex items-center justify-center text-[9px] font-bold text-amber-200">
                  THUMB
                </div>
              </div>

            </div>

            <div className="mt-4 text-center">
              <span className="text-xs font-mono text-cyan-200">
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
                <div className="w-6 h-6 rounded-md bg-cyan-500 flex items-center justify-center text-xs font-bold text-sky-950">PB</div>
                <div>
                  <div className="text-xs font-black tracking-widest text-white uppercase">PoloBridge Dongle Pro</div>
                  <div className="text-[10px] font-mono text-cyan-200">Model: PB-S3-ISO &bull; Rev C</div>
                </div>
              </div>

              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-bold">
                IP67 SEALED &bull; ENIG GOLD
              </div>

              {/* Hardware Device Graphic */}
              <div className="my-10 relative flex items-center justify-center">
                
                {/* 1/4" Mono Phone Jack Plug Extrusion (Gold plated) */}
                <div className="w-28 h-6 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 rounded-l-md border-y border-amber-200 shadow-lg relative flex items-center">
                  <div className="absolute right-3 w-1.5 h-full bg-sky-950/70" />
                  <div className="absolute left-6 w-2 h-full bg-sky-950/70" />
                  <span className="text-[8px] font-mono font-bold text-amber-950 px-2 uppercase">1/4&quot; TS Phono</span>
                </div>

                {/* Main Anodized Marine Aluminum Body Enclosure */}
                <div className="w-72 h-44 rounded-2xl bg-gradient-to-b from-sky-700 via-blue-900 to-indigo-950 border-2 border-cyan-300/50 p-5 shadow-[0_20px_50px_rgba(6,182,212,0.4)] flex flex-col justify-between relative overflow-hidden">
                  
                  {/* Subtle chamfered edge light */}
                  <div className="absolute inset-0 border border-white/20 rounded-2xl pointer-events-none" />

                  {/* Top Header of Device */}
                  <div className="flex justify-between items-center z-10">
                    <span className="text-xs font-black tracking-widest text-white font-mono">POLOBRIDGE PRO</span>
                    <span className="text-[9px] font-mono text-cyan-200">ESP32-S3</span>
                  </div>

                  {/* Status LEDs & Micro Graphic */}
                  <div className="flex items-center justify-around py-3 z-10 bg-sky-950/80 rounded-xl border border-cyan-400/30">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
                      <span className="text-[8px] font-mono text-cyan-200">BLE 5.0</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24]" />
                      <span className="text-[8px] font-mono text-amber-200">CTS RS232</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                      <span className="text-[8px] font-mono text-emerald-200">2.5kV ISO</span>
                    </div>
                  </div>

                  {/* Bottom Branding / Specs */}
                  <div className="flex justify-between items-end text-[9px] font-mono text-cyan-200 z-10">
                    <span>9600-8-E-1 &bull; CTS/WA-3</span>
                    <span>USB-C PD 5V</span>
                  </div>
                </div>

                {/* Sub-GHz Rubberized Antenna */}
                <div className="w-5 h-36 bg-gradient-to-r from-sky-900 to-indigo-950 rounded-t-full border border-cyan-400/50 shadow-xl relative -ml-1 flex flex-col items-center justify-around py-2">
                  <div className="w-full h-0.5 bg-cyan-400/40" />
                  <div className="w-full h-0.5 bg-cyan-400/40" />
                  <div className="w-full h-0.5 bg-cyan-400/40" />
                  <span className="text-[7px] font-mono text-cyan-200 -rotate-90">915MHz</span>
                </div>

              </div>

              {/* Hardware Spec Callouts */}
              <div className="grid grid-cols-3 gap-4 w-full pt-6 border-t border-cyan-400/30 text-xs">
                <div className="p-3 rounded-xl bg-sky-950/70 border border-cyan-400/30">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Zap size={13} className="text-cyan-300" />
                    <span>Galvanic Isolation</span>
                  </div>
                  <p className="text-[11px] text-sky-200 mt-1">
                    2.5kV isolation eliminates 15V AC pool pump ground ripple.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-sky-950/70 border border-cyan-400/30">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Shield size={13} className="text-amber-300" />
                    <span>Trichloramine Proof</span>
                  </div>
                  <p className="text-[11px] text-sky-200 mt-1">
                    MG Chemicals 419D conformal coating prevents chlorine gas rot.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-sky-950/70 border border-cyan-400/30">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Radio size={13} className="text-emerald-300" />
                    <span>Zero Lag Link</span>
                  </div>
                  <p className="text-[11px] text-sky-200 mt-1">
                    Sub-2ms wireless latency for instant referee whistle synchronization.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 3: ISOLATED 4-LAYER PCB CAD BLUEPRINT              */}
        {/* ========================================================= */}
        {selectedMockup === 'pcb' && (
          <div className="w-full max-w-4xl flex flex-col items-center">
            <div className="w-full rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-cyan-400/30 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white">
                    PB-S3-ISO Custom 4-Layer ENIG PCB Layout &amp; Isolation Barrier
                  </h2>
                  <p className="text-xs text-cyan-200">
                    76mm &times; 50mm slide-in card for Hammond 1455C801BU enclosure with 4.0mm milled creepage slot.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-mono font-bold">
                  2.5kV RMS Creepage Zone
                </span>
              </div>

              {/* Interactive PCB Visual Diagram */}
              <div className="rounded-2xl bg-gradient-to-r from-emerald-900/90 via-teal-900/95 to-emerald-950/95 border-4 border-amber-400/60 p-6 shadow-inner relative overflow-hidden">
                <div className="grid grid-cols-[1.15fr_48px_1fr] gap-4 items-stretch min-h-[250px]">
                  
                  {/* Logic Domain (Left of Isolation Trench) */}
                  <div className="rounded-xl bg-sky-950/80 border border-cyan-400/40 p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 font-bold">
                      <span>LOGIC DOMAIN (3.3V / USB-C)</span>
                      <span>GND1</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 my-3">
                      <div className="p-3 rounded-lg bg-sky-900/90 border border-cyan-300/50 text-center">
                        <div className="text-xs font-black font-mono text-white">ESP32-S3-WROOM</div>
                        <div className="text-[9px] font-mono text-cyan-200 mt-1">BLE 5.0 + 10Hz UART1</div>
                      </div>
                      <div className="p-3 rounded-lg bg-sky-900/90 border border-emerald-300/50 text-center">
                        <div className="text-xs font-black font-mono text-emerald-300">SX1262 915MHz</div>
                        <div className="text-[9px] font-mono text-cyan-200 mt-1">Sub-GHz LoRa/FSK</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-sky-200 flex justify-between">
                      <span>USB-C 5V Input + TP4056 LiPo</span>
                      <span>GPIO 17 (TX) / GPIO 4 (Opto)</span>
                    </div>
                  </div>

                  {/* 2.5kV Milled Isolation Barrier */}
                  <div className="rounded-xl bg-amber-400/20 border-2 border-dashed border-amber-300 flex flex-col items-center justify-around py-2">
                    <span className="text-[9px] font-mono font-black text-amber-200 -rotate-90 whitespace-nowrap">
                      ADM3251E 2.5kV ISO
                    </span>
                    <span className="text-[9px] font-mono font-black text-emerald-200 -rotate-90 whitespace-nowrap">
                      PC817 5kV OPTO
                    </span>
                  </div>

                  {/* Field RS-232 Domain (Right of Isolation Trench) */}
                  <div className="rounded-xl bg-indigo-950/85 border border-amber-400/40 p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-300 font-bold">
                      <span>FIELD DECK DOMAIN (±12V RS-232)</span>
                      <span>ISO GND2</span>
                    </div>
                    <div className="space-y-2.5 my-3">
                      <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-300/50 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-200">MAX3232E + TVS Diodes</span>
                        <span className="text-[10px] font-mono text-white">±15kV ESD</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-400/30 border border-amber-200/60 flex items-center justify-between">
                        <span className="text-xs font-mono font-black text-white">Neutrik NRJ6HM-1 Gold</span>
                        <span className="text-[10px] font-mono text-amber-100">1/4&quot; TS Main + Pickle</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-amber-200">
                      Direct to CTS WA-3 / System 6 / Deck Plate
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 4: GOAL-MOUNTED PHYSICAL LED SHOT CLOCK (SC-500)   */}
        {/* ========================================================= */}
        {selectedMockup === 'shotclock' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            
            {/* Outdoor Aquatic Goal Perspective */}
            <div className="w-full h-[460px] rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/95 to-indigo-950 border-2 border-cyan-400/40 p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between items-center">
              
              {/* Pool Lane & Water Wave Graphic Background */}
              <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
              <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-cyan-400/30 to-transparent" />

              {/* Goal Crossbar Strut Frame */}
              <div className="relative z-10 flex flex-col items-center mt-2">
                
                {/* Physical Colorado SC-500 Heavy Duty Enclosure */}
                <div className="w-96 rounded-2xl bg-gradient-to-b from-sky-950 to-indigo-950 border-4 border-cyan-400/50 p-6 shadow-[0_20px_60px_rgba(6,182,212,0.45)] flex flex-col items-center relative">
                  
                  {/* Amber High-Intensity Shot Clock Numeral */}
                  <div className="text-[10px] font-mono font-black text-cyan-200 tracking-widest mb-1 uppercase">
                    COLORADO TIME SYSTEMS &bull; SC-500
                  </div>

                  <div className="w-full rounded-xl bg-sky-950/95 border-2 border-cyan-400/30 p-5 flex flex-col items-center shadow-inner">
                    <div className={`text-9xl font-mono font-black tabular-nums tracking-widest leading-none ${
                      isBlanked
                        ? 'text-sky-900/50'
                        : (shotSec <= 5 
                            ? 'text-rose-400 drop-shadow-[0_0_40px_rgba(244,63,94,0.9)] animate-pulse' 
                            : 'text-amber-300 drop-shadow-[0_0_35px_rgba(251,191,36,0.8)]')
                    }`}>
                      {shotDisplay}
                    </div>
                  </div>

                  {/* Game Clock Mini Secondary Display */}
                  <div className="w-full flex justify-between items-center mt-3 pt-3 border-t border-cyan-400/25 text-xs font-mono">
                    <span className="text-sky-200">GAME: <strong className="text-cyan-300">{gameTimeFormatted}</strong></span>
                    <span className="text-sky-200">PERIOD: <strong className="text-amber-300">{period}</strong></span>
                    <span className="text-emerald-300 font-bold">CTS SYNC</span>
                  </div>
                </div>

                {/* Heavy Duty Stainless Steel Goal Mounting Mast */}
                <div className="w-4 h-16 bg-gradient-to-r from-cyan-200 via-white to-sky-300 shadow-lg" />

                {/* Red Water Polo Goal Cage Crossbar */}
                <div className="w-[500px] h-6 bg-gradient-to-b from-rose-500 to-red-700 rounded-full border border-rose-300 shadow-xl flex items-center justify-center">
                  <span className="text-[9px] font-mono text-white font-bold tracking-widest">
                    GOAL CAGE CROSSBAR (3.00m WIDTH)
                  </span>
                </div>
              </div>

              {/* Water Reflection Surface */}
              <div className="relative z-10 w-full text-center">
                <div className="text-xs font-mono text-cyan-200 font-bold">
                  Rule WP 20.15 Compliant: Automatic Shot Clock Blanking Above Goal
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MOCKUP 5: TELEVISION BROADCAST SCOREBUG (OBS / HUDL)      */}
        {/* ========================================================= */}
        {selectedMockup === 'broadcast' && (
          <div className="w-full max-w-4xl flex flex-col items-center">
            
            {/* 16:9 Broadcast Monitor Frame */}
            <div className="w-full aspect-video rounded-3xl bg-gradient-to-br from-sky-800 via-blue-900 to-indigo-950 border-4 border-cyan-400/50 shadow-2xl relative overflow-hidden flex flex-col justify-between p-6">
              
              {/* Simulated Water Polo Game Action Scene Background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(34,211,238,0.35)_0%,transparent_65%)] pointer-events-none" />

              {/* TV Channel Bug & Live Tag (Top Left) */}
              <div className="relative z-10 flex items-center justify-between">
                
                {/* Official Broadcast Scorebug */}
                <div className="h-12 rounded-xl bg-sky-950/95 border border-cyan-300/50 shadow-2xl flex items-center overflow-hidden font-mono text-xs backdrop-blur-md">
                  {/* Tournament Logo */}
                  <div className="px-3 bg-gradient-to-b from-cyan-400 to-blue-600 text-sky-950 font-black text-sm h-full flex items-center">
                    6-8 WP
                  </div>

                  {/* Team White */}
                  <div className="flex items-center gap-2 px-3 bg-white/15 h-full">
                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow" />
                    <span className="font-extrabold text-white">{teamWhiteName.substring(0, 4).toUpperCase()}</span>
                    <span className="text-lg font-black text-white px-2 rounded bg-sky-900/80">{scoreWhite}</span>
                  </div>

                  {/* Period */}
                  <div className="px-2.5 font-bold text-cyan-200 h-full flex items-center bg-sky-900/90">
                    Q{period}
                  </div>

                  {/* Team Dark */}
                  <div className="flex items-center gap-2 px-3 bg-indigo-900/80 h-full">
                    <span className="text-lg font-black text-cyan-300 px-2 rounded bg-sky-950/80">{scoreDark}</span>
                    <span className="font-extrabold text-cyan-200">{teamDarkName.substring(0, 4).toUpperCase()}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow" />
                  </div>

                  {/* Game Clock */}
                  <div className="px-3 font-black text-cyan-300 text-sm h-full flex items-center bg-sky-950/95">
                    {gameTimeFormatted.split('.')[0]}
                  </div>

                  {/* Shot Clock */}
                  <div className={`px-3 font-black text-sm h-full flex items-center ${
                    isBlanked ? 'text-sky-700 bg-sky-950' : (shotSec <= 5 ? 'text-rose-300 bg-rose-600/80 animate-pulse' : 'text-amber-300 bg-amber-600/40')
                  }`}>
                    :{isBlanked ? '--' : `${shotSec}`}
                  </div>
                </div>

                {/* Broadcast Live Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wider uppercase shadow-lg shadow-rose-600/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>LIVE HUDL / NFHS STREAM</span>
                </div>
              </div>

              {/* Lower Third Water Polo Scene Context */}
              <div className="relative z-10 flex justify-between items-end text-xs text-cyan-100 font-mono">
                <div className="p-3 rounded-xl bg-sky-950/80 backdrop-blur-md border border-cyan-400/30 max-w-sm">
                  <div className="text-amber-300 font-bold uppercase text-[10px]">Active Possession Telemetry</div>
                  <div>Powerplay 6-on-5 &bull; 6-8 Sports Live Feed Linked</div>
                </div>

                <div className="text-right text-[11px] text-cyan-200">
                  <div>1080p60 &bull; NDI / OBS Browser Source Ready</div>
                  <div className="text-sky-300">http://ipad-ip:8080/?overlay=1</div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
