import { initializeApp, getApps } from "firebase/app";
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  // Optional: only needed for analytics
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

function createDb(): Firestore {
  try {
    // Cache data in IndexedDB so the app opens fast and survives short offline periods.
    return initializeFirestore(app, {
      localCache:
        typeof window === "undefined"
          ? memoryLocalCache()
          : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (e.g. after a hot reload).
    return getFirestore(app);
  }
}

function createAuth(): Auth {
  if (!Capacitor.isNativePlatform()) return getAuth(app);
  try {
    // In the iOS/Android web view, getAuth() can hang while loading its popup
    // helper; initializing with explicit persistence avoids that.
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch {
    // Already initialised (e.g. after a hot reload)
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = createDb();
