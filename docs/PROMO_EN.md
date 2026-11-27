# English Launch & Community Post Drafts (Reddit / TwoPlusTwo / X)

Created 2026-11-20. Updated 2026-11-27 for **v1.5.3 live features** (`BB / Chips` unit toggle, 1-tap ICM Chop copy, quick "Your hand" picker, automatic English on English iOS devices) and the **new US Pro price ($11.99 one-time, no subscription)**. **Not posted yet.** All numbers are verified directly by `@poker-icm/core`.

- **App Store link (global / US — ready to paste)**: `https://apps.apple.com/app/id6793358140`
- **Live Pro price (confirmed in App Store Connect)**: **$11.99 one-time purchase, no subscription** (Japan: ¥1,980)
- **Recommended posting order**:
  1. **Post §2 (Strategy Discussion) FIRST today** on `r/poker` and TwoPlusTwo (MTT / Software) — value-first math avoids self-promo pushback and drives early US installs & reviews.
  2. **Post §1 (Solo-Dev Showcase) 1–2 weeks later** once you have a few genuine comment threads / user feedback.
- Visual assets (1600×900, git-ignored): `artifacts/release-1.5.3/promo/en/`
  - `card-en-main.png` (Overview: Exact ICM, 3-way Nash, KO/PKO, ICM Chop)
  - `card-en-bounty.png` (PKO bounty swing example)
  - Rebuild: `node artifacts/release-1.5.3/promo/en/make-en-cards.mjs`

### ASC Campaign Link Setup (`ct=reddit` / `ct=x_en`)
Every draft below uses the clean global URL `https://apps.apple.com/app/id6793358140` so it works immediately as-is. Before posting, swap it with an App Store Connect Campaign Link so you can track installs & conversions by channel:
1. Open **App Store Connect → App Analytics → Sources → Generate Campaign Link**.
2. Create `ct=reddit` (for Reddit / TwoPlusTwo) and `ct=x_en` (for English X). Keep campaign tags grouped into 4–5 buckets total so they clear Apple's minimum reporting threshold.
   - Example: `https://apps.apple.com/app/id6793358140?pt=<provider>&ct=reddit&mt=8`
3. Find-and-replace `https://apps.apple.com/app/id6793358140` in the post you are publishing with your generated Campaign Link (on X, every URL still counts as 23 weighted chars regardless of query string).

### Rules for English Poker Communities (Reddit `r/poker` & TwoPlusTwo)
- **No hype / no full-solver overclaiming**: Poker players immediately spot and downvote ad copy. Be upfront about exact scope (all-in / push-fold spots only — no 2BB opens, limps, or postflop).
- **Lead with math & concrete benchmarks**: Mention Malmuth-Harville ICM, exact 3-terminal call equity (not just BF linearization), 3-way simultaneous all-in overcall Nash, and the HRC verification numbers.
- **Emphasize what poker players actually complain about**: Monthly subscriptions, web-only tools that stall at live venues, and tedious BB conversions at the table. ("100% offline iOS app, free up to 4 players, $11.99 one-time Pro with no subscription" hits hard.)
- **Check subreddit self-promo rules** before posting on `r/poker` (avoid posting multiple links back-to-back; engage genuinely in comments!).

---

## 1. Reddit `r/poker` — Main Solo-Dev Showcase Post *(Post 1–2 weeks after §2)*

**Title candidates** (pick one):
- `I built an offline iOS ICM / Nash Push-Fold / PKO calculator (3-way overcall Nash + 1-tap ICM chop, $11.99 one-time, no subscription)`
- `Built an offline iPhone/iPad ICM & 3-way Push/Fold Nash app with KO/PKO bounties, BB/Chips toggle & chop copy (free up to 4 players)`

