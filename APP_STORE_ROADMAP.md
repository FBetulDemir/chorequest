# ChoreQuest — Roadmap to the App Store

What has to change for ChoreQuest to be **accepted on the Apple App Store (and Google Play)**, **sellable**, and **nicer to look at and use**. It's based on a review of the current codebase (Next.js 16 App Router, React 19, Tailwind 4, Firebase Auth and Firestore, deployed as a PWA on Vercel).

Priority legend:

- 🔴 **Blocker**: the app will be rejected, or it is unsafe to take money, without this
- 🟠 **High**: needed for a credible paid product and good reviews
- 🟢 **Nice to have**: polish and differentiation

---

## 0. Where the app stands today

**Strengths**

- The core loop already works: create chores → they show up on Today and Plan → complete, skip, or undo → points → leaderboard and monthly history.
- Every page is a client component (`"use client"`), so the app can be **statically exported** and wrapped as a native shell without a rewrite.
- The ledger model (append-only `households/{id}/ledger`) gives a good audit trail.
- The app already has a PWA manifest, icons, a service worker, starter chores, a grouped emoji picker, and a decent visual base (`cq-*` classes in `app/globals.css`).

**Main gaps**

- It's a website. Apple rejects web wrappers without native value (Guideline 4.2).
- Several Apple requirements are missing: account deletion, privacy policy, support URL, and Sign in with Apple once social login is added.
- No Firestore security rules are checked into the repo, and the client trusts itself for points.
- Data loads in bulk and doesn't update live (partner completions only show after a refresh).
- The UI looks like a polished prototype: text-only loading states, raw `YYYY-MM-DD` dates, emojis as the only visual language, no dark mode, no animations or celebration.

---

## 1. 🔴 App Store requirements

### 1.1 Turn the web app into a native app

Apple **Guideline 4.2 (Minimum Functionality)** rejects apps that are "just a website in a wrapper". Pick one of these:

| Option                                       | Effort     | Notes                                                                                                                                                                         |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Capacitor wrapper (recommended first)** | Low–Medium | Add `output: "export"` in `next.config.ts`, add `@capacitor/ios` and `@capacitor/android`, and reuse ~100% of the UI. Then add real native features (below) so it passes 4.2. |
| B. Expo / React Native rewrite               | High       | Best native feel and performance. `src/lib/*` (schedule, scoring, Firestore) can mostly be reused, but every screen gets rewritten.                                           |

Native features that justify the app (add at least 2 or 3):

- **Push notifications** (`@capacitor/push-notifications` + Firebase Cloud Messaging): "Your turn: 🗑️ Take out trash", "Partner completed Dishes (+20)", "Weekly winner is…"
- **Local reminders** at a time the user picks (`@capacitor/local-notifications`)
- **Haptics** when a chore is completed (`@capacitor/haptics`)
- **Native share sheet** for the household invite code (`@capacitor/share`)
- **Home-screen widget** (iOS WidgetKit / Android Glance): "3 chores left today"
- **Deep links / Universal Links**: `chorequest.app/join/AB12CD` opens the app and pre-fills the join code

Things to fix when moving to static export:

- `app/page.tsx` redirects with `router.replace` on the client. That works, but add a real landing or onboarding screen instead.
- `app/login/page.tsx` uses `useSearchParams` inside `Suspense`, which is OK for static export.
- Remove `maximumScale: 1, userScalable: false` from `app/layout.tsx`. It blocks zoom (an accessibility failure), and native apps handle zoom themselves.
- Handle iOS safe areas: add `viewport-fit=cover` and `env(safe-area-inset-*)` padding on the sticky header and the fixed bottom nav in `src/components/AppShell.tsx`.

### 1.2 Account and privacy requirements

- 🔴 **In-app account deletion** (Guideline 5.1.1(v)). Add a "Delete account" action in Settings that:
  - deletes `users/{uid}`
  - removes the user from `households/{id}.members`
  - deletes the household if it's now empty, or transfers ownership
  - calls Firebase `deleteUser()`, re-authenticating first if needed
  - Best done in a **Cloud Function** so it also cleans up ledger data.
