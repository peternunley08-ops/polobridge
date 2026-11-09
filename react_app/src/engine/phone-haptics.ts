/**
 * PoloBridge & PoloPad Pro — Pool Deck Phone Haptics & Screen Wake-Lock Driver
 * ===========================================================================
 * Provides tactile vibration feedback for loud pool deck environments and
 * prevents the phone screen from sleeping during active match play.
 */

export type HapticFeedbackType = 'tap' | 'reset30' | 'reset20' | 'start' | 'stop' | 'horn' | 'warning' | 'undo';

export class PhoneHapticsManager {
  private wakeLockSentinel: any = null;
  private wakeLockRequested = false;

  public isVibrationSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  public isWakeLockSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  /**
   * Fires tactile vibration patterns customized for pool deck actions.
   */
  public trigger(type: HapticFeedbackType = 'tap') {
    if (!this.isVibrationSupported()) return;

    try {
      switch (type) {
        case 'tap':
          navigator.vibrate(15);
          break;
        case 'start':
          navigator.vibrate([25]);
          break;
        case 'stop':
          navigator.vibrate([35, 30, 35]);
          break;
        case 'reset30':
          // Crisp double pulse (identifies 30s reset without looking)
          navigator.vibrate([20, 30, 20]);
          break;
        case 'reset20':
          // Triple pulse (identifies 20s rebound/exclusion reset)
          navigator.vibrate([15, 25, 15, 25, 20]);
          break;
        case 'horn':
          // Heavy resonant burst
          navigator.vibrate([120, 60, 120, 60, 180]);
          break;
        case 'warning':
          navigator.vibrate([50, 40, 50]);
          break;
        case 'undo':
          navigator.vibrate([40, 20, 15]);
          break;
      }
    } catch {
      // Haptic playback ignored if browser suppresses vibration
    }
  }

  /**
   * Keeps phone screen awake during match play
   */
  public async requestWakeLock(): Promise<boolean> {
    if (!this.isWakeLockSupported()) return false;
    try {
      this.wakeLockRequested = true;
      const nav = navigator as any;
      this.wakeLockSentinel = await nav.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    this.wakeLockRequested = false;
    try {
      if (this.wakeLockSentinel) {
        await this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      }
    } catch {
      // Cleanup fallback
    }
  }

  public isWakeLockActive(): boolean {
    return Boolean(this.wakeLockSentinel && !this.wakeLockSentinel.released);
  }

  /**
   * Re-acquires wake lock if the user tabs back into the app
   */
  public handleVisibilityChange() {
    if (this.wakeLockRequested && document.visibilityState === 'visible') {
      this.requestWakeLock().catch(() => {});
    }
  }
}

export const phoneHaptics = new PhoneHapticsManager();
