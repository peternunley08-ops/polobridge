import React, { useState } from 'react';
import {
  REFEREE_WHISTLE_SIGNALS,
  SHOT_CLOCK_DECISION_MATRIX,
  TRAINING_SCENARIOS,
  TrainingScenario,
  WhistleSignalSpec,
} from '../engine/volunteer-training';
import { audioSynthesizer } from '../engine/audio-synthesizer';

interface VolunteerTrainingPanelProps {
  onBackToConsole: () => void;
}

export const VolunteerTrainingPanel: React.FC<VolunteerTrainingPanelProps> = ({
  onBackToConsole,
}) => {
  const [activeTab, setActiveTab] = useState<'sheet' | 'whistle' | 'matrix' | 'quiz'>('sheet');
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [activePlayingWhistle, setActivePlayingWhistle] = useState<string | null>(null);

  const scenario = TRAINING_SCENARIOS[currentScenarioIdx];

  const playWhistleSample = (spec: WhistleSignalSpec) => {
    setActivePlayingWhistle(spec.id);
    if (spec.audioType === 'short') {
      audioSynthesizer.playWhistle(300);
      setTimeout(() => setActivePlayingWhistle(null), 300);
    } else if (spec.audioType === 'double') {
      audioSynthesizer.playWhistle(200);
      setTimeout(() => {
        audioSynthesizer.playWhistle(350);
        setTimeout(() => setActivePlayingWhistle(null), 350);
      }, 250);
    } else if (spec.audioType === 'long') {
      audioSynthesizer.playWhistle(900);
      setTimeout(() => setActivePlayingWhistle(null), 900);
    } else {
      audioSynthesizer.playWhistle(600);
      setTimeout(() => setActivePlayingWhistle(null), 600);
    }
  };

  const handleQuizAnswer = (action: string) => {
    if (selectedAnswer) return; // Prevent multiple answers
    setSelectedAnswer(action);
    if (action === scenario.correctAction) {
      setScore((prev) => prev + 1);
      audioSynthesizer.playChime('info');
    } else {
      audioSynthesizer.playChime('warn');
    }
  };

  const nextScenario = () => {
    setSelectedAnswer(null);
    if (currentScenarioIdx + 1 < TRAINING_SCENARIOS.length) {
      setCurrentScenarioIdx((prev) => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const resetQuiz = () => {
    setCurrentScenarioIdx(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizFinished(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 text-sky-100 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        {/* Header Bar */}
        <header className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-amber-500 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/40">
              📋
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                Volunteer Table Quick-Start & Training Guide
              </h1>
              <p className="text-xs md:text-sm text-cyan-300 font-medium">
                Official 1-Page Poolside Reference, Referee Whistle Decoder & Interactive 30s/20s Simulator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all border border-amber-300 flex items-center gap-1.5"
            >
              <span>🖨️ Print 1-Page Card</span>
            </button>

            <button
              onClick={onBackToConsole}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-900/50 transition-all border border-cyan-300/40"
            >
              ← Return to Console
            </button>
          </div>
        </header>

        {/* Sub-Tabs Bar */}
        <nav className="flex gap-2 overflow-x-auto bg-sky-950/60 p-1.5 rounded-xl border border-cyan-400/30 print:hidden">
          {[
            { id: 'sheet', label: '📄 Printable Quick-Start Card', icon: '📄' },
            { id: 'whistle', label: '📯 Referee Whistle Decoder', icon: '📯' },
            { id: 'matrix', label: '⏱️ 30s vs 20s Decision Matrix', icon: '⏱️' },
            { id: 'quiz', label: '🎮 Situation Training Quiz', icon: '🎮' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                audioSynthesizer.playClick();
                setActiveTab(tab.id as typeof activeTab);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md border border-cyan-300/50'
                  : 'text-sky-300 hover:text-white hover:bg-sky-900/50'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* TAB 1: 1-PAGE PRINTABLE POOLSIDE CHEAT-SHEET */}
        {activeTab === 'sheet' && (
          <div className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 print:p-0 print:border-none print:shadow-none print:text-black print:bg-white">
            <div className="flex justify-between items-center pb-3 border-b border-cyan-400/30">
              <div>
                <span className="text-xs font-black text-amber-400 tracking-widest uppercase">
                  Official Scoring Table Quick Reference Card
                </span>
                <h2 className="text-xl font-black text-white uppercase print:text-black">
                  Water Polo Table Operator Cheat-Sheet
                </h2>
              </div>
              <span className="text-xs font-mono text-cyan-300 print:text-gray-600">
                USAWP • NCAA • NFHS • World Aquatics WP 20-22
              </span>
            </div>

            {/* 3 Golden Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-sky-900/40 border border-cyan-400/30 print:border-gray-400 print:bg-gray-100">
                <div className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1 print:text-emerald-800">
                  Rule 1: Start / Stop Clock
                </div>
                <div className="text-xs text-sky-100 leading-relaxed print:text-gray-800">
                  <strong>START:</strong> On referee’s whistle when a player puts the ball into play (whistle or hand pass).<br />
                  <strong>STOP:</strong> On ANY referee whistle blast, goal, exclusion, or official timeout.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-900/40 border border-cyan-400/30 print:border-gray-400 print:bg-gray-100">
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1 print:text-amber-800">
                  Rule 2: When to Reset 30s
                </div>
                <div className="text-xs text-sky-100 leading-relaxed print:text-gray-800">
                  <strong>30s RESET:</strong> Whenever the OTHER team clearly gains control (turnover, steal, offensive foul).<br />
                  <strong>NEVER:</strong> On an ordinary foul outside 6 meters!
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-900/40 border border-cyan-400/30 print:border-gray-400 print:bg-gray-100">
                <div className="text-xs font-black text-rose-400 uppercase tracking-wider mb-1 print:text-rose-800">
                  Rule 3: When to Reset 20s
                </div>
                <div className="text-xs text-sky-100 leading-relaxed print:text-gray-800">
                  <strong>20s RESET:</strong> Attacking team offensive rebound after shot hits post or goalie save, corner throws, and exclusions with &lt;20s left.
                </div>
              </div>
            </div>

            {/* Compact Table */}
            <div className="rounded-xl overflow-hidden border border-cyan-400/30">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-sky-900/80 text-cyan-200 border-b border-cyan-400/30">
                  <tr>
                    <th className="p-2.5">Poolside Event</th>
                    <th className="p-2.5">Referee Signal</th>
                    <th className="p-2.5">USAWP / NCAA</th>
                    <th className="p-2.5">NFHS High School</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-400/15">
                  <tr className="bg-sky-950/40">
                    <td className="p-2.5 font-bold text-white">Steal / Turnover</td>
                    <td className="p-2.5 text-sky-300">Point opposite direction</td>
                    <td className="p-2.5 text-emerald-300 font-black">Reset 30s</td>
                    <td className="p-2.5 text-emerald-300 font-black">Reset 30s</td>
                  </tr>
                  <tr className="bg-sky-900/20">
                    <td className="p-2.5 font-bold text-white">Shot Saved / Post Rebound</td>
                    <td className="p-2.5 text-sky-300">No whistle (live ball)</td>
                    <td className="p-2.5 text-amber-300 font-black">Reset 20s</td>
                    <td className="p-2.5 text-emerald-300 font-black">Reset 30s</td>
                  </tr>
                  <tr className="bg-sky-950/40">
                    <td className="p-2.5 font-bold text-white">Corner Throw</td>
                    <td className="p-2.5 text-sky-300">Point to 2-meter corner cone</td>
                    <td className="p-2.5 text-amber-300 font-black">Reset 20s</td>
                    <td className="p-2.5 text-emerald-300 font-black">Reset 30s</td>
                  </tr>
                  <tr className="bg-sky-900/20">
                    <td className="p-2.5 font-bold text-white">Ordinary Foul (6m)</td>
                    <td className="p-2.5 text-sky-300">Point attack direction</td>
                    <td className="p-2.5 text-slate-400 font-black">No Reset (Hold)</td>
                    <td className="p-2.5 text-slate-400 font-black">No Reset (Hold)</td>
                  </tr>
                  <tr className="bg-sky-950/40">
                    <td className="p-2.5 font-bold text-white">Exclusion Foul (&lt;20s)</td>
                    <td className="p-2.5 text-sky-300">Point to cap # & corner</td>
                    <td className="p-2.5 text-amber-300 font-black">Reset 20s</td>
                    <td className="p-2.5 text-emerald-300 font-black">Reset 30s</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REFEREE WHISTLE DECODER WITH AUDIO PREVIEW */}
        {activeTab === 'whistle' && (
          <div className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-cyan-400/30">
              <h2 className="text-base font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <span>📯</span> Referee Whistle & Hand Signal Decoder
              </h2>
              <span className="text-xs text-sky-300 font-semibold">Click any whistle to play acoustic referee audio</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {REFEREE_WHISTLE_SIGNALS.map((sig) => (
                <div
                  key={sig.id}
                  className="p-4 rounded-xl bg-sky-900/40 border border-cyan-400/30 flex flex-col justify-between gap-3 hover:border-cyan-300 transition-all"
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-amber-400 uppercase">{sig.meaning}</span>
                      <button
                        onClick={() => playWhistleSample(sig)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 border ${
                          activePlayingWhistle === sig.id
                            ? 'bg-rose-500 text-white border-rose-300 scale-95'
                            : 'bg-cyan-500/30 text-cyan-200 border-cyan-400 hover:bg-cyan-400 hover:text-slate-950'
                        }`}
                      >
                        <span>🔊 Play</span>
                        <span className="text-[10px] font-mono">{sig.whistlePattern}</span>
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-sky-200">
                      <strong>Hand Signal:</strong> {sig.handSignal}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-sky-950/80 border border-cyan-500/20 text-[11px] text-cyan-300 font-mono">
                    <strong>Table Action:</strong> {sig.tableAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: 30S VS 20S DECISION MATRIX */}
        {activeTab === 'matrix' && (
          <div className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <h2 className="text-base font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-cyan-400/30">
              <span>⏱️</span> Shot Clock Reset Decision Matrix
            </h2>

            <div className="flex flex-col gap-3">
              {SHOT_CLOCK_DECISION_MATRIX.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-sky-900/40 border border-cyan-400/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{rule.situation}</div>
                    <div className="text-xs text-sky-300 mt-0.5">{rule.notes}</div>
                  </div>

                  <div className="flex gap-2 font-mono">
                    <div className="px-3 py-1 rounded-lg bg-sky-950 border border-cyan-400/30 text-center">
                      <div className="text-[9px] text-sky-400 uppercase">USAWP / NCAA</div>
                      <div className="text-xs font-black text-amber-300">{rule.usawpNcaaFina}</div>
                    </div>

                    <div className="px-3 py-1 rounded-lg bg-sky-950 border border-cyan-400/30 text-center">
                      <div className="text-[9px] text-sky-400 uppercase">NFHS High School</div>
                      <div className="text-xs font-black text-emerald-300">{rule.nfhsHighSchool}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: INTERACTIVE SITUATION QUIZ */}
        {activeTab === 'quiz' && (
          <div className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            {!quizFinished ? (
              <>
                <div className="flex justify-between items-center pb-3 border-b border-cyan-400/30">
                  <div>
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Scenario {currentScenarioIdx + 1} of {TRAINING_SCENARIOS.length}
                    </span>
                    <h2 className="text-lg font-black text-white">{scenario.title}</h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-sky-300">
                      Score: <strong className="text-emerald-400 text-sm">{score}</strong> / {currentScenarioIdx}
                    </span>
                    <button
                      onClick={resetQuiz}
                      className="px-2.5 py-1 rounded bg-sky-900 text-sky-300 hover:text-white text-xs"
                    >
                      Restart
                    </button>
                  </div>
                </div>

                {/* Scenario Display HUD */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-400/30 grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-cyan-400">GAME CLOCK</div>
                    <div className="text-xl font-black text-white">{scenario.gameTimeDisplay}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-400">SHOT CLOCK</div>
                    <div className="text-xl font-black text-rose-400">{scenario.shotTimeDisplay}</div>
                  </div>
                  <div className="col-span-2 text-left border-l border-cyan-400/20 pl-4 font-sans">
                    <div className="text-[10px] text-sky-400 uppercase">Referee Signal</div>
                    <div className="text-xs font-bold text-cyan-200">{scenario.refereeSignal}</div>
                  </div>
                </div>

                {/* Description */}
                <div className="text-sm text-sky-100 bg-sky-900/30 p-3.5 rounded-xl border border-cyan-400/20 leading-relaxed">
                  {scenario.description}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'RESET_30', label: 'Reset 30s', color: 'bg-emerald-600' },
                    { id: 'RESET_20', label: 'Reset 20s', color: 'bg-amber-600' },
                    { id: 'HOLD_CLOCK', label: 'Hold / No Reset', color: 'bg-blue-600' },
                    { id: 'STOP_CLOCK', label: 'Stop Clocks', color: 'bg-rose-600' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleQuizAnswer(btn.id)}
                      disabled={selectedAnswer !== null}
                      className={`py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all ${btn.color} ${
                        selectedAnswer !== null ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
                      } ${
                        selectedAnswer === btn.id
                          ? btn.id === scenario.correctAction
                            ? 'ring-4 ring-emerald-400'
                            : 'ring-4 ring-rose-500'
                          : ''
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Explanation Card */}
                {selectedAnswer && (
                  <div
                    className={`p-4 rounded-xl border flex flex-col gap-2 animate-fadeIn ${
                      selectedAnswer === scenario.correctAction
                        ? 'bg-emerald-950/70 border-emerald-400 text-emerald-100'
                        : 'bg-rose-950/70 border-rose-400 text-rose-100'
                    }`}
                  >
                    <div className="text-sm font-black flex items-center gap-1.5">
                      <span>{selectedAnswer === scenario.correctAction ? '✅ Correct Call!' : '❌ Incorrect Call'}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{scenario.explanation}</p>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={nextScenario}
                        className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all"
                      >
                        Next Situation →
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Quiz Complete Screen */
              <div className="p-8 rounded-xl bg-sky-900/40 border border-cyan-400/30 flex flex-col items-center justify-center gap-4 text-center">
                <div className="text-4xl">🏆</div>
                <h2 className="text-2xl font-black text-white">Training Simulator Complete!</h2>
                <p className="text-sm text-sky-200">
                  You scored <strong>{score}</strong> out of {TRAINING_SCENARIOS.length} situations correctly.
                </p>
                <button
                  onClick={resetQuiz}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:from-cyan-400 hover:to-blue-500 transition-all"
                >
                  Try Simulator Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
