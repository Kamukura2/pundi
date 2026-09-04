import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.pundi.app",
  appName: "Pundi",
  webDir: "dist",
  server: {
    hostname: "localhost",
    androidScheme: "https"
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 250,
      backgroundColor: "#0D1B3D",
      showSpinner: false
    },
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT"
    },
    Keyboard: {
      resize: "native"
    }
  }
};

export default config;
