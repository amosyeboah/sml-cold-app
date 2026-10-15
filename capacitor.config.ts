import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smllegacy.coldstore.v2',
  appName: 'Sofiyem Cold Store v2',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable'
    }
  }
};

export default config;
