# ChoreQuest mobile apps: setup guide

ChoreQuest ships as one codebase. The Next.js app is exported as static files and wrapped by [Capacitor](https://capacitorjs.com) into native iOS and Android apps (`ios/` and `android/`). The web version on Vercel keeps working as before.

Everything in this guide needs your own accounts, a Mac, or the Firebase console, so it can't be done from code alone. Each feature stays switched off (hidden or disabled in the UI) until its step is done, so the app never shows a broken button.

---

## 1. Requirements

| | iOS | Android |
|---|---|---|
| Computer | Mac | Mac, Windows or Linux |
| Tools | Xcode 16+, CocoaPods (`sudo gem install cocoapods`) | Android Studio (latest), JDK 21 |
| Account | Apple Developer Program ($99/yr) | Google Play Console ($25 once) |

## 2. Build and run

```bash
npm install
npm run build:mobile      # static export to out/ + copy into ios/ and android/
npm run ios               # build:mobile, then open Xcode   (Mac only)
npm run android           # build:mobile, then open Android Studio
```

Press ▶ in Xcode or Android Studio to run on a simulator or a plugged-in phone.

**Live reload on a phone while developing.** Start `npm run dev -- -p 3001`, find your computer's Wi-Fi IP (e.g. `192.168.0.201`), then run:

```bash
CAP_SERVER_URL=http://192.168.0.201:3001 npx cap run android   # or: npx cap run ios
```

The app then loads the dev server and updates as you edit. Don't ship a build made with `CAP_SERVER_URL` set.

You can also just open `http://<your-ip>:3001` in your phone's browser on the same Wi-Fi.

**Bundle ID** is `com.chorequest.app` (set in `capacitor.config.ts`). Change it *before* the first store upload if you want one based on a domain you own. It can't be changed afterwards.

## 3. Environment variables

Add these to `.env.local` (and to Vercel's project settings for the web build) as each feature is set up:

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public web address used in invite links | `https://chorequest-game.vercel.app` (default) |
| `NEXT_PUBLIC_PUSH_ENABLED` | Turns on the push notification switch (§5) | `1` |
| `NEXT_PUBLIC_AUTH_APPLE` | Shows "Sign in with Apple" (§6) | `1` |
| `NEXT_PUBLIC_AUTH_GOOGLE` | Shows "Continue with Google" (§6) | `1` |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google sign-in in the apps | `1234-abc.apps.googleusercontent.com` |
| `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google sign-in on iOS | `1234-ios.apps.googleusercontent.com` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Opt-in usage analytics (§8) | `G-XXXXXXX` |

Rebuild (`npm run build:mobile`) after changing them; they're baked into the app at build time.

## 4. Register the apps in Firebase

1. Firebase console → Project settings → **Add app**.
   - **iOS**: bundle ID `com.chorequest.app`. Download `GoogleService-Info.plist` and add it to `ios/App/App/` in Xcode (tick "Copy items if needed").
   - **Android**: package `com.chorequest.app`. Download `google-services.json` to `android/app/`.
2. Android only: add the SHA-1 and SHA-256 fingerprints of your debug and release signing keys (needed for Google sign-in and app links):
   ```bash
   cd android && ./gradlew signingReport
   ```

These two files contain project identifiers, not secrets. They can be committed, but keep them out of public repos if you prefer.

## 5. Push notifications

The Household activity switch (Profile → Reminders) registers the phone and stores its token at `users/{uid}/pushTokens/{token}`. Cloud Functions in `functions/` send:
- **notifyChoreCompleted**: "Betül completed 🍽️ Do Dishes (+20)" to the other household members.
- **announceWeeklyWinner**: Sundays at 20:00 Stockholm time.

### iOS
1. Apple Developer → Keys → create an **APNs key**. Upload it in Firebase → Project settings → Cloud Messaging → Apple app configuration.
2. Xcode → App target → Signing & Capabilities → add **Push Notifications** and **Background Modes → Remote notifications**.
3. Add Firebase Messaging so iOS hands the app an FCM token (from Capacitor's official Firebase guide):
   - `ios/App/Podfile`, inside `target 'App' do`: `pod 'FirebaseMessaging'`, then `npx cap sync ios`.
   - `ios/App/App/AppDelegate.swift`:
     ```swift
     import FirebaseCore
     import FirebaseMessaging

     // in application(_:didFinishLaunchingWithOptions:), before `return true`:
     FirebaseApp.configure()

     func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
         Messaging.messaging().apnsToken = deviceToken
         Messaging.messaging().token { token, error in
             if let error = error {
                 NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
             } else if let token = token {
                 NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
             }
         }
     }

     func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
         NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
     }
     ```

### Android
Nothing beyond `google-services.json` (§4).

### Server side
1. Upgrade the Firebase project to the **Blaze** (pay-as-you-go) plan. Cloud Functions need it, but this usage stays far inside the free tier.
2. Deploy the security rules first: they now include `pushTokens`. **Back up your current rules from the console before deploying.**
   ```bash
   npx firebase deploy --only firestore:rules --project chore-quest-22419
   npx firebase deploy --only functions --project chore-quest-22419
   ```
3. Set `NEXT_PUBLIC_PUSH_ENABLED=1` and rebuild.

> Until steps 4–5 are done, keep `NEXT_PUBLIC_PUSH_ENABLED` unset. Registering without `google-services.json` crashes the Android app, which is why the switch is gated.

## 6. Sign in with Apple and Google

Apple requires "Sign in with Apple" in the iOS app whenever another social login (Google) is offered (App Review Guideline 4.8). Enable both together.

### Firebase
Firebase console → Authentication → Sign-in method → enable **Google** and **Apple**.

### Apple
1. Apple Developer → Identifiers → your App ID → enable **Sign in with Apple**.
2. Xcode → Signing & Capabilities → add **Sign in with Apple**.
3. Web (optional): create a **Services ID** with your domain and Firebase's return URL (shown in the Firebase Apple provider panel), plus a Sign in with Apple key. Enter both in Firebase.
4. Set `NEXT_PUBLIC_AUTH_APPLE=1`.

Apple is shown on iPhone and the web, not on Android (Google covers Android).

### Google
1. `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Firebase → Authentication → Google provider → **Web SDK configuration → Web client ID**.
2. `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`: `CLIENT_ID` in `GoogleService-Info.plist`.
3. iOS: add `REVERSED_CLIENT_ID` from the same plist as a URL scheme. Xcode → App target → Info → URL Types → +.
4. Android: the SHA-1 fingerprints from §4 must be registered.
5. Set `NEXT_PUBLIC_AUTH_GOOGLE=1`.

