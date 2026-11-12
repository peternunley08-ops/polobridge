/**
 * PoloBridge & PoloPad Pro — Live OBS & vMix Broadcast Scorebug Engine
 *
 * Manages graphics themes (Olympic Ribbon, ESPN Lower-Third, Hudl Stream Pill, Minimal Corner Bug),
 * broadcast overlays (Power Play Exclusions, Goal Splash, Timeout Lower-Third, Sponsor Banner, Shootout Pips),
 * and OBS Browser Source query parameters with BroadcastChannel synchronization.
 */

export type BroadcastTheme = 'olympic' | 'espn' | 'hudl' | 'minimal';
export type ChromaMode = 'transparent' | 'green' | 'blue';

export interface BroadcastOverlaySettings {
  theme: BroadcastTheme;
  chromaMode: ChromaMode;
  scalePercent: number; // 75 to 125
  showPowerPlay: boolean;
  showSponsorBanner: boolean;
  sponsorText: string;
  showShootoutPips: boolean;
  showShotClock: boolean;
  position: 'top-left' | 'top-center' | 'bottom-left' | 'bottom-center';
}

export const DEFAULT_BROADCAST_SETTINGS: BroadcastOverlaySettings = {
  theme: 'olympic',
  chromaMode: 'transparent',
  scalePercent: 100,
  showPowerPlay: true,
  showSponsorBanner: true,
  sponsorText: 'USA Water Polo National Championships • Live Stream',
  showShootoutPips: true,
  showShotClock: true,
  position: 'top-center',
};

const STORAGE_KEY = 'polopad_broadcast_settings';
export const BROADCAST_CHANNEL_NAME = 'polopad_broadcast_stream';

export interface BroadcastSyncState {
  gameTimeMs: number;
  shotTimeMs: number;
  isRunning: boolean;
  period: number;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  exclusions: Array<{ id: string; team: 'white' | 'dark'; cap: number; remaining: number }>;
  activeTimeout: { team: 'white' | 'dark'; type: '60s' | '30s'; remainingMs: number } | null;
  lastGoalSplash?: { team: 'white' | 'dark'; cap?: number; text: string; timestamp: number } | null;
  shootoutRounds?: Array<{ round: number; whiteResult: string; darkResult: string }>;
}

export class BroadcastManager {
  private settings: BroadcastOverlaySettings;
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(state: BroadcastSyncState) => void> = [];

  constructor() {
    this.settings = this.loadSettings();
    this.initChannel();
  }

  private loadSettings(): BroadcastOverlaySettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_BROADCAST_SETTINGS, ...JSON.parse(saved) };
        }
      }
    } catch {
      // Fallback to defaults
    }
    return { ...DEFAULT_BROADCAST_SETTINGS };
  }

  public getSettings(): BroadcastOverlaySettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<BroadcastOverlaySettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {
      // Ignore storage errors
    }
  }

  private initChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data && typeof event.data === 'object') {
          this.listeners.forEach((listener) => listener(event.data as BroadcastSyncState));
        }
      };
    }
  }

  /**
   * Broadcast state from the console to any open OBS browser sources
   */
  public broadcastState(state: BroadcastSyncState) {
    if (this.channel) {
      try {
        this.channel.postMessage(state);
      } catch {
        // Broadcast failed
      }
    }
  }

  /**
   * Subscribe to state updates in overlay mode
   */
  public subscribe(callback: (state: BroadcastSyncState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Parse OBS Browser Source URL Query Parameters
   */
  public static parseUrlParams(): { isOverlayMode: boolean; theme?: BroadcastTheme; transparent: boolean } {
    if (typeof window === 'undefined') {
      return { isOverlayMode: false, transparent: true };
    }
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || params.get('view');
    const isOverlayMode = mode === 'overlay' || mode === 'scorebug' || params.has('overlay');
    const themeParam = params.get('theme') as BroadcastTheme | null;
    const theme = themeParam && ['olympic', 'espn', 'hudl', 'minimal'].includes(themeParam) ? themeParam : undefined;
    const transparent = params.get('chroma') !== 'green' && params.get('chroma') !== 'blue';

    return { isOverlayMode, theme, transparent };
  }

  /**
   * Generate OBS Studio / vMix Browser Source URL
   */
  public generateObsUrl(baseUrl: string): string {
    const cleanUrl = baseUrl.split('?')[0];
    const params = new URLSearchParams({
      mode: 'overlay',
      theme: this.settings.theme,
      chroma: this.settings.chromaMode,
      scale: this.settings.scalePercent.toString(),
    });
    return `${cleanUrl}?${params.toString()}`;
  }
}

export const broadcastManager = new BroadcastManager();
