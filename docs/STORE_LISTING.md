# ChoreQuest: store listing and launch checklist

Copy for App Store Connect and Google Play Console, the answers their forms ask for, and a final checklist before you press **Submit**. Character limits are noted; every text below fits.

---

## 1. Listing text

**App name** (App Store max 30, Play max 30)
> ChoreQuest: Share Home Chores

Search both stores for "ChoreQuest" first. If the name is taken, fall back to "ChoreQuest: Chores & Rewards".

**Subtitle** (App Store, max 30)
> Fair chores, points & rewards

**Short description** (Google Play, max 80)
> Share household chores fairly, earn points, win the week and get real rewards.

**Promotional text** (App Store, max 170, can change without a new review)
> Turn housework into a friendly game: split chores fairly, earn points for every task and spend them on real treats like movie night or breakfast in bed.

**Description** (max 4000)

> Who did the dishes last? With ChoreQuest, nobody has to keep score in their head again.
>
> ChoreQuest turns household chores into a friendly game for couples, families and roommates. Plan who does what, tick chores off with a swipe, earn points and see who's carrying the household this week.
>
> SHARE CHORES FAIRLY
> • Daily, weekly, monthly and seasonal chores
> • Assign a chore to one person, take turns automatically, or let anyone grab it
> • See today's chores, what's coming up, and anything you missed
>
> EARN POINTS, WIN THE WEEK
> • Quick jobs earn a little, big jobs earn a lot
> • Weekly and monthly leaderboards with a podium for the top three
> • Streaks and badges like Early bird, Week warrior and Household hero
>
> REAL REWARDS
> • Create rewards together: pick the movie, a lie-in, breakfast in bed
> • Spend the coins you earn; your leaderboard score stays intact
>
> MADE FOR YOUR HOUSEHOLD
> • Invite people with a link or a 6-letter code
> • Everything syncs live between phones
> • Daily reminders and notifications when someone gets things done
> • Beautiful light and dark mode
>
> CHOREQUEST PLUS
> Free households can have 2 members and 15 chores. Plus unlocks unlimited members and chores and the rewards shop, and one subscription covers the whole household.
>
> Plus is an auto-renewing subscription. Payment is charged to your Apple ID or Google Play account at confirmation and renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel any time in your account settings.
>
> Terms: https://chorequest-game.vercel.app/terms
> Privacy: https://chorequest-game.vercel.app/privacy

**Keywords** (App Store, max 100, comma-separated, no spaces)
> chores,chore chart,household,family,roommates,couples,cleaning,tasks,rewards,points,planner,home

**URLs**
| Field | Value |
|---|---|
| Support URL | https://chorequest-game.vercel.app/support |
| Marketing URL | https://chorequest-game.vercel.app/welcome |
| Privacy Policy URL | https://chorequest-game.vercel.app/privacy |

**Categories:** Productivity (primary), Lifestyle (secondary)

**What's new in 1.0**
> Welcome to ChoreQuest! Share chores fairly, earn points, win the week and treat yourselves with rewards. 🏡✨

## 2. Screenshots

Required sizes:
- App Store: 6.9" iPhone (1320 × 2868) and 6.5" (1284 × 2778). iPad too, unless you limit the app to iPhone in Xcode.
- Google Play: at least 2 phone screenshots (1080 × 1920 or larger) and a 1024 × 500 feature graphic.

Take them on a simulator with a demo household that has realistic names and chores. Add a short caption above each on a purple gradient. Canva or Figma templates work well.

| # | Screen | Caption |
|---|---|---|
| 1 | Today, with progress ring and chores | **Share chores fairly** |
| 2 | Completing a chore (confetti, "+20") | **Tick it off, earn points** |
| 3 | Leaderboard podium | **Win the week together** |
| 4 | Rewards shop | **Turn points into real treats** |
| 5 | Plan, grouped by day | **Plan the next 30 days** |
| 6 | Today in dark mode | **Beautiful, day and night** |

An optional 15–30 second App Preview: swipe to complete → confetti → leaderboard → redeem a reward.

## 3. Pricing (suggestion)

