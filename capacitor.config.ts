import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Bundle ID / application ID. Change it before the first store upload if you
  // prefer one based on a domain you own; it can't be changed afterwards.
  appId: "com.chorequest.app",
  appName: "ChoreQuest",
  // Static export from `npm run build:mobile`
  webDir: "out",
  backgroundColor: "#faf7ff",
  ios: {
    // The web app handles safe areas itself with env(safe-area-inset-*)
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      launchAutoHide: true,
      backgroundColor: "#8b5cf6",
      showSpinner: false,
    },
  },
};

export default config;
