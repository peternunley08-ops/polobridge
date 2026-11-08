/// Abstract sound service contract for pool desk clicks and horns.
abstract class SoundService {
  void playClick();
  void playHorn({int durationMs = 1200});
}

/// Headless / mock sound service for testing and preview execution.
/// Records invocation counts and duration parameters without audio hardware.
class MockSoundService implements SoundService {
  int clickCount = 0;
  int hornCount = 0;
  int lastHornDurationMs = 0;

  @override
  void playClick() {
    clickCount++;
  }

  @override
  void playHorn({int durationMs = 1200}) {
    hornCount++;
    lastHornDurationMs = durationMs;
  }

  void reset() {
    clickCount = 0;
    hornCount = 0;
    lastHornDurationMs = 0;
  }
}
