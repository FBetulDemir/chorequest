// src/lib/socialAuth.ts
// "Sign in with Apple" and "Continue with Google".
// Web: Firebase popups. Native app: the OS sign-in sheet (Capgo Social Login),
// whose identity token is then handed to Firebase.
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import {
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";

import { auth } from "@/src/lib/firebase";
import { isNative } from "@/src/lib/native";

export type SocialProvider = "apple" | "google";

// Each provider stays hidden until it's set up in Firebase (and Xcode / Google Cloud for the apps).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
const APPLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_APPLE === "1";
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

/** Providers to show on this platform. Apple is offered on iPhone and the web. */
export function availableProviders(): SocialProvider[] {
  const platform = Capacitor.getPlatform(); // "web" | "ios" | "android"
  const out: SocialProvider[] = [];
  if (APPLE_ENABLED && platform !== "android") out.push("apple");
  if (GOOGLE_ENABLED && (platform === "web" || GOOGLE_WEB_CLIENT_ID)) out.push("google");
  return out;
}

let initialized: Promise<void> | null = null;
function initNative() {
  initialized ??= SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      mode: "online",
    },
    apple: { redirectUrl: "" },
  });
  return initialized;
}

function randomNonce(length = 32): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Native Google sheet → Firebase credential. */
async function nativeGoogleCredential() {
  await initNative();
  const { result } = await SocialLogin.login({ provider: "google", options: {} });
  if (result.responseType !== "online" || !result.idToken) {
    throw new Error("Google sign-in didn't return an identity token");
  }
  return GoogleAuthProvider.credential(result.idToken);
}

/** Native Apple sheet → Firebase credential (nonce-protected) and the name, if Apple shared it. */
async function nativeAppleCredential() {
  await initNative();
  // Apple gets the hashed nonce; Firebase checks it against the raw one
  const rawNonce = randomNonce();
  const { result } = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"], nonce: await sha256Hex(rawNonce) },
  });
  if (!result.idToken) throw new Error("Apple sign-in didn't return an identity token");
  const name = [result.profile.givenName, result.profile.familyName].filter(Boolean).join(" ");
  return { credential: new OAuthProvider("apple.com").credential({ idToken: result.idToken, rawNonce }), name };
}

function appleProvider() {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

export async function signInWithGoogle(): Promise<void> {
  if (!isNative()) {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return;
  }
  await signInWithCredential(auth, await nativeGoogleCredential());
}

export async function signInWithApple(): Promise<void> {
  if (!isNative()) {
    await signInWithPopup(auth, appleProvider());
    return;
  }
  const { credential, name } = await nativeAppleCredential();
  const cred = await signInWithCredential(auth, credential);
  // Apple only shares the name on the very first sign-in; keep it for the setup screen
  if (name && !cred.user.displayName) await updateProfile(cred.user, { displayName: name }).catch(() => {});
}

/** Confirms it's really the user (needed before sensitive actions like deleting the account). */
export async function reauthenticateWithProvider(user: User, provider: SocialProvider): Promise<void> {
  if (!isNative()) {
    await reauthenticateWithPopup(user, provider === "apple" ? appleProvider() : new GoogleAuthProvider());
    return;
  }
  const credential = provider === "apple" ? (await nativeAppleCredential()).credential : await nativeGoogleCredential();
  await reauthenticateWithCredential(user, credential);
}

/** True when the user closed the sign-in sheet themselves (not worth an error message). */
export function isCancelled(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return true;
  return /cancel/i.test(e?.message ?? "");
}
