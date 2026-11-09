/**
 * Capacitor Configuration for PoloPad Pro (iOS / iPadOS Native App Packaging)
 *
 * Build & Open in Xcode on macOS:
 *   npm run build
 *   npx cap add ios
 *   npx cap sync ios
 *   npx cap open ios
 */
const config = {
  appId: 'com.polobridge.polopadpro',
  appName: 'PoloPad Pro',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    iosScheme: 'polopad',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'recommended',
    backgroundColor: '#0c4a6e',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for PoloBridge-Pro ESP32-S3 Dongle...',
        cancel: 'Cancel',
        availableDevices: 'Available PoloBridge Dongles',
        noDeviceFound: 'No PoloBridge Dongle Found Nearby',
      },
    },
  },
};

export default config;
