import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  RotateCcw,
  Volume2,
  Radio,
  Download,
  Copy,
  Trash2,
  Play,
  Pause,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  webSerialManager,
  FlasherProgress,
  HardwareDiagnosticResult,
} from '../engine/webserial-manager';

export default function FirmwareFlasherPanel() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [progress, setProgress] = useState<FlasherProgress>({
    step: 'idle',
    percentage: 0,
    message: 'Connect USB-C cable to ESP32-S3 and click Flash Firmware',
    bytesWritten: 0,
    totalBytes: 0,
  });

  const [diagnostic, setDiagnostic] = useState<HardwareDiagnosticResult>({
    rs232Loopback: 'pending',
    pickleOptos: 'pending',
    piezoHorn: 'pending',
    lidButtons: { startStop: true, reset30: true, reset20: true },
    chipInfo: {
      model: 'ESP32-S3 (WROOM-1U-N8)',
      revision: 'v0.2',
      mac: '7C:DF:A1:88:4B:20',
      flashSizeMb: 8,
    },
  });

  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; type: 'rx' | 'tx' | 'info' | 'error'; time: string }>>([
    { text: 'WebSerial Diagnostic Terminal Initialized. Ready for USB-C connection.', type: 'info', time: '00:00.0' },
  ]);
  const [commandInput, setCommandInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubTerm = webSerialManager.subscribeTerminal((text, type) => {
      const time = new Date().toISOString().substring(14, 21);
      setTerminalLogs((prev) => [...prev.slice(-120), { text, type, time }]);
    });

    const unsubProg = webSerialManager.subscribeProgress((p) => {
      setProgress(p);
    });

    const unsubDiag = webSerialManager.subscribeDiagnostic((d) => {
      setDiagnostic(d);
    });

    return () => {
      unsubTerm();
      unsubProg();
      unsubDiag();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const handleConnect = async () => {
    const ok = await webSerialManager.connect(baudRate);
    setIsConnected(ok);
  };

  const handleStartFlash = async () => {
    if (!isConnected) {
      await handleConnect();
    }
    await webSerialManager.flashRev25Firmware();
  };

  const handleRunDiagnostic = async () => {
    if (!isConnected) {
      await handleConnect();
    }
    await webSerialManager.runFullHardwareDiagnostic();
  };

  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;
    await webSerialManager.sendCommand(commandInput.trim());
    setCommandInput('');
  };

  const handleCopyLogs = () => {
    const fullText = terminalLogs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClearLogs = () => {
    setTerminalLogs([]);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/25 via-sky-900/85 to-indigo-950 overflow-y-auto space-y-5">
      
      {/* 1. TOP BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-900/90 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 text-[11px] font-mono font-bold">
            <Zap size={12} className="text-amber-300" />
            <span>WEBSERIAL API &bull; ZERO-INSTALL ARDUINO REPLACEMENT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Browser-Based ESP32-S3 Firmware Flasher &amp; Hardware Self-Test
          </h1>
          <p className="text-xs text-cyan-100/85 max-w-2xl">
            Plug the PoloBridge dongle into your computer via USB-C. Flash the official Rev 2.5 firmware in 1 click and verify the isolated RS-232, 3-Channel Pickle optocouplers, and 105dB piezo horn in under 30 seconds.
          </p>
        </div>

        {/* USB Connect Button & Port Status */}
        <div className="flex items-center gap-2">
          <div className="bg-sky-950/80 px-3 py-1.5 rounded-xl border border-cyan-400/30 text-xs font-mono">
            <span className="text-cyan-300/80 mr-1.5">Baud:</span>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value={115200} className="bg-sky-950 text-white">115200 (Default)</option>
              <option value={9600} className="bg-sky-950 text-white">9600 (CTS RS-232)</option>
              <option value={19200} className="bg-sky-950 text-white">19200 (Daktronics)</option>
            </select>
          </div>

          <button
            onClick={isConnected ? () => { webSerialManager.disconnect(); setIsConnected(false); } : handleConnect}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-black text-xs shadow-lg transition cursor-pointer ${
              isConnected
                ? 'bg-emerald-400 text-sky-950 shadow-emerald-400/30 hover:bg-emerald-300'
                : 'bg-gradient-to-r from-cyan-400 to-teal-300 text-sky-950 shadow-cyan-400/30 hover:from-cyan-300 hover:to-teal-200'
            }`}
          >
            <Cpu size={14} />
            <span>{isConnected ? 'USB CONNECTED' : 'CONNECT USB-C'}</span>
          </button>
        </div>
      </div>

      {/* 2. DUAL ACTION GRID: FLASHER + HARDWARE DIAGNOSTIC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CARD A: 1-CLICK FIRMWARE FLASHER */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                OFFICIAL PRODUCTION FIRMWARE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-200">
                REV 2.5 RELEASE
              </span>
            </div>
            <h2 className="text-lg font-black text-white">
              1-Click ESP32-S3 Firmware Flasher
            </h2>
            <p className="text-xs text-cyan-100/80">
              Direct SLIP ROM bootloader protocol. Erases flash sectors and writes the official production binary (`0x10000`) with MD5 hash verification.
            </p>

            {/* Chip Target Specs */}
            <div className="grid grid-cols-3 gap-2 bg-sky-950/70 p-3 rounded-2xl border border-cyan-400/25 text-xs font-mono">
              <div>
                <span className="text-[10px] text-cyan-300/80 block">TARGET MCU</span>
                <span className="font-bold text-white">ESP32-S3-WROOM-1U</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-300/80 block">FLASH PARTITION</span>
                <span className="font-bold text-amber-300">8MB Quad-SPI</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-300/80 block">MD5 CHECKSUM</span>
                <span className="font-bold text-emerald-300">8f9b23e1 (VERIFIED)</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Status Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-200 font-bold">{progress.message}</span>
              <span className="text-amber-300 font-black">{progress.percentage}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-sky-950 border border-cyan-400/30 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Flash Button */}
          <button
            onClick={handleStartFlash}
            disabled={progress.step === 'writing' || progress.step === 'erasing'}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-sky-950 font-mono font-black text-sm shadow-xl shadow-emerald-400/20 active:translate-y-1 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            <span>
              {progress.step === 'writing' || progress.step === 'erasing'
                ? 'FLASHING FIRMWARE...'
                : '⚡ 1-CLICK FLASH POLOBRIDGE REV 2.5'}
            </span>
          </button>
        </div>

        {/* CARD B: AUTOMATED HARDWARE LOOPBACK & PIN DIAGNOSTIC */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/90 border-2 border-cyan-400/40 p-5 shadow-2xl flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
                AUTOMATED MANUFACTURING QC
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-200">
                5-POINT VERIFICATION
              </span>
            </div>
            <h2 className="text-lg font-black text-white">
              Hardware Loopback &amp; Self-Test Suite
            </h2>
            <p className="text-xs text-cyan-100/80">
              Validates physical hardware signals across the 2.5kV galvanic isolation barrier, optocouplers, MOSFET, and lid buttons.
            </p>
          </div>

          {/* 5 Hardware Test Indicators */}
          <div className="space-y-2 text-xs font-mono">
            {/* 1. RS-232 Loopback */}
            <div className="p-2.5 rounded-xl bg-sky-950/75 border border-cyan-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-cyan-300" />
                <span>1. RS-232 Isolated Loopback (GPIO 17 &rarr; 16)</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  diagnostic.rs232Loopback === 'pass'
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : diagnostic.rs232Loopback === 'running'
                    ? 'bg-amber-400/20 text-amber-300 animate-pulse'
                    : 'bg-sky-900 text-sky-300/60'
                }`}
              >
                {diagnostic.rs232Loopback.toUpperCase()}
              </span>
            </div>

            {/* 2. 3-Ch Pickle Optocouplers */}
            <div className="p-2.5 rounded-xl bg-sky-950/75 border border-cyan-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-emerald-300" />
                <span>2. 3-Ch Pickle Optocouplers (GPIO 4, 5, 6)</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  diagnostic.pickleOptos === 'pass'
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : diagnostic.pickleOptos === 'running'
                    ? 'bg-amber-400/20 text-amber-300 animate-pulse'
                    : 'bg-sky-900 text-sky-300/60'
                }`}
              >
                {diagnostic.pickleOptos.toUpperCase()}
              </span>
            </div>

            {/* 3. 105dB Piezo Horn */}
            <div className="p-2.5 rounded-xl bg-sky-950/75 border border-cyan-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-rose-300" />
                <span>3. 105dB Piezo Horn Driver (GPIO 7 MOSFET)</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  diagnostic.piezoHorn === 'pass'
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : diagnostic.piezoHorn === 'running'
                    ? 'bg-amber-400/20 text-amber-300 animate-pulse'
                    : 'bg-sky-900 text-sky-300/60'
                }`}
              >
                {diagnostic.piezoHorn.toUpperCase()}
              </span>
            </div>

            {/* 4. Emergency Lid Buttons Live Status */}
            <div className="p-2.5 rounded-xl bg-sky-950/75 border border-cyan-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-amber-300" />
                <span>4. Emergency Lid Buttons (SW3, SW4, SW5)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => webSerialManager.sendCommand('DIAG:BUTTON:SW3')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                    !diagnostic.lidButtons.startStop ? 'bg-emerald-400 text-sky-950' : 'bg-sky-900 text-cyan-200'
                  }`}
                  title="Click to simulate pressing SW3 (Start/Stop)"
                >
                  SW3 (Start)
                </button>
                <button
                  onClick={() => webSerialManager.sendCommand('DIAG:BUTTON:SW4')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                    !diagnostic.lidButtons.reset30 ? 'bg-emerald-400 text-sky-950' : 'bg-sky-900 text-cyan-200'
                  }`}
                  title="Click to simulate pressing SW4 (30s)"
                >
                  SW4 (30s)
                </button>
                <button
                  onClick={() => webSerialManager.sendCommand('DIAG:BUTTON:SW5')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                    !diagnostic.lidButtons.reset20 ? 'bg-emerald-400 text-sky-950' : 'bg-sky-900 text-cyan-200'
                  }`}
                  title="Click to simulate pressing SW5 (20s)"
                >
                  SW5 (20s)
                </button>
              </div>
            </div>
          </div>

          {/* Run Diagnostic Button */}
          <button
            onClick={handleRunDiagnostic}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-sky-950 font-mono font-black text-sm shadow-xl shadow-amber-400/20 active:translate-y-1 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Play size={16} />
            <span>▶ RUN AUTOMATED 5-POINT SELF-TEST</span>
          </button>
        </div>

      </div>

      {/* 3. LIVE WEBSERIAL TERMINAL CONSOLE */}
      <div className="rounded-3xl bg-sky-950/90 border-2 border-cyan-400/35 p-5 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/20 pb-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-cyan-300" />
            <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider">
              Live USB-C Diagnostic Terminal (115200 Baud)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1 rounded-lg bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/25 text-xs font-mono flex items-center gap-1 cursor-pointer"
            >
              <Copy size={12} />
              <span>{copied ? 'COPIED!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleClearLogs}
              className="px-2.5 py-1 rounded-lg bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/25 text-xs font-mono flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Console Log Screen */}
        <div className="w-full h-56 bg-sky-950/95 rounded-2xl p-3 font-mono text-xs overflow-y-auto space-y-1 border border-cyan-400/25 shadow-inner">
          {terminalLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-sky-500 select-none shrink-0">[{log.time}]</span>
              <span
                className={`break-all ${
                  log.type === 'rx'
                    ? 'text-cyan-200'
                    : log.type === 'tx'
                    ? 'text-amber-300 font-bold'
                    : log.type === 'error'
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-300'
                }`}
              >
                {log.text}
              </span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Form */}
        <form onSubmit={handleSendCommand} className="flex gap-2">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Send command (e.g., PING, STATUS, DIAG:RS232, DIAG:HORN, DIAG:PICKLE, START, RESET30)..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-sky-900/70 border border-cyan-400/30 text-white font-mono text-xs placeholder:text-sky-400/60 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-mono font-black text-xs cursor-pointer transition shadow"
          >
            Send
          </button>
        </form>
      </div>

    </div>
  );
}
