// src/lib/errors.ts

const MESSAGES: Record<string, string> = {
  // Auth
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/missing-email": "Please enter your email address.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Please choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Can't reach the server. Check your internet connection.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/missing-password": "Please enter your password.",
  "auth/requires-recent-login": "For your security, please sign in again and retry.",
  "auth/user-mismatch": "That's a different account. Use the one you're signed in with.",
  "auth/account-exists-with-different-credential":
    "You already have an account with this email. Sign in with your email and password instead.",
  "auth/operation-not-allowed": "This sign-in method isn't available yet. Please use your email.",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",

  // ChoreQuest
  "household-full":
    "This household is full on the free plan. Ask a member to upgrade to ChoreQuest Plus so you can join.",

  // Firestore
  "permission-denied": "You don't have permission to do that.",
  unavailable: "You seem to be offline. Please try again when you're connected.",
  "deadline-exceeded": "The server took too long to respond. Please try again.",
  "not-found": "That item no longer exists.",
};

/** Turns Firebase and other errors into a message that's safe to show users. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { code?: string; name?: string; message?: string } | null;
  if (e?.code && MESSAGES[e.code]) return MESSAGES[e.code];
  // Our own errors already have user-facing messages.
  if (e?.name === "AlreadyRecordedError" && e.message) return e.message;
  return fallback;
}
