/**
 * PoloPad Pro & PoloBridge — Figma Code Connect Component Mappings
 * Maps Figma Dev Mode components directly to production React (App.tsx / components/*)
 * and SwiftUI (ipad_app/PoloPadView.swift) implementations.
 */

export interface FigmaPlungerProps {
  variant: 'start-stop' | 'reset-30s' | 'reset-20s' | 'horn' | 'undo';
  operatorMode: 'simple-volunteer' | 'full-varsity';
  ruleset: 'NCAA-20s-30s' | 'NFHS-30s';
  isRunning?: boolean;
}

export const FIGMA_COMPONENT_REGISTRY = {
  PoloPadConsoleChassis: {
    figmaNodeName: 'PoloPad Pro / Handheld Console Chassis',
    reactFile: 'react_app/src/App.tsx',
    swiftFile: 'ipad_app/PoloPadView.swift',
    tailwindClasses:
      'rounded-[36px] bg-gradient-to-b from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-aquatic-card backdrop-blur-xl',
  },
  Tactile3DPlunger: {
    figmaNodeName: 'PoloPad Pro / 3D Tactile Plunger',
    reactFile: 'react_app/src/App.tsx',
    swiftFile: 'ipad_app/PoloPadView.swift',
    variants: {
      'start-stop': 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_10px_0_#065f46] active:translate-y-2',
      'reset-30s': 'bg-gradient-to-b from-teal-400 to-emerald-600 shadow-[0_10px_0_#115e59] active:translate-y-2',
      'reset-20s': 'bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_10px_0_#92400e] active:translate-y-2',
      'horn': 'bg-gradient-to-b from-rose-500 to-red-700 shadow-[0_10px_0_#881337] active:translate-y-2',
    },
  },
  HardwareBomTable: {
    figmaNodeName: 'PoloBridge / Ready-to-Order BOM & JLCPCB Panel',
    reactFile: 'react_app/src/components/hardware-bom-panel.tsx',
  },
  IsolatedPcbBlueprint: {
    figmaNodeName: 'PoloBridge / 4-Layer 2.5kV Isolated PCB Blueprint',
    reactFile: 'react_app/src/components/mockups-gallery.tsx',
  },
  CommercialLandingPage: {
    figmaNodeName: 'PoloBridge / Commercial Product & AD ROI Page',
    reactFile: 'react_app/src/components/landing-page.tsx',
  },
} as const;