- 🔴 **Privacy policy URL** and **Terms of Use**, linked in the app (Settings and the sign-up screen) and in App Store Connect.
- 🔴 **Support URL**: a simple page with a contact email.
- 🔴 **App Privacy "nutrition label"** in App Store Connect. Declare email, name, user ID, and usage data if analytics is added.
- 🔴 **Sign in with Apple** is mandatory **if** Google or another social login is added (Guideline 4.8). Recommended anyway, because it's the lowest-friction sign-up on iOS.
- 🟠 **Password reset** (`sendPasswordResetEmail`). Right now a user who forgets their password is locked out.
- 🟠 **Email verification** (`sendEmailVerification`) to cut down on fake accounts.
- 🟠 **GDPR** (the app targets Sweden and the EU): data export on request, consent for analytics, and a stated data retention period.

### 1.3 Store listing assets

- App name check: search the App Store and Google Play for "ChoreQuest" and "Chore Quest". Several chore apps use similar names. Have a fallback such as "ChoreQuest: Home Chores".
- App icon at 1024×1024 with no transparency. The current `public/icons/icon.svg` is a placeholder "✦" gradient, so commission or design a proper mascot or logo mark.
- Screenshots for iPhone 6.9" and 6.5" (plus iPad if iPad is supported) and Play Store phone screenshots. Use framed, captioned marketing screenshots ("Split chores fairly", "Earn points, win the week").
- An optional 15–30s App Preview video.
- Subtitle, keywords, description, promo text, category (Productivity or Lifestyle), and age rating (4+).
- **TestFlight** beta with 10–20 real households before launch.
- Apple Developer Program ($99/yr) and Google Play Console ($25 one-time).

---

## 2. 🔴 Security and data integrity (required before charging money)

### 2.1 Firestore security rules

There's no `firestore.rules` in the repo, so the rules live only in the Firebase console and can't be reviewed or versioned. Add `firestore.rules` + `firebase.json` and deploy them with the Firebase CLI. The rules must enforce:

- `users/{uid}`: only the owner can write; household members can read each other's `name`.
- `households/{hid}`: only members can read; a user can add **only themselves** to `members`, and only with a valid code.
- `households/{hid}/ledger/{id}`:
  - only members can create entries
  - `actorUid == request.auth.uid`
  - entries are **immutable** (no update or delete)
  - `delta` must equal the chore's `points` (or be 0 for a skip)
  - Right now a modified client can award itself any number of points.
- `households/{hid}/choreTemplates/{id}`: only members can write; validate field types and point ranges.

### 2.2 Household join flow

`joinHouseholdByCode` in `src/lib/households.ts` queries **all** households by `code`. For that to work, the rules must allow any signed-in user to _list_ households, which leaks data. Better:

- Store codes in a separate `inviteCodes/{CODE} → { householdId, expiresAt }` collection, readable by doc ID only.
- Or move join into a **Cloud Function** (`joinHousehold(code)`).
- Add code expiry and regeneration, plus rate limiting.
- Use `crypto.getRandomValues` instead of `Math.random()` for codes.

### 2.3 Race conditions and duplicate points

`complete()` in `app/today/page.tsx` and `app/plan/page.tsx` checks local state, then calls `addDoc`. Two partners tapping at once, or a double tap, both earn points. Fix:

- Use a **deterministic document ID** per occurrence, e.g. `completions/{templateId}__{dayKey}`, written in a transaction.
- Or use a Cloud Function that validates and writes.

### 2.4 Other

- Enable **Firebase App Check** (App Attest / Play Integrity) so only the real app can talk to Firestore.
- Remove the debug `console.log`/`console.error` calls (e.g. in `src/lib/households.ts` and `ServiceWorkerRegistration.tsx`).
- Show friendly error messages instead of raw Firebase strings such as `auth/invalid-credential` and `Missing user profile doc: users/...`. The raw strings appear in `app/login/page.tsx` and `src/components/RequireAuth.tsx`.