**Body**:
```markdown
Hey r/poker — I'm a tournament player and solo dev. I kept wanting a fast way to check bubble calls, PKO spots, and live final-table chops on my phone without paying for another monthly solver subscription or waiting on a web server, so I built **Poker ICM** for iPhone/iPad.

Everything runs **100% offline on-device** (no account, no server) and launches automatically in English on English iOS devices.

### What it calculates
- **Exact ICM required equity & Risk Premium**: instead of only using the symmetric-flip Bubble Factor approximation, it computes exact Malmuth-Harville ICM across all three terminal stack states (fold / call-win / call-lose).
- **Full-table Push/Fold Nash (up to 3-way all-in)**: shows every first-in pusher and every caller behind in one table, including **second-caller overcalls** (precomputed 3-way equity table across all ~820k 169-hand triples).
- **13×13 Hand Charts + Quick "Your hand" picker**: set villain range by Top X%, custom drag-paint, or load the spot's Nash range in one tap; pick your exact hand right above the grid (or tap any cell) for instant call/fold verdict and equity (or villain call rate + prize EV diff when shoving).
- **Everyone-vs-Everyone Bubble Factor heatmap**: instantly see who puts the most ICM pressure on whom (turns green when BF < 1.0 in bounty spots).
- **Live-tournament friendly BB / Chips toggle & 1-tap ICM Chop copy**: switch between BB and raw chip counts (with 1 BB presets like 1k / 5k / 10k / 20k), compare ICM Chop vs. Chip Chop with rounding units, and copy the formatted deal split in one tap to paste into group chats.
- **KO & PKO Bounty support** across required equity, hand charts, BF map, and Nash.

### Accuracy & what it does NOT do (being upfront)
- Verified Malmuth-Harville ICM against brute-force permutation across 402 spots (2–9 players, diff < 1e-9).
- Verified 3-handed 10BB Nash (50/30/20) against HoldemResources Calculator free ICM Nash: push 33.0% vs 32.1%, first call 18.1% vs 17.8%, overcall 13.1% vs 12.8%, BB vs BTN 24.3% vs 24.3% (differences are near-0EV boundary combos).
- **Scope limits**: all-in / push-fold only (no min-raises, limps, 3-bets, or postflop), max 9 players, no 4-way simultaneous all-in, and remaining table bounties use a chip-proportional approximation. All assumptions are documented inside the app.

### Free vs. Pro
- **Free**: built-in example spots (all calculations unlocked) and full editing up to 4-player tables (stacks, payouts, BB/Chips toggle, chops, Nash, hand charts).
- **Pro ($11.99 one-time purchase, no subscription)**: editing 5–9 player tables, saving spots/payouts, and KO/PKO bounties.

App Store (iPhone & iPad): https://apps.apple.com/app/id6793358140

Would genuinely love feedback from MTT regs or live players — especially on spots that feel unintuitive or anything missing for live FT study/chops.
```

---

## 2. Reddit `r/poker` / TwoPlusTwo — Value-First Strategy Discussion *(Recommended FIRST Post — Ready to Copy & Paste Today)*

*Posting checklist:*
- *Swap `https://apps.apple.com/app/id6793358140` with your `ct=reddit` Campaign Link if generated (see top of file).*
- *For `r/poker`, use flair `Strategy` / `Hand Analysis` (or whatever matches current subreddit flairs) and reply thoughtfully to comments.*
- *For TwoPlusTwo, post in **Multi-Table Tournaments (MTT)** or **Poker Software** — the one-time $11.99 offline angle resonates strongly there.*

**Title**:
`Two wild ICM spots most people misplay: folding QQ vs a 40% shove in a satellite, and folding AKs as a 3-way overcall at 10BB`

