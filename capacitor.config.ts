import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smllegacy.coldstore.v2',
  appName: 'SML Cold Store v2',
  webDir: 'out/renderer',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