---

## 3. 🟠 Architecture and code quality

| Problem                                                                                                                                                 | Where                                                     | Fix                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ledger loaded in bulk (2,000–5,000 docs) on every page and after every action                                                                           | `today`, `plan`, `score`, `history` pages                 | Keep **aggregates** (per-user weekly and monthly totals) updated by Cloud Functions; query only the date range you need. |
| No live updates: partner actions show only after a manual Refresh                                                                                       | All pages use `getDocs`                                   | Use `onSnapshot` listeners and drop the Refresh buttons.                                                                 |
| Profile and household fetched again on every page                                                                                                       | Each page calls `getUserProfile` + `listHouseholdMembers` | One `HouseholdProvider` context, built on the existing `RequireAuth` subscriptions.                                      |
| `listHouseholdMembers` fetches profiles one at a time in a loop                                                                                         | `src/lib/members.ts`                                      | `Promise.all`, or store `{uid: {name, avatar}}` on the household doc.                                                    |
| Two separate `onAuthStateChanged` listeners                                                                                                             | `AuthProvider` + `RequireAuth`                            | Use `useAuth()` in `RequireAuth`.                                                                                        |
| Ledger type stored as text: `reason.startsWith("Completed:")`                                                                                           | Everywhere                                                | Add `type: "complete" \| "skip" \| "undo"` and `templateTitle` fields; keep `reason` for display only.                   |
| Icon stored inside the title (`"🧹 Sweep"`)                                                                                                             | `app/chores/page.tsx`                                     | Separate `icon` field on `ChoreTemplate`.                                                                                |
| Status and assignee logic copied across pages                                                                                                           | `today`, `plan`, `ledgerHelpers.ts`                       | One shared `useOccurrences()` hook or lib function.                                                                      |
| `ChoreSchedule.weekDay` / `monthDay` exist but aren't used. Chores repeat from `createdAt`, so users can't say "every Saturday".                        | `src/lib/schedule.ts`, `src/lib/types.ts`                 | Add a day picker; implement it in `buildOccurrences`.                                                                    |
| Missed chores disappear. Only today and future occurrences are built.                                                                                   | `src/lib/schedule.ts`                                     | Add an **Overdue** bucket.                                                                                               |
| Rotating assignee is `hash(templateId) + dayIndex`. It isn't fair, and it reshuffles whenever a member joins.                                           | `getAssigneeForOccurrence`                                | Store a rotation order and advance it on completion.                                                                     |
| Streak uses `toISOString()` (UTC), but day keys are local. It breaks around midnight in Sweden. Streak also only counts events inside the chosen range. | `app/score/page.tsx`                                      | Use the local `dayKeyFromTs`; compute streak over the full history.                                                      |
| 48 uses of `any`                                                                                                                                        | Throughout                                                | Type the Firestore converters (`withConverter`); validate with `zod`, which is already a dependency.                     |
| `window.location.reload()` after saving the name                                                                                                        | `app/setup/page.tsx`                                      | Update the context state instead.                                                                                        |
| No tests, no CI                                                                                                                                         | —                                                         | Vitest for `schedule.ts` / scoring; Playwright smoke tests; GitHub Actions (lint, typecheck, test).                      |
| No crash or error monitoring                                                                                                                            | —                                                         | Sentry or Firebase Crashlytics.                                                                                          |
| No analytics                                                                                                                                            | —                                                         | Firebase Analytics or PostHog (with consent) to measure onboarding drop-off and retention.                               |
| Offline                                                                                                                                                 | `src/lib/firebase.ts`                                     | `initializeFirestore(app, { localCache: persistentLocalCache() })` so the app works on the bus.                          |

---

## 4. 🟠 Monetization (making it sellable)

**Recommended model: freemium + subscription**, through **RevenueCat** (wraps StoreKit and Google Play Billing; handles receipts, trials, and entitlements). Apple requires In-App Purchase for digital features, so Stripe can't be used inside the app.