| Product | Sweden | Rest of world (equivalent) |
|---|---|---|
| `plus_monthly` | 29 kr | $2.99 |
| `plus_yearly` (7-day free trial) | 249 kr | $24.99 (≈30% off monthly) |

Set the price once in App Store Connect / Play Console; both stores convert it to other currencies.

## 4. App Privacy (App Store) and Data safety (Google Play)

**Tracking:** No. The app doesn't track users across other companies' apps or websites.

| Data type | Collected | Linked to user | Purpose |
|---|---|---|---|
| Email address | Yes | Yes | App functionality (account) |
| Name | Yes (display name) | Yes | App functionality |
| User ID | Yes | Yes | App functionality |
| Other user content (chores, rewards) | Yes | Yes | App functionality |
| Purchase history | Yes (Plus) | Yes | App functionality |
| Device ID (push token) | Yes, if notifications are on | Yes | App functionality |
| Product interaction | Only with opt-in analytics | No | Analytics |
| Crash data | Only with opt-in analytics | No | Analytics |

- **Google Play Data safety:** the same items. Data is encrypted in transit: **Yes**. Users can request deletion: **Yes**, in-app (Profile → Delete account) plus the Privacy page.
- Google also asks for a **web link for account deletion**: use https://chorequest-game.vercel.app/support (it explains the in-app path).

If you never set `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`, leave out the two analytics rows.

## 5. Age rating

Answer **None** to every content question. There is no unrestricted web access and no public user-generated content (chores are visible only within a household). Expected rating: **4+** (App Store), **Everyone** (Play).

## 6. Notes for App Review

Create a demo account with a household that already has chores, rewards and some history, then paste this into **App Review Information → Notes**:

> Demo account: review@<your-domain> / <password>
> The account belongs to a household with a second member, so the leaderboard and shared features are visible.
>
> • Complete a chore: tap the circle (or swipe right) on the Today tab.
> • Rewards: Leaders tab → Rewards shop.
> • ChoreQuest Plus: Profile → ChoreQuest Plus. Sandbox purchases work with your review account; "Restore purchases" is on the same screen.
> • Account deletion: Profile → Delete account.
> • Sign in with Apple is available on the sign-in screen.
> • Notifications are optional and requested only when turned on in Profile.

## 7. Launch checklist

**Accounts and agreements**
- [ ] Apple Developer Program and Google Play Console accounts
- [ ] Paid Apps agreement, banking and tax (Apple); payments profile (Google)

**Backend**
- [ ] Back up the current Firestore rules, then deploy `firestore.rules`
- [ ] Blaze plan; set the `REVENUECAT_WEBHOOK_AUTH` secret; deploy Cloud Functions
- [ ] RevenueCat products, `plus` entitlement, `default` offering, webhook test returns 200

**App configuration** (`.env.local` and Vercel; see docs/MOBILE.md §3)
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` and `NEXT_PUBLIC_LEGAL_NAME` (shown on legal pages)
- [ ] Firebase iOS/Android apps registered; config files added
- [ ] Push: APNs key, Xcode capabilities, `NEXT_PUBLIC_PUSH_ENABLED=1`
- [ ] Sign in with Apple and Google configured, then both `NEXT_PUBLIC_AUTH_*` flags on
- [ ] RevenueCat keys, `NEXT_PUBLIC_FOUNDERS_BEFORE`, then `NEXT_PUBLIC_PAYWALL_ENABLED=1`
- [ ] Deep link files (`assetlinks.json`, `apple-app-site-association`) published

**Quality**
- [ ] Bundle ID final (`com.chorequest.app` or your own)
- [ ] Test on a real iPhone and Android phone: sign up, join via link, complete/undo, rewards, reminders, push, purchase, restore, delete account
- [ ] TestFlight and Play internal testing with 2–3 real households for a week
- [ ] Privacy Policy and Terms reviewed by someone with legal knowledge

**Store**
- [ ] Screenshots, icon (from `assets/`), description, keywords, privacy answers, age rating
- [ ] Demo account and review notes
- [ ] Submit 🚀