> ⚠️ **Existing email/password accounts.** If someone whose email address isn't verified signs in with Google using the same address, Firebase merges the accounts and **removes the password sign-in** (their data stays, same user ID). They can add a password back with "Forgot password?". To avoid surprises, existing users should keep using email and password, or verify their email first.

## 7. Invite links (deep links)

Invites share `https://chorequest-game.vercel.app/join?code=AB12CD`. Without the app, the link opens the web join page. With these files in place, it opens the installed app directly. The custom scheme `chorequest://join?code=…` already works.

### Android App Links
Create `public/.well-known/assetlinks.json` (SHA-256 from §4, release key):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.chorequest.app",
    "sha256_cert_fingerprints": ["AA:BB:...:FF"]
  }
}]
```

The intent filter is already in `android/app/src/main/AndroidManifest.xml`.

### iOS Universal Links
1. Create `public/.well-known/apple-app-site-association` (no file extension), with your Team ID:
   ```json
   { "applinks": { "details": [{ "appIDs": ["TEAMID.com.chorequest.app"], "components": [{ "/": "/join*" }] }] } }
   ```
2. Xcode → Signing & Capabilities → **Associated Domains** → `applinks:chorequest-game.vercel.app`.

Deploy the web app after adding the files. If you move to your own domain, update `NEXT_PUBLIC_APP_URL`, the Android intent filter host and the associated domain.

## 8. Analytics (optional)

Set `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (Firebase → Project settings → your web app). A **Share anonymous usage stats** switch then appears in Profile → Privacy. It's off by default, and nothing is collected until the user turns it on. The events are screen views, chores completed and app errors.

In App Store Connect's privacy section, declare **Usage Data → Product Interaction**, not linked to the user, used for analytics.

## 9. Daily reminders

Nothing to configure. Profile → Reminders schedules a local notification on the phone at the chosen time.

## 10. Releasing

1. Bump versions:
   - Android: `versionCode` / `versionName` in `android/app/build.gradle`
   - iOS: Xcode → App target → General → Version / Build
2. `npm run build:mobile`.
3. iOS: Xcode → Product → **Archive** → Distribute → App Store Connect → test via **TestFlight**.
4. Android: Android Studio → Build → **Generate Signed App Bundle** → upload to Play Console → **Internal testing**.

Icons and splash screens come from `assets/`. Regenerate them with `npm run assets:native` after changing the artwork (`scripts/generate-native-assets.js`).
