# DareStake

**Mutual accountability with money on the line.** Two people assign each other a daily dare. Miss the deadline and you're automatically fined into a shared "Gold Jar" you can both see — a random amount up to a ceiling the two of you agree on (₹50 by default).

Built as a real two-person app, not a demo — a PWA you install on your phone, with time-stamped check-ins, photo proof, and a dispute mechanism for when your partner doesn't believe you.

🔗 **Live:** [darestake-sigma.vercel.app](https://darestake-sigma.vercel.app)

---

## How it works

1. **Pair up** — one person generates a 6-character invite code, the other enters it. Strictly two people per pair.
2. **Assign a dare** — pick from 36 templates across 5 categories, or write your own. Assign it to your partner or to yourself.
3. **Set the stakes** — dares default to a midnight IST deadline. Add a *check-in time* (e.g. "07:00") and the deadline becomes that time plus a 30-minute grace window. Either partner can set the **maximum fine** in Profile → Stakes; it applies to both of you, since the jar is shared.
4. **Complete it** — mark it done before the deadline. Optionally attach photo proof.
5. **Or pay** — a penalty engine sweeps for missed dares and moves a random amount, up to your configured maximum, into the shared Gold Jar. Your streak resets.
6. **Witness mode** — your partner can dispute a completion with "👀 Prove it", which demands photo proof before the dispute can be settled.

Reactions (🔥 💪 👏 😤), streaks, weekly summaries, and an insights page with day-of-week failure patterns round it out.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Auth | Firebase Auth — Google sign-in |
| Data | Cloud Firestore (real-time listeners throughout) |
| Styling | Tailwind CSS v4 |
| Motion | Framer Motion |
| Icons | lucide-react |
| Hosting | Vercel |
| Tests | Vitest (unit) + Firebase Rules API (security rules) |

No backend server and no Cloud Functions — the whole thing runs on Firebase's free Spark tier.

---

## Architecture notes

The parts that are genuinely non-obvious.

### Timezone handling is centralised on purpose

The app is IST-only (UTC+05:30) and every date decision — which dare is "today", when a deadline expires, which day a task belongs to — flows through a single module, [`src/lib/ist.ts`](src/lib/ist.ts).

This exists because of a real bug. Seven files independently computed IST as:

```ts
new Date(now.getTime() + IST_OFFSET + now.getTimezoneOffset() * 60_000)
```

`getTime()` already returns a timezone-independent UTC epoch, so the `getTimezoneOffset()` term is a double-correction. On a device already in IST it's `-330` minutes, which exactly cancels `IST_OFFSET` and leaves raw UTC. **Between 00:00 and 05:30 IST every date in the app was a day behind** — silently breaking task dating, today's-task lookups, and the penalty engine every single night, while looking perfectly fine for the other 18.5 hours.

The rule the module enforces:

- To **read** IST wall-clock fields: shift the epoch by +5:30 and read the **UTC** fields (`getUTC*` / `toISOString`). Never mix local getters with a shifted epoch.
- To **convert** IST wall-clock back to a real instant: `Date.UTC(...) - IST_OFFSET_MS`.

It's covered by 52 unit tests, including a regression guard that encodes the original buggy formula and asserts the implementation diverges from it inside the broken window.

### The penalty engine is client-side but race-safe

There's no cron and no server. `checkAndApplyPenalties(pairId)` is fired fire-and-forget from the app's data provider on load — which means it runs on **both** partners' devices, potentially simultaneously.

Each missed dare is therefore *claimed* inside a `runTransaction` that bails if `penaltyApplied || isCompleted` before any money moves. Without that, both clients would sweep the same missed dare and charge it twice.

It also sweeps a 14-day lookback window rather than just yesterday, so skipping the app for a few days doesn't let missed dares escape unpenalised forever.

### One dare per person per day is a datastore constraint

Task documents use a deterministic ID — `${pairId}_${assignedTo}_${date}` — claimed in a transaction. Uniqueness is structural rather than checked in the UI, because a client-side transaction can't run queries (only `tx.get` on a known ref), so a query-based guard could never be atomic. Two tabs, a double-tap, or a retry after a timeout that actually succeeded can no longer produce a duplicate (and therefore a double fine).

### The stakes belong to the pair, not the user

`maxFine` lives on the **pair** document rather than either user's, because the
jar is shared: two people cannot meaningfully be playing for different amounts
into the same pot. Either partner can change it, and both immediately see the
same number.

The floor stays at ₹10 but is *clamped down* when the configured maximum is
lower — otherwise a max of ₹5 would invert the range and
`Math.random() * (max - min + 1)` would go negative, producing nonsense fines
against real money. `fineRange()` in
[`src/lib/firestore-schema.ts`](src/lib/firestore-schema.ts) is the single place
that resolves this, and it's unit-tested for inversion, fractional input, and
out-of-bounds values.

Pairs created before the setting existed have no `maxFine` field at all, so it's
optional and falls back to the ₹50 default rather than requiring a migration.

### Security rules are pair-scoped and tested

Every document belongs to a *pair*, and [`firestore.rules`](firestore.rules) grants access only when the document's `pairId` matches the `pairId` on the caller's own user doc. Beyond that:

- `/users` cannot be **listed** — no enumerating accounts by email.
- `goldJarEntries` are **append-only** — a fine can't be edited or erased.
- Tasks can't be moved between pairs (both old and new `pairId` must match).
- Invite codes can't be listed, and can't be forged in someone else's name.

Two places are deliberately open, documented inline: any signed-in user can `get` a profile (the accepter must read the inviter's doc *before* they're linked, so it can't be pair-scoped), and invite reads are open because knowing the 6-character code *is* the credential.

These rules are verified by 36 assertions run against Google's real Rules engine — see [Testing](#testing).

### Auth is redirect-only on the login page

Firebase's `signInWithPopup` is unusable in an installed PWA on Android: Cross-Origin-Opener-Policy blocks the `window.closed` polling the SDK uses to detect a closed popup, so the promise can **hang instead of rejecting** — meaning a `try { popup } catch { redirect }` fallback never reaches the redirect and the user is stranded on a spinner.

[`src/app/login/page.tsx`](src/app/login/page.tsx) is therefore redirect-only, and `signInWithPopup` is not imported there at all. `authDomain` must stay on the `*.firebaseapp.com` domain rather than the deployment domain for the redirect handler to work.

### Data loads once, not per page

`UserDataProvider` ([`src/hooks/useUserData.tsx`](src/hooks/useUserData.tsx)) subscribes to the user and partner documents once and persists across navigation. This replaced per-page refetching that flashed a full-screen spinner on every tab switch. Page-level loading states render the header and bottom nav with a small inline spinner — never a full-screen blocker.

The dashboard additionally re-keys its task subscription at IST midnight via `msUntilNextMidnightIST()`, because `subscribeToTodayTask` resolves "today" once when it subscribes — without that, a phone left open overnight keeps showing yesterday's dare.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Firebase project with **Authentication** (Google provider) and **Cloud Firestore** enabled
- `firebase-tools` if you want to deploy rules or run the rules tests

### Setup

```bash
git clone https://github.com/Tech-aficionado/darestake.git
cd darestake
npm install
```

Create `.env.local` with your Firebase web config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> **Keep `AUTH_DOMAIN` on `*.firebaseapp.com`.** Pointing it at your deployment domain breaks the `signInWithRedirect` handler.

Deploy the security rules and indexes, then run:

```bash
firebase deploy --only firestore:rules,firestore:indexes
npm run dev
```

---

## Testing

```bash
npm test              # 60 unit tests (Vitest) — IST dates + fine range
npm run test:watch    # watch mode
npm run test:rules    # 36 Firestore security-rule assertions
```

**`npm test`** covers `src/lib/ist.ts`: midnight boundaries, month/year rollovers, leap days, the 00:00–05:30 window the original bug lived in, and cross-function invariants. Every assertion is an absolute ISO instant or fixed date string, so the suite is timezone-independent by construction — reintroduce a `getTimezoneOffset()` term and it fails on any machine whose local offset isn't zero.

**`npm run test:rules`** evaluates `firestore.rules` against Google's real Rules engine via the `firebaserules projects:test` API — no emulator and no JDK required. It covers both directions: that legitimate access is *allowed* (reading your own pair's tasks, the penalty sweep writing your partner's doc, claiming an inviter during pairing) and that everything else is *denied* (cross-pair reads, user enumeration, editing the fine ledger, forging invites). It authenticates using your existing `firebase login` credentials, read from the local `firebase-tools` config.

Testing both directions matters: a rules suite that only asserts `DENY` passes trivially when the rules are broken enough to deny everything.

---

## Project structure

```
src/
  app/
    page.tsx           landing
    login/             dedicated redirect-only auth page
    dashboard/         today's dare, countdown, witness mode
    assign/            create a dare (templates, check-in time)
    jar/               shared Gold Jar + fine ledger
    insights/          streaks, day-of-week failure patterns
    pair/              invite code generate / accept
    profile/           settings, notifications, unpair
    history/           full task history (deep link)
  components/          UI primitives, PhotoProof, WitnessMode
  contexts/            AuthContext
  hooks/               useUserData (single-load user + partner)
  lib/
    ist.ts             ← all date logic lives here
    ist.test.ts
    firestore.ts       writes, penalty engine, pairing, streaks
    firestore-realtime.ts  onSnapshot subscriptions
    firestore-schema.ts    types, status derivation, fineRange()
    fine-range.test.ts
    notifications.ts   permission, delivery, deadline reminders
scripts/
  test-rules.mjs        security-rules test suite
firestore.rules        pair-scoped authorization
firestore.indexes.json composite indexes
public/sw.js           manual service worker (PWA + notifications)
```

### Firestore collections

| Collection | Key | Notes |
|---|---|---|
| `users` | uid | profile, `pairId`, `streak`, `totalPenalties` |
| `pairs` | auto | `members: [uid, uid]`, `isActive`, `maxFine` |
| `pairInvites` | 6-char code | expires after 24h, deleted on use |
| `tasks` | `${pairId}_${assignedTo}_${date}` | deterministic — enforces one per day |
| `goldJars` | pairId | running total |
| `goldJarEntries` | auto | append-only fine ledger |
| `streaks` | `${uid}_${pairId}` | current + longest |

---

## Notes and constraints

- **PWA notifications** are delivered by the browser `Notification` API through the service worker registration — there's no FCM server. On Android, notifications must go through `registration.showNotification()`; constructing `new Notification()` directly throws `Illegal constructor`.
- **The service worker is hand-written** (`public/sw.js`) rather than generated. `next-pwa` is incompatible with Next 16's Turbopack build.
- **Firestore rejects `undefined`** field values outright — optional fields must be *omitted*, not set to `undefined`.
- **Free-tier friendly:** two users sit at roughly 0.2% of Firestore's daily free limits.

---

## License

[MIT](LICENSE) © Shivansh Goel

