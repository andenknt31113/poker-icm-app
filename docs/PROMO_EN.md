# English Launch & Community Post Drafts (Reddit / TwoPlusTwo / X)

Created 2026-11-20. **Not posted yet.** All numbers are verified directly by `@poker-icm/core`.
App Store link (global / US): `https://apps.apple.com/app/id6793358140`

Visual assets (1600×900, git-ignored): `artifacts/release-1.5.3/promo/en/`
- `card-en-main.png` (Overview: Exact ICM, 3-way Nash, KO/PKO, ICM Chop)
- `card-en-bounty.png` (PKO bounty swing example)
- Rebuild: `node artifacts/release-1.5.3/promo/en/make-en-cards.mjs`

### Rules for English Poker Communities (Reddit `r/poker` & TwoPlusTwo)
- **No hype / no "GTO solver" overclaiming**: Poker players immediately spot and downvote ad copy. Be upfront about exact scope (all-in / push-fold spots only — no 2BB opens, limps, or postflop).
- **Lead with math & concrete benchmarks**: Mention Malmuth-Harville ICM, exact 3-terminal call equity (not just BF linearization), 3-way simultaneous all-in overcall Nash, and the HRC verification numbers.
- **Emphasize what poker players actually complain about**: Monthly subscriptions, clunky English/desktop-only tools, needing internet at live venues. ("100% offline, free up to 4 players, one-time unlock with no subscription" hits hard.)
- **Check subreddit self-promo rules** before posting on `r/poker` (avoid posting multiple links back-to-back; engage genuinely in comments!).

---

## 1. Reddit `r/poker` — Main Solo-Dev Showcase Post

**Title candidates** (pick one):
- `I built an offline iOS ICM / Nash Push-Fold / PKO calculator (3-way overcall Nash + ICM chop, no subscription)`
- `Built an offline iPhone/iPad ICM & 3-way Push/Fold Nash app with KO/PKO bounties and chop calculator (free up to 4 players)`

**Body**:
```markdown
Hey r/poker — I'm a tournament player and solo dev. I kept wanting a fast way to check bubble calls, PKO spots, and final-table chops on my phone without paying for another monthly solver subscription or waiting on a web server, so I built **Poker ICM** for iPhone/iPad.

Everything runs **100% offline on-device** (no account, no server).

### What it calculates
- **Exact ICM required equity & Risk Premium**: instead of only using the symmetric-flip Bubble Factor approximation, it computes exact Malmuth-Harville ICM across all three terminal stack states (fold / call-win / call-lose).
- **Full-table Push/Fold Nash (up to 3-way all-in)**: shows every first-in pusher and every caller behind in one table, including **second-caller overcalls** (precomputed 3-way equity table across all ~820k 169-hand triples).
- **13×13 Hand Charts (both calling & shoving)**: set villain range by Top X%, custom drag-paint, or load the spot's Nash range in one tap; tap any hand cell for equity vs. required equity (or villain call rate + prize EV diff when shoving).
- **Everyone-vs-Everyone Bubble Factor heatmap**: instantly see who puts the most ICM pressure on whom (turns green when BF < 1.0 in bounty spots).
- **ICM Chop vs. Chip Chop** with rounding units (100 / 500 / 1,000) for live final-table deals.
- **KO & PKO Bounty support** across required equity, hand charts, BF map, and Nash.

### Accuracy & what it does NOT do (being upfront)
- Verified Malmuth-Harville ICM against brute-force permutation across 402 spots (2–9 players, diff < 1e-9).
- Verified 3-handed 10BB Nash (50/30/20) against HoldemResources Calculator free ICM Nash: push 33.0% vs 32.1%, first call 18.1% vs 17.8%, overcall 13.1% vs 12.8%, BB vs BTN 24.3% vs 24.3% (differences are near-0EV boundary combos).
- **Scope limits**: all-in / push-fold only (no min-raises, limps, 3-bets, or postflop), max 9 players, no 4-way simultaneous all-in, and remaining table bounties use a chip-proportional approximation. All assumptions are documented inside the app.

### Free vs. Pro
- **Free**: all 8 built-in examples, full editing up to 4-player tables (stacks, payouts, chops, Nash, hand charts).
- **Pro (one-time purchase, no subscription)**: editing 5–9 player tables, saving spots/payouts, and KO/PKO bounties.

App Store: https://apps.apple.com/app/id6793358140

Would genuinely love feedback from MTT regs or live players — especially on spots that feel unintuitive or anything missing for live FT study/chops.
```

---

## 2. Reddit `r/poker` / TwoPlusTwo — Value-First Math Discussion Post

*(Great as a separate post 1–2 weeks later, or if you prefer leading with pure poker strategy instead of an app showcase.)*

**Title**:
`Two wild ICM spots most people misplay: folding QQ vs a 40% shove in a satellite, and folding AKs as a 3-way overcall at 10BB`

**Body**:
```markdown
Was running some exact ICM & 3-way Nash spots while testing a calculator I built, and two numbers jumped out that are easy to underestimate at the table:

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

*(Full disclosure: I ran these in an offline iOS app I built called [Poker ICM](https://apps.apple.com/app/id6793358140) — free up to 4-handed tables if you want to plug in your own spots. Curious how many of you actually fold QQ in Spot 1 live!)*
```

---

## 3. English X (Twitter) Posts

### Main Launch Tweet (attach `card-en-main.png` + `card-en-bounty.png`)
```
Built an offline iOS poker ICM calculator because I got tired of paying monthly subscriptions just to check bubble calls, PKO spots, and FT chops.

- Exact 3-terminal ICM required equity & Bubble Factor map
- Full-table Nash push/fold (with 3-way overcalls)
- KO / PKO bounty math
- ICM chop vs. chip chop

Free up to 4 players. One-time Pro, no sub 👇
```

Reply:
```
App Store (iPhone & iPad): https://apps.apple.com/app/id6793358140

Runs 100% offline with zero account needed. Scoped strictly to all-in / push-fold decisions (no opens or postflop). Feedback welcome! #poker #MTT #ICM
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

Even with 72.5% equity, QQ loses $EV. Only AA and KK can call.

Calculated offline in Poker ICM (free up to 4-handed): https://apps.apple.com/app/id6793358140
```

### EN Quiz #2 — PKO Bounty Flip (attach `card-en-bounty.png`)
```
How much wider do you call in a PKO when you cover the shover?

3-handed (50/30/20, 1BB ante)
BB (You) 18BB vs SB 14BB shove (top 30%), BTN 20BB.

You hold KTs (47.7% equity).

No bounty: need 49.8% (BF 1.19) → FOLD
PKO (bounties 10 / 25 / 15): need 42.5% (BF 0.88!) → EASY CALL

That's a 7.3pt swing — below cEV (44.8%). #poker #PKO
```

### EN Quiz #3 — 3-Way Overcall AKs Fold
```
ICM Overcall Quiz (3-handed, 50/30/20, 1BB ante):

Everyone has 10BB.
- BTN shoves (Nash 37.6%)
- SB calls (Nash 8.7%)
- You're in the BB with AKs.

Call or fold?

At 3-way Nash, BB's overcall range shrinks from 14.9% (if SB folds) down to just 1.8% (JJ+ only). AKs is a fold!

Checked offline in Poker ICM: https://apps.apple.com/app/id6793358140
```