| Free                           | ChoreQuest Plus (e.g. 29 SEK/month or 249 SEK/year, family-shared) |
| ------------------------------ | ------------------------------------------------------------------ |
| 1 household, up to 2 members   | Unlimited members (families, roommates)                            |
| Up to 15 active chores         | Unlimited chores                                                   |
| Weekly and monthly leaderboard | Full history, stats, and charts                                    |
| Basic reminders                | Smart reminders, custom schedules ("every 2nd Tuesday")            |
| —                              | **Rewards shop** (spend points on real rewards)                    |
| —                              | Themes, avatars, custom icons                                      |
| —                              | Kids profiles with parent approval                                 |

Implementation notes:

- Entitlement should belong to the **household**, so one purchase covers everyone. Store `households/{id}.plan` and set it from a RevenueCat webhook → Cloud Function, never from the client.
- Add a paywall screen, a "Restore purchases" button (required by Apple), and a free trial (7 or 14 days).
- Provide links to manage or cancel the subscription.

---

## 5. 🟠 UX: friendlier and easier to use

### 5.1 Onboarding (first-run experience)

Today a new user lands on a plain login card (`app/login/page.tsx`, black button, different styling from the rest of the app), then a two-step Setup form.

- **Welcome carousel** (3 screens): "Share chores fairly" → "Earn points" → "Win the week 🏆".
- **Social sign-in**: Apple, Google, and email.
- **Guided setup wizard**, one question per screen:
  1. Your name and an avatar
  2. Create or join a household (join via link, QR code, or code)
  3. "Who lives with you?": invite via the share sheet
  4. **Pick starter chores** with checkboxes (reuse `starterChores` from `app/chores/page.tsx`), shown right away instead of hidden in the Chores tab
  5. Turn on notifications (ask with context, not on first launch)
- End on a celebration screen, then go to Today.

### 5.2 Navigation

- The bottom nav has Today / Plan / Score / Chores. Setup, History, and Monthly Scores are hidden in the "⋮" menu.
- Proposed tabs: **Today · Plan · Leaderboard · Household**. Household holds the chore list, members, invite, and settings.
- Add a **Profile/Settings** screen: name, avatar, notifications, theme, language, subscription, privacy, delete account, sign out.
- Make the header avatar open Profile (it currently goes to `/setup`).

### 5.3 Today screen (`app/today/page.tsx`)

- **Swipe to complete / swipe to skip** on mobile, with an **Undo** toast (5 seconds) instead of sending users to History.
- **Celebration on completion**: confetti or a points "+20" fly-up animation, plus haptics.
- Human-friendly dates: "Today", "Tomorrow", "Thu 23 Oct" instead of `2026-10-23`. Use `Intl.DateTimeFormat`.
- Show the assignee as an avatar chip, not text like `🔁 Betül`.
- Add a "**Mine / Everyone**" filter.
- A daily progress ring ("3 of 5 done").
- Overdue chores at the top, in a gentle warning color.
- The "Recurring Chores" section repeats items already listed under Due Today and Next 3 Days. Merge it into Plan.
- Pull-to-refresh, or live updates so no refresh is needed.

### 5.4 Chores (`app/chores/page.tsx`)

- Replace the native `confirm("Delete this chore?")` with an in-app bottom-sheet confirmation, or swipe-to-delete with undo.
- On mobile, the modal should be a **bottom sheet** with large touch targets.
- Use a points slider or preset chips ("Quick 10 · Medium 20 · Big 40") with a hint about effort.
- Add a day picker for weekly and monthly chores, plus a reminder time.
- Allow pausing a chore ("on vacation") without deleting it.
- Make "Add starter chores" available at any time.

### 5.5 Leaderboard (`app/score/page.tsx`)

- A podium view for the top 3 with avatars.
- **Weekly winner** announcement and history ("Betül won 4 weeks in a row 👑").
- Charts: points per week and a chore split ("Who did what?"). This also answers "is it fair?"
- Fix streaks (see §3) and show 🔥 streak badges.