**Body**:
```markdown
Was running some exact ICM & 3-way Nash spots while testing an offline iOS calculator I built, and two numbers jumped out that are surprisingly easy to underestimate at the table:

### Spot 1: Folding QQ vs a 40% shove (5 left, 3 equal seats)
- Payouts: `33 / 33 / 33` (satellite), 0.5 / 1 / 1 BB ante
- Stacks: SB (CL) 28BB, BB (Hero) 22BB, BTN 18BB, CO 15BB, UTG 5BB
- SB shoves top 40%. You have **QQ** (72.5% equity vs top 40%).
- **Chip EV required equity**: `46.5%`
- **Exact ICM required equity**: `74.6%` (Risk Premium `+28.1%`, Bubble Factor `3.42`)
- **Verdict**: QQ is a fold. Only **AA (85.7%)** and **KK (78.2%)** call.

### Spot 2: Folding AKs in the BB after BTN shoves & SB calls (3-handed, 10BB each)
- Payouts: `50 / 30 / 20`, 0.5 / 1 / 1 BB ante
- Stacks: BTN 10BB, SB 10BB, BB 10BB
- At 3-way ICM Nash:
  - BTN shoves **37.6%**
  - If SB folds, BB calls **14.9%**
  - If SB calls (**8.7%**), BB's **overcall range collapses to 1.8% (JJ+ only)** — **AKs is a pure fold**.
- Letting BTN and SB flip guarantees you at least 2nd place (30% of the pool) for free whenever one busts.

### Bonus: How hard PKO bounties flip the math
- 3-handed (`50 / 30 / 20`), BB 18BB covering SB 14BB (BTN 20BB), SB shoves top 30%.
- **No bounty**: required equity = `49.8%` (BF `1.19`) → `KTs` (47.7%) is a fold.
- **PKO (bounties 10 / 25 / 15 in same unit as 100 pool)**: required equity drops to `42.5%` (RP `-2.3%`, BF `0.88` — below 1.0!) → `KTs` and `A7o` become easy calls.

---

*(Full disclosure: I ran these in an offline iOS app I built called [Poker ICM](https://apps.apple.com/app/id6793358140) — auto-English on English devices, includes a BB/Chips input toggle and 1-tap ICM Chop copy for live deals, free up to 4-handed tables, and $11.99 one-time Pro with no subscription for 5–9 players & KO/PKO. Scoped strictly to all-in / push-fold spots. Curious how many of you actually fold QQ in Spot 1 live — or if you've ever watched someone snap-call AKs into a 3-way bust in Spot 2!)*
```

---

## 3. English X (Twitter) Posts

*(Swap `https://apps.apple.com/app/id6793358140` with your `ct=x_en` Campaign Link before posting. All posts below are verified under X's 280 weighted-char limit.)*

### Main Launch Tweet (attach `card-en-main.png` + `card-en-bounty.png`)
```
Built an offline iOS poker ICM app—no monthly subscription just to check bubble calls, PKOs & live chops.

- Exact 3-terminal ICM & BF map
- Full-table 3-way Nash
- KO/PKO bounties
- BB/Chips toggle & 1-tap chop copy

Free up to 4p. $11.99 one-time Pro, no sub 👇
```

Reply:
```
App Store (iPhone & iPad, auto-English): https://apps.apple.com/app/id6793358140

Runs 100% offline with zero account needed. Scoped strictly to all-in / push-fold spots (no opens or postflop). Feedback welcome! #poker #MTT #ICM
```

### EN Quiz #1 — Satellite QQ Fold
```
ICM Quiz: Can you fold QQ here?

5 left · Top 3 win equal seats (33/33/33)
0.5/1/1 BB ante

SB (CL) 28BB shoves top 40%.
You're in the BB with 22BB (2nd in chips). UTG has 5BB.

Your hand: QQ (72.5% equity vs top 40%).

Call or fold? Answer below 👇 #poker #ICM
```

Reply:
```
Answer: FOLD.

- Chip EV needed: 46.5%
- Exact ICM needed: 74.6% (RP +28.1% / BF 3.42)

Even with 72.5% equity, QQ loses $EV. Only AA & KK call.

Offline iOS app Poker ICM (free to 4p; 5-9p & PKO $11.99 one-time, no sub): https://apps.apple.com/app/id6793358140
```

### EN Quiz #2 — PKO Bounty Flip (attach `card-en-bounty.png`)
```
How much wider do you call in a PKO when covering?

3-handed (50/30/20, 1BB ante)
BB 18BB vs SB 14BB shove (top 30%), BTN 20BB.
Hand: KTs (47.7% eq).

No bounty: 49.8% needed (BF 1.19) → FOLD
PKO (10/25/15): 42.5% (BF 0.88) → CALL

7.3pt swing (below cEV)! #poker #PKO
```

### EN Quiz #3 — 3-Way Overcall AKs Fold
```
ICM Overcall Quiz (3-handed, 50/30/20, 1BB ante):

All 10BB. BTN shoves (37.6%), SB calls (8.7%).
BB holds AKs — call or fold?

At 3-way Nash, BB's overcall drops from 14.9% (SB folds) to 1.8% (JJ+ only). AKs is a pure fold!

Poker ICM (iOS): https://apps.apple.com/app/id6793358140
```