### 5.6 Household

- Member list with avatars, roles (owner / member / kid), and remove or leave actions. These don't exist yet; leaving a household is impossible today.
- Rename the household and regenerate the invite code.
- Invite with a **QR code** and a share link.

### 5.7 Feedback states

- Replace every `Loading...` text with **skeleton cards**.
- Design empty states with illustrations for each screen: no chores yet, no history, alone in the household (invite someone).
- Show errors as friendly toasts with a retry button.
- Offline banner: "You're offline; changes will sync".
- Show button busy states as spinners instead of `"..."`.

### 5.8 Accessibility

- Allow zoom (see §1.1). Support Dynamic Type and system font scaling.
- Add `aria-label`s to icon-only buttons (`⋮`, emoji icons), and give real `<label>`s to inputs (`placeholder` alone is not a label).
- Color contrast: `text-gray-500` on the light purple background is borderline; check against WCAG AA.
- Make sure emojis aren't the only carrier of meaning (screen readers read "broom" and "fire").
- Minimum 44×44pt touch targets.
- Respect `prefers-reduced-motion` for confetti and animations.

### 5.9 Localization

- Add i18n (`next-intl` or similar). Start with **English, Swedish, and Turkish**.
- Use locale-aware dates, numbers, and week start (`startOfLocalWeekMs` hardcodes Monday).

---

## 6. 🟠 Visual design: making it prettier

### 6.1 Design system

- **Brand identity**: a proper logo and **mascot** (e.g. a friendly broom or house character). Mascots carry a lot in gamified apps: empty states, celebrations, notifications.
- **Typography**: no custom font is loaded. Use `next/font` with a rounded, friendly typeface (Nunito, Quicksand, or Plus Jakarta Sans) and set a type scale (display / title / body / caption).
- **Color tokens**: extend the `--cq-*` variables in `app/globals.css` into a full palette (primary, success, warning, danger, neutral 50–900). Many components hardcode Tailwind colors (`bg-emerald-50`, `text-amber-700`, …); route them through tokens.
- **Dark mode**: currently not supported (0 `dark:` classes). Add a dark palette with the same tokens, following the system setting with a manual toggle.
- **Icons**: emojis render differently on iOS, Android, and Windows. Use a consistent icon set (Phosphor, Lucide, or custom illustrated chore icons) for UI, and keep emojis as an optional "fun" choice for chore avatars.
- **Components**: extract `Button`, `Card`, `Chip`, `Avatar`, `Sheet`, `Toast`, `Skeleton`, `EmptyState`, and `ProgressRing` into `src/components/ui/`. Today, styles like the Complete button's gradient are long inline class strings in each page.
- **Motion**: Framer Motion (or `motion`) for list add and remove, tab transitions, sheet open and close, and points animations.

### 6.2 Gamification visuals (the "Quest" in ChoreQuest)

- **Levels and XP bar** for each user (Level 7 · "Tidy Knight").
- **Badges and achievements**: "First chore", "7-day streak", "Bathroom hero (10 cleanings)", "Early bird".
- **Weekly quests**: "Complete 5 kitchen chores this week → bonus 50 pts".
- **Rewards shop**: the household defines rewards ("Pick the movie: 200 pts", "Breakfast in bed: 500 pts") and members redeem their points. This is the strongest reason to keep using the app.
- **Avatars** with unlockable accessories.
- Seasonal themes (winter cleaning, spring cleaning).

### 6.3 App icon and splash

- New app icon with the mascot or mark, legible at small sizes.
- Native splash screen (Capacitor Splash Screen) in brand colors.
- Fix the manifest: split `"purpose": "maskable any"` into separate `any` and `maskable` icons with correct safe-zone padding (`public/manifest.json`).

---

## 7. Suggested order of work

### Phase 1: Foundation (2–3 weeks)

- [~] Firestore rules + `firebase.json` in the repo (§2.1). Drafted in `firestore.rules`; **not tested or deployed yet**
- [x] Ledger `type` field and deterministic completion IDs (§2.3, §3)
- [ ] Separate `icon` field. Postponed: the deployed app still reads the emoji from the title
- [x] `HouseholdProvider` + live `onSnapshot` updates (§3)
- [x] Password reset and friendly errors (§1.2)
- [ ] Account deletion (§1.2). Needs the rules deployed first (and ideally a Cloud Function)
- [x] Vitest for `schedule.ts` and scoring; GitHub Actions CI

Also done in Phase 1:
- [x] Bugs fixed:
  - Plan matched completions by tap date instead of due date, highlighted every card as "Today", and sorted wrongly
  - History allowed undoing the same completion twice
  - Undoing a partner's chore took points from the wrong person
  - Streaks used UTC days
  - Paused chores still appeared on Today and Plan
- [x] Firestore offline cache; zoom re-enabled; dead code removed; lint clean

### Phase 2: Look and feel (3–4 weeks)

- [x] Design tokens, Nunito font, dark mode (System/Light/Dark), UI component library (§6.1)
- [x] Welcome tour and step-by-step setup wizard: name and avatar, household, invite, starter chores (§5.1)
- [x] Today redesign (§5.3, §5.7):
  - progress ring, streak, "Just me" filter, overdue "Catch up" section
  - swipe to complete, confetti, haptics, Undo toast
  - friendly dates and skeleton loaders
- [x] Navigation: Today · Plan · Leaders · Household tabs, plus a Profile/Settings screen (§5.2)
- [x] Mascot ("Tidy"), new app icon (rounded and maskable), manifest fixes
- [x] Restyled Plan (grouped by day), Activity (with undo), Leaderboard (podium, badges), monthly scores
- [x] In-app sheets replace `confirm()`; shared Button/Sheet/Toast/Avatar components
- [ ] Brand illustrations from a designer (the mascot is a placeholder-quality SVG)
- [ ] Day picker for weekly/monthly chores (§5.4). Needs a schedule change that the deployed app can't read yet

### Phase 3: Native app (2–3 weeks)

1. Static export + Capacitor iOS/Android (§1.1)
2. Push notifications and reminders (Cloud Functions + FCM)
3. Haptics, share sheet, deep links, safe areas
4. Sign in with Apple and Google
5. Sentry/Crashlytics, analytics, App Check

### Phase 4: Monetization and launch (2–3 weeks)

1. RevenueCat + paywall + household entitlements (§4)
2. Rewards shop and badges (the main Plus features) (§6.2)
3. Privacy policy, terms, support page, landing website
4. Store listing: screenshots, video, keywords, privacy label
5. TestFlight / Play internal testing with real households → fix → submit

### Phase 5: After launch

- Home-screen widget, Apple Watch / Wear OS quick complete
- Swedish and Turkish localization
- Kids profiles with parent approval
- Smart suggestions ("You usually vacuum on Sundays")
- Calendar sync (iCal feed of chores)

---

## 8. Pre-submission checklist

- [ ] Native features present (push, haptics, share, deep links); not just a web view
- [ ] Account deletion inside the app
- [ ] Sign in with Apple (if any social login exists)
- [ ] Privacy policy, terms, support URL live and linked
- [ ] App Privacy label filled in App Store Connect
- [ ] Firestore rules deployed and tested (Firebase emulator tests)
- [ ] App Check enabled
- [ ] IAP via StoreKit/RevenueCat, "Restore purchases" button, subscription terms shown on paywall
- [ ] Demo account credentials for the Apple reviewer (a household with sample chores)
- [ ] No debug logs, no raw error strings, no placeholder text
- [ ] Works offline and with poor network; no infinite "Loading..."
- [ ] Zoom and Dynamic Type allowed, VoiceOver labels on all buttons
- [ ] Safe areas correct on notched iPhones and iPad (or iPad disabled)
- [ ] Icons, splash, and screenshots for all required sizes
- [ ] Crash-free TestFlight run with real users

## 9. Git Commits

- [ ] commit every major developments with relevant commit message ( short descriptive)
