# Economic and On-Chain Mechanisms Against Producer Dishonesty (Fermento, Stellar/Soroban)

Scope note: research done 2026-10-25 with a tight tool budget (~20 calls). Facts about Fermento's own contracts are cited to repo files (read directly). Market norms that I know from background knowledge but could not verify in-session are placed in Inferences (marked "background, unverified") or Gaps, never in Cited Findings.

## 1. Escrow and milestone release (how much to withhold, which Stellar tools)

### Takeaway
Fermento currently has zero buyer protection after `buy()`: 100% of USDC goes straight to the producer. The cheapest high-impact fix is to route sale proceeds into an escrow (in-contract vault in `batch_shares`, or Trustless Work multi-release escrow) and release in tranches tied to fill, independent inspections and maturity/redemption. Precedents (en primeur, Liv-ex guarantees, Trustless Work crowdfunding) show that buyers in long-dated pre-sales either get escrow or a third-party guarantee; without one, they carry 2+ years of unsecured counterparty risk.

### Cited Findings
**Fermento baseline (repo)**
- `buy()` transfers `price * shares` of the payment token "straight to the producer" (`token::Client::transfer(&buyer, &offering.producer, &paid)`) and mints shares to the buyer; nothing is held back — [contracts/batch_shares/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/batch_shares/src/contract.rs)
- `redeem()` requires `now >= matures_at`, burns shares, charges the accrued storage fee to the **treasury** (not the producer), and records a claim on the registry; `set_maturity` (issuer role) can move maturity at will — [contracts/batch_shares/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/batch_shares/src/contract.rs)
- The offering stores `producer`, `price`, `total_shares`, `sold`, `redeemed`, `filled_at`, `matures_at`; `open_offering` and `close_offering` are issuer-gated — [contracts/batch_shares/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/batch_shares/src/contract.rs)

**Trustless Work (escrow-as-a-service on Soroban)**
- Trustless Work describes itself as "Escrow-as-a-Service (EaaS)" for stablecoin escrow, with contracts on Stellar/Soroban, driven by REST API, React SDK or "Escrow Blocks" SDK; funds are held in smart contracts (non-custodial); supports milestones, approvals, partial releases, disputes; lists crowdfunding and pre-orders among use cases — [Trustless Work docs](https://docs.trustlesswork.com/trustless-work)
- Roles: **Service Provider** (updates milestone status, can raise disputes, cannot approve/release); **Approver** (validates milestone completion, can approve and dispute); **Release Signer** ("executes fund release after approval conditions are met"); **Dispute Resolver** ("can re-route funds when a dispute is raised"); **Platform Address** (receives optional platform fee); **Receiver** (receives released funds) — [Trustless Work Escrow Design](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview)
- Single-release: one payout after all required milestones approved. Multi-release: "each milestone can have its own payout", payouts can go to different receivers; lifecycle Fund → Mark milestone → Approve → Release → Close (completed/cancelled/refunded/disputed/resolved). The docs warn release should depend on approval, not on the provider's text status — [Trustless Work Escrow Design](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview)
- Docs index: V2 multi-release "One escrow, many payouts — each milestone carries its own amount and settles independently"; dispute endpoints (Start Dispute, Dispute Escrow, Resolve Dispute, Resolve Milestone Dispute); "Go to Mainnet" guides for API/React/Blocks SDK; fee errors state "Platform fee cannot exceed 99%" and "platformFee plus the Trustless Work fee would exceed 100%" (protocol fee % not stated); no audit page found in index; KindFi listed as a crowdfunding dApp built on it — [Trustless Work llms.txt](https://docs.trustlesswork.com/trustless-work/llms.txt)
- Crowdfunding use case: contributions held in escrow and released "only when funding milestones are achieved" (no refund mechanics described on that page) — [Trustless Work use cases](https://docs.trustlesswork.com/trustless-work/use-cases-by-indutry/introduction)

**OpenZeppelin Stellar contracts (same library Fermento already uses at ^0.8.0)**
- Modules listed: Fungible (Burnable, Capped, Allowlist, Blocklist), NFT, Stablecoin, **RWA (ERC-3643) token** (identity registry, compliance, freezing incl. partial, recovery, pausable, RBAC), **Token Vault** (SEP-56 tokenized vault, shares of an underlying pool), Confidential Token (v0.8.0), Smart Accounts (multisig, spending-limit policies), utilities incl. Pausable, Upgradeable, **Merkle Distributor**, WAD math, **Time lock**, **Governor**, fee-abstraction. Vesting is not mentioned — [Stellar Docs: OpenZeppelin Stellar Contracts](https://developers.stellar.org/docs/tools/developer-tools/openzepplin-contracts)
- Changelog (via search snippet; page returned 404 on direct fetch): v0.5.0 added an ERC-4626-compatible Token Vault; v0.6.0 (2026-01-26) added a timelock as a governor submodule, WAD/pow math and a fee forwarder — [OpenZeppelin Stellar changelog](https://docs.openzeppelin.com/stellar-contracts/changelog)
- On EVM, OZ `VestingWallet` can be configured with zero duration to act as a simple token timelock — a pattern to port, since no Stellar vesting module was found — [OpenZeppelin Contracts finance API](https://docs.openzeppelin.com/contracts/api/finance)

**Comparable pre-sale/retention practice**
- En primeur: buyers pay upfront and receive wine ~2 years later ("you are paying upfront for something you are not going to receive for 2 years"); many buyers wrongly assume the château underwrites the contract; Liv-ex exchange rules require sellers to post a **bank guarantee or insurance bond** running to end of June two years after release, with delivery deadline end of May two years after the offer — [The Drinks Business](https://www.thedrinksbusiness.com/2006/05/fit-for-purpose-bordeaux-en-primeur/6/); [Liv-ex](https://liv-ex.com/?p=48375); [En Primeur Club guide](https://www.enprimeurclub.com/guide/what-buying-bordeaux-en-primeur-actually-involves)
- Mayfair Cellars collapse: hundreds of en primeur contracts not honoured because négociants were never paid for the 2003 vintage; Berry Bros & Rudd responded by insuring against négociant failure and only working with négociants able to open bank guarantees (mid-2000s sources) — [Decanter](https://www.decanter.com/?p=93923); [The Drinks Business](https://www.thedrinksbusiness.com/2006/05/fit-for-purpose-bordeaux-en-primeur/5/)

### Inferences
**Concrete designs, cheapest first**
- **D1. In-contract tranche escrow in `batch_shares` (recommended for pilot).** Change `buy()` to transfer `paid` to the contract itself; track `escrowed[batch]` and `released[batch]`. Add `release_tranche(batch_id, milestone, caller)` gated by an `attestor` role (Fermento + one independent party) and a schedule stored in `Offering`, e.g. `[(Fill, 50%), (Inspection1, 15%), (Inspection2, 15%), (Maturity/first redemption, 20%)]`. Add `refund(batch_id, holder)` that becomes callable if a milestone deadline passes unattested or a dispute is upheld: holder burns shares and receives pro-rata of **unreleased** escrow. ~150 lines of Soroban, no new dependency, reuses existing `issuer`/admin roles and `keep_key` TTL policy.
- **D2. Trustless Work multi-release escrow per batch.** Buyer funds go to a TW escrow (Receiver = producer; Service Provider = producer; Approver = Fermento/inspector; Release Signer = Fermento multisig; Dispute Resolver = neutral party, e.g. a Portuguese wine-sector arbiter or lawyer; Platform Address = Fermento treasury). Pros: battle-tested UI blocks, dispute flow, mainnet path. Cons: TW escrows are per-deal with fixed funders; Fermento has many small buyers buying fungible shares at different times, so either (a) `batch_shares` itself is the single funder that tops up the TW escrow on each buy (contract-to-contract call), or (b) one escrow per offering-close. Refunds to many share-holders still need Fermento-side pro-rata logic. Unknown protocol fee and audit status (Gaps).
- **D3. SEP-56 Token Vault as the escrow.** Use OZ Token Vault so the escrowed USDC is a vault whose "shares" are the batch shares; release = producer withdraws per schedule. Elegant but the vault semantics (deposit/withdraw at NAV) do not naturally express milestone gating; more work than D1.
- **D4. Timelock/Governor for admin actions.** Put `set_maturity`, `release_tranche`, `set_rating`, `set_producer` behind the OZ timelock (e.g. 48 h delay) so holders see any admin/producer-favouring change before it executes — closes the "issuer moves maturity / releases early" collusion path.
- **Withholding levels (design proposal, not market data):** For a small producer needing working capital, upfront 40–60% at fill (covers bottles/barrels/labour already sunk), 20–30% across 2–3 inspections, 10–20% at maturity/redemption. Rationale: the producer's sunk cost is front-loaded, so withholding more than ~50% starves working capital; withholding less than ~20% at maturity leaves no incentive to deliver quality units. Background (unverified in-session): Kickstarter/Indiegogo release ~95% to creators at campaign end with no milestone escrow; revenue-based financing and trade-finance (letters of credit) pay on documentary evidence of shipment; contractor retainage is commonly 5–10% until completion.
- **Combine with the storage fee:** today accrued storage fees go to the treasury. Paying them (or part) to the producer *only while the condition oracle shows in-range readings* turns care into an ongoing revenue stream (pay-for-performance) without extra buyer cost.
- **Threats covered:** "take money and disappear" (bounded loss = released tranches only), "stop caring" (later tranches + storage-fee stream at stake), "deliver inferior units" (final tranche held until redemption claims are fulfilled/undisputed).

### Gaps
- Trustless Work protocol fee percentage, audit status/auditor, and production volume were not stated in the pages read.
- Whether OZ Stellar has a vesting module in 2026 releases could not be confirmed (changelog 404); none listed on Stellar Docs.
- No sourced benchmarks found for typical % withheld in reward crowdfunding, revenue-based financing or agricultural forward contracts; figures above are design proposals.

## 2. Producer collateral, staking/slashing and dispute adjudication

### Takeaway
Skin-in-the-game should be (a) a retained slice of the batch's own shares, locked until redemption completes, plus optionally (b) a small USDC bond; slashing must be triggered by a defined, evidence-based process with a named adjudicator. RWA credit protocols show first-loss cover is useful but small relative to exposure, and the real losses came from off-chain fraud/misuse that only due diligence and legal recourse address. On-chain arbitration (Kleros, UMA) has no native Stellar deployment found; for a pilot, a Trustless-Work-style "Dispute Resolver" role held by a named neutral party plus an optimistic challenge window is the feasible analogue.

### Cited Findings
- Maple Finance: Orthogonal Trading defaulted on ~$36M (Dec 2022), ~$31M in the M11 USDC pool, ~80% hit to remaining investors; Maple expected to recoup at least $2.5M from pool cover plus fees accrued by Orthogonal held on the platform — [The Block](https://www.theblock.co/post/192097/maple-finance-default-orthogonal-trading)
- Maple pool delegate cover: first-loss capital "exists to protect Liquidity Providers in the case of a Loan default"; if cover falls below the required amount the delegate cannot fund new loans and cannot earn management fees — [Maple docs: Pool Delegate Cover](https://docs.maple.finance/technical-resources/pools/pool-delegate-cover)
- Community critique: delegate first-loss cover is small relative to pool size; proposal for dynamic, tiered cover that grows with pool size — [Maple community forum](https://community.maple.finance/t/discussing-the-pool-delegate-role-and-strengthening-pool-delegate-alignment/278)
- Maple founder: pools are in separate contracts so losses are not commingled; acknowledged need for more stringent due diligence for undercollateralized lending — [The Block](https://www.theblock.co/post/192097/maple-finance-default-orthogonal-trading)
- Goldfinch Tugende: ~$1.9M of a Kenyan facility transferred to a Ugandan affiliate without authorization; lender yield estimated to fall from ~8% to <2% if written off; DAO later voted $1M USDC from treasury toward losses — [DL News](https://dlnews.com/articles/defi/african-motorbike-finance-company-defaults-on-loan/)
- Goldfinch Stratos: $20M loan, ~$7M written down to $0 (REZI and POKT positions); Warbler Labs backstopped losses for backers — [The Defiant](https://thedefiant.io/news/defi/rwa-protocol-goldfinch-writes-down-usd7m-of-usd20m-loan-to-usd0)
- Goldfinch Lend East reportedly able to repay only $4.25M of $10.2M — [DL News](https://dlnews.com/articles/defi/goldfinch-borrower-lend-east-defaults-says-warbler-labs/) (secondary summary via search; figures should be checked against Goldfinch governance forum)
- UMA optimistic oracle: an assertion is treated as correct if not disputed within the liveness period; bond and liveness are set per request (default liveness 2 hours); disputes go to the DVM token-holder vote, 48–96 h — [UMA docs](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work); [UMA: custom bond and liveness](https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters)
- Story Protocol's UMA arbitration policy: disputer's bond lost if the dispute is not upheld — [Story docs](https://docs.story.foundation/concepts/dispute-module/uma-arbitration-policy)
- Critique: UMA token-vote model is not suited to subjective/IP disputes — [Four Pillars research](https://research.4pillars.io/en/research/uma-is-not-enough-for-ip-disputes)
- Kleros: jurors randomly drawn from PNK stakers in a subcourt; majority voters earn fees, minority lose part of stake; appeals require extra deposits and larger juries (details from older community posts, conflicting on the exact juror formula) — [Interexy comparison](https://interexy.com/prediction-market-oracle-resolution); [Kleros arbitrable contract libraries](https://github.com/kleros/arbitrable-contract-libraries); low-quality corroboration [Steemit](https://steemit.com/@mr-sakariyau/kleros-a-platform-for-dispute-resolution)
- Trustless Work exposes a Dispute Resolver role that "can re-route funds when a dispute is raised" plus dispute/resolve endpoints — [Trustless Work Escrow Design](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview)
- OZ Stellar fungible tokens support Allowlist/Blocklist and the RWA token supports freezing (incl. partial) — useful to enforce lock-ups on retained shares — [Stellar Docs: OpenZeppelin](https://developers.stellar.org/docs/tools/developer-tools/openzepplin-contracts)

### Inferences
**Concrete designs**
- **C1. Retained-share lock-up (strongest, zero cash cost to producer).** At `open_offering`, mint e.g. 10–20% of `total_shares` to a lock account controlled by `batch_shares` (not the producer wallet). They unlock pro-rata only after redemption claims are fulfilled (registry `claim` status = delivered) and a challenge window passes. If a dispute is upheld, locked shares are burned (which raises other holders' per-unit claim on the physical batch) or transferred to aggrieved holders. Directly addresses "inferior units" and "sell same batch elsewhere" because the producer loses their own slice of the batch they double-sold. Requires the producer to actually hold back physical units equal to their retained shares — so it's real economic exposure, unlike a token-only stake.
- **C2. Small USDC bond / first-loss.** Producer deposits e.g. 5–10% of offering value (or Fermento withholds it from the first tranche: "bond from proceeds", so no extra cash needed). Slashed on: missed milestone deadline, upheld dispute, proven double-sale (same NFC tag/unit IDs found elsewhere), oracle tamper evidence. Maple's lesson: size cover relative to exposure and make the penalty also block future activity (cannot open a new offering while bond is under-water).
- **C3. Future-business slashing.** Make `open_offering` require producer reputation ≥ threshold and bond ≥ required; an upheld dispute raises required bond for the next batch. For a one-producer pilot, reputational/future-sales loss is the largest deterrent in practice.
- **Adjudication tiers for the pilot:** (1) automatic, objective triggers on chain (deadline missed, sensor offline > N days, mark below floor); (2) optimistic challenge: any holder posts a USDC bond + evidence hash within a window; if the producer doesn't answer, auto-uphold; (3) human Dispute Resolver = named neutral (e.g. Portuguese enologist/CVR inspector or arbitration centre) holding a Soroban role, whose ruling moves escrow/bond; (4) court/arbitration as backstop (Section 6). Kleros/UMA are EVM-native; bridging is not worth it for a pilot.
- **Lesson from Goldfinch/Maple:** the losses were fraud and misuse of funds off-chain (unauthorized transfers to affiliates, bad investments), not smart-contract bugs; on-chain bonds were too thin to cover them. For Fermento the analogue is the physical goods: on-chain mechanisms must be anchored to physical audits (Section 5).

### Gaps
- No Kleros or UMA deployment on Stellar/Soroban found; no Stellar-native decentralized arbitration protocol identified in this session.
- Current Kleros fees/court parameters not retrieved from official docs (only older secondary sources).
- No sourced data on what bond % small agricultural producers accept.

## 3. Insurance and guarantee funds

### Takeaway
Parametric cover keyed to the existing signed sensor feed (temperature/humidity excursions) is technically natural for Fermento but there is no Stellar insurance provider found; for a pilot, a platform-funded guarantee pool (a % of every sale + storage fees) with clear payout rules is the feasible version, while traditional stock insurance (on the physical cellar inventory, with holders named as loss payees) and a bank guarantee (the Liv-ex model) are the conventional backstops.

### Cited Findings
- Liv-ex requires en primeur sellers to post a bank guarantee or insurance bond; Berry Bros & Rudd insured against négociant failure after the Mayfair Cellars collapse — [Liv-ex](https://liv-ex.com/?p=48375); [Decanter](https://www.decanter.com/?p=93923)
- Blockchain parametric insurance encodes the policy and index in a smart contract that pays automatically when an IoT-measured value crosses limits (cites a transport case requiring 0 °C) — [Crowell & Moring](https://www.crowell.com/a/web/p9UpZkvqJfgPbV3otnXXoy/4TtkFW/20181116-blockchain-smart-contracts-and-parametric-insurance-made-for-each-other.pdf); [arXiv 2305.08384](https://arxiv.org/pdf/2305.08384)
- Collaborative/parametric insurance on Ethereum (academic design of risk-sharing pools) — [arXiv 2412.05321](https://arxiv.org/html/2412.05321v3)
- Etherisc describes end-to-end automated parametric insurance; its published examples focus on agriculture, not cold chain — [ONTOCHAIN project page](https://ontochain.ngi.eu/node/416) (via search summary)
- Goldfinch DAO used $1M treasury USDC to partly cover Tugende losses; Warbler Labs backstopped Stratos backers — de facto platform guarantee funds — [DL News](https://dlnews.com/articles/defi/african-motorbike-finance-company-defaults-on-loan/); [The Defiant](https://thedefiant.io/news/defi/rwa-protocol-goldfinch-writes-down-usd7m-of-usd20m-loan-to-usd0)
- Fermento's oracle already accepts ed25519-signed sensor readings per batch (`post_reading`, `reading_payload`) and computes a condition multiplier with a floor of 0.70 when no reading is in range — [contracts/condition_oracle/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/condition_oracle/src/contract.rs)

### Inferences
- **I1. Guarantee pool (pilot).** Skim e.g. 1–3% of each `buy()` plus part of storage fees into a `guarantee` address (OZ Token Vault so contributions are accounted). Pays holders pro-rata when a dispute is upheld and escrow + bond are insufficient. Simple, transparent, and stops Fermento from having to backstop ad hoc like Warbler/Goldfinch did.
- **I2. Parametric excursion cover (self-insured).** Rule in the oracle: if the share of in-range readings over a window falls below X% or the sensor is silent > N days, automatically (a) freeze further tranche releases, (b) open an inspection, (c) pay a fixed compensation per share from the bond/pool. Works because the trigger data is already signed on chain; risk is sensor tampering/relocation (mitigate with tamper-evident mounting, sensor key provisioned by Fermento, not producer, and random audits).
- **I3. Traditional stock insurance.** Require the producer's existing cellar/stock policy to list Fermento (as agent for holders) as loss payee for the tokenized batch; cheapest real-world cover for fire/theft/spoilage, but does not cover fraud by the insured.
- **I4. Bank guarantee / surety bond** (Liv-ex model) is the institutional answer to "take money and disappear" but is costly for a micro-producer; plausible later via a Portuguese mutual guarantee society (background, unverified: SPGM/Garval/Lisgarante system).

### Gaps
- No Stellar/Soroban-based insurance or cover protocol was found in this session (did not query Stellar ecosystem directories due to budget).
- No current pricing for parametric or stock insurance for small wine/ferment inventories in Portugal.
- Whether Etherisc has any live temperature-excursion product was not confirmed.

## 4. Reputation, attestations, and evidence-backed check-ins (critique of current design)

### Takeaway
The current check-in mechanism lets the producer unilaterally raise the mark by up to +20% with self-scored, unverified posts; that is a direct incentive to fake care. Check-ins should not move price unless evidence-backed and/or co-signed, and the producer rating should come from verified delivery outcomes, not curator discretion alone. Stellar has early-stage attestation projects (Stellar Attestation Service proposals, Attest Protocol, ACTA) but no dominant EAS-equivalent; a minimal in-house attestation registry on Soroban is feasible.

### Cited Findings
**Current design (repo)**
- `post_checkin(batch_id, poster, kind, note, score)` requires only the producer's auth and `score <= 100`; one check-in per 24 h earns `CHECKIN_BONUS_BPS (250) * score / 100`, capped at `MAX_CARE_BONUS_BPS = 2_000` (1.20x); decay `CARE_DECAY_BPS_PER_DAY = 25` after `CARE_GRACE_DAYS = 14` of silence; notes ≤ 280 bytes; no evidence, photo hash, location, or co-signer field — [contracts/condition_oracle/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/condition_oracle/src/contract.rs)
- The mark = fill price × age curve × condition multiplier × care multiplier × producer multiplier − storage fee; producer rating band 0.5x–2.0x, set by the curator role (`set_rating(..., certified)`) — [contracts/condition_oracle/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/condition_oracle/src/contract.rs)
- NFC tags bind one-to-one to a batch (`link_tag`, `batch_of_tag`; tests "a_tag_binds_to_one_batch_only", "stranger_cannot_link_a_tag") — [contracts/non_fungible/src/contract.rs](/Users/andlopvic/Desktop/Fermento/contracts/non_fungible/src/contract.rs)

**Stellar attestation / credential projects**
- Stellar Attestation Service (SCF proposal): Soroban attestation framework, metadata on IPFS, attestations as tokenized assets, revocation and expiry — [SCF submission](https://communityfund.stellar.org/submissions/recF8AbyncoxdFYvk); [SCF submission 2](https://communityfund.stellar.org/submissions/recIHN98Ja7MMb4DX)
- Attest Protocol (attest.so): schemas, authorities, resolvers, delegated attestations with BLS keys; lists Stellar/Soroban as active — [npm attest.so](https://npmjs.com/package/attest.so); [DappRadar](https://dappradar.com/dapp/stellar-attestation-service)
- ACTA: W3C-aligned verifiable credentials API/SDK on Stellar, anchors credential hashes via Soroban; plans did:stellar and ZK selective disclosure — [SCF: ACTA](https://communityfund.stellar.org/project/acta-720)
- Human Passport supports Stellar Soroban contracts for government-ID and phone verifications — [Human Passport supported chains](https://docs.passport.human.tech/building-with-passport/individual-verifications/supported-chains)
- Selective-disclosure KYC with BLS signatures on Soroban (explicitly experimental) — [James Bachini](https://jamesbachini.com/?p=8059)
- No production KYB attestation product on Stellar was found (search summary).

### Inferences
**Critique of current check-ins**
- Self-reported `score` is pure cheap talk: a producer maximizing mark posts score=100 daily → +2.5%/day until +20% in 8 days, then a token post every ≤14 days keeps it. Cost ≈ one transaction fee. Buyers paying the mark (secondary market or later primary tranches) overpay up to 20%. The cap and decay bound the damage but do not make it unprofitable.
- Producer rating is curator-set and producer-specific; with one producer, the rating can't be cross-validated and it multiplies the whole mark (0.5–2.0x) — the single largest manipulable lever.

**Fixes (in increasing cost)**
- **R1. Decouple care from price.** Keep check-ins as an information feed (shown in UI) but remove their effect on the mark, or make them only *prevent decay* (penalize silence) rather than add premium. Cheapest and eliminates the pump incentive entirely.
- **R2. Evidence-backed check-ins.** Add `evidence: BytesN<32>` (SHA-256 of photo/video stored on IPFS/R2) and require the photo to include the batch NFC tag scan + a **challenge nonce** (see Section 5) so old photos can't be reused; only evidence-bearing check-ins earn bonus.
- **R3. Co-signed check-ins.** Bonus only when a second key co-signs: Fermento-provisioned sensor key (already ed25519 in `post_reading`), a holder who scanned the NFC tag on a cellar visit, an independent enologist, or another producer (peer verification). Soroban supports multi-auth natively (`require_auth` on two addresses).
- **R4. Outcome-based rating.** Replace curator `set_rating` with a formula from verified outcomes: % of redemption claims fulfilled on time, undisputed deliveries, inspection pass rate, sensor uptime. Only holders who actually redeemed (burned shares, claim recorded) can rate; weight by units redeemed; exclude addresses linked to the producer (funding-source heuristics, KYC'd holder flag) to resist wash-buying.
- **R5. Attestation registry.** Small Soroban contract: `attest(schema, subject, data_hash, expiry)` by allowlisted attestors (inspector, CVR/DOP body, Fermento KYB) — or adopt Attest Protocol/SAS if mature. Feeds the `certified` flag already in `Rating`.

### Gaps
- Maturity/audit status and mainnet deployment of Stellar Attestation Service, Attest Protocol and ACTA not verified.
- No Stellar-specific literature found on Sybil/wash-trading resistance for ratings.

## 5. Mechanism design for verification games (audits, bounties, challenges)

### Takeaway
Because fake check-ins and inferior units are hard to detect continuously, the efficient design is probabilistic: random challenge-response check-ins and random physical audits with penalties large enough that expected penalty exceeds expected gain, plus bonded holder challenges with whistleblower bounties paid from the producer's bond. UMA's optimistic pattern (assert → liveness window → bonded dispute) is the template and is simple to implement in Soroban without importing UMA.

### Cited Findings
- UMA optimistic flow: assertion stands unless disputed in the liveness window; asserter and disputer post bonds; losing side's bond is forfeited; escalation to a vote — [UMA docs](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work); [Story UMA policy](https://docs.story.foundation/concepts/dispute-module/uma-arbitration-policy)
- Bond and liveness are per-request tunable — [UMA custom bond/liveness](https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters)
- Trustless Work already distinguishes the party who marks a milestone (Service Provider) from the party who approves (Approver), warning that release must depend on approval not self-reported status — [Trustless Work Escrow Design](https://docs.trustlesswork.com/trustless-work/introduction/technology-overview)
- Goldfinch post-default: Warbler committed to quarterly reviews of all loans — periodic audit as a reaction to undetected misuse — [DL News](https://dlnews.com/articles/defi/african-motorbike-finance-company-defaults-on-loan/) (via search summary)

### Inferences
**Concrete games for Fermento**
- **V1. Random challenge-response check-in.** Oracle (or Fermento backend using ledger-derived randomness, e.g. Soroban PRNG `env.prng()` — note it is not secure against validators, acceptable for a pilot) emits `Challenge{batch, nonce, deadline}` at random times (~1–2/month). Producer must respond within e.g. 48 h with a photo/video hash showing the nonce written on paper next to the NFC-tagged vessel + an NFC scan signature. Missing a challenge: care bonus reset and small bond slash; passing: allowed to keep bonus. Converts unverifiable care into verifiable spot checks.
- **V2. Random physical audit.** With probability p per quarter, an independent inspector (enologist/CVR) visits, counts units, checks tags, tastes/samples. Deterrence condition: p × penalty ≥ gain from cheating. E.g. if double-selling 10% of a €20k batch gains €2k and audit probability is 25%/year, penalty must be ≥ €8k → bond + retained shares must be sized accordingly, or raise p. Audit cost can be funded from storage fees.
- **V3. Holder-triggered inspection.** Any holder (or holders with ≥ X% of shares) can post a USDC bond to trigger an inspection. If the inspector finds a problem: holder bond refunded + bounty from producer bond, tranche releases frozen. If not: holder bond pays the inspector. Prevents spam while giving holders a lever.
- **V4. Whistleblower bounty for double-sale.** Publish unit/tag IDs and batch size on chain; anyone proving the same batch/units sold elsewhere (listing screenshot hash + test purchase) claims e.g. 20–50% of the slashed bond. Paired with NFC one-tag-one-batch binding already in `non_fungible`.
- **V5. Optimistic milestones.** Producer asserts "fill done / inspection passed" with a small bond; a 7-day challenge window; unchallenged → tranche releases automatically; challenged → Dispute Resolver decides. Reduces Fermento's admin load while keeping a veto for holders.
- **V6. Holder cellar visits.** Holders who visit scan the NFC tag; the visit signature (holder key + tag) co-signs a check-in (R3) and counts toward the producer rating. Cheap, marketing-positive, and creates many independent observers.
- **V7. Redemption sampling at delivery.** At `redeem`, a random subset of claims is flagged for quality verification (photo of sealed unit + tag scan by the holder on receipt); a failed verification triggers dispute against the final tranche.

### Gaps
- No academic source retrieved in-session on optimal audit probability/penalty for agricultural pre-sales (background: Becker-style deterrence p×F ≥ gain), so the numerical example is illustrative.
- Soroban PRNG security caveats were not re-verified against current docs in this session.

## 6. Identity/KYB of producers on Stellar and legal recourse (Portugal)

### Takeaway
On-chain mechanisms bound losses; KYB plus an enforceable contract under Portuguese law is what makes "take the money and disappear" ultimately unprofitable. SEP-12 is the Stellar standard for anchors to collect KYC data (including organisation data in common SDKs), but KYB of the producer will in practice be done by Fermento off chain (company registry, IBAN, director ID), with the result recorded on chain as an attestation. Regulatory classification (EU crowdfunding regulation vs Portuguese donation/reward crowdfunding vs pre-sale) determines which investor protections are mandatory.

### Cited Findings
- SEP-12 defines how clients upload KYC data to anchors; used by SEP-6 and SEP-31 but usable standalone; the `type` parameter (e.g. sep31-sender, sep31-receiver) is defined by the protocols/anchors using it; receivers may require banking info — [SEP-12 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md); [stellar.org SEP-12](https://stellar.org/protocol/sep-12)
- Anchor Platform's PUT /customer mirrors SEP-12 and does not persist KYC data; the anchor must validate and store it — [Anchor Platform: PUT customer](https://developers.stellar.org/ap_api/callbacks/put-customer)
- Soneso PHP SDK supports both natural-person and organization KYC fields with file uploads (secondary source) — [DeepWiki: Soneso SEP-12](https://deepwiki.com/Soneso/stellar-php-sdk/8.7-kyc-service-(sep-0012))
- OZ Stellar RWA (ERC-3643) token integrates an identity registry and compliance framework for transfers/minting, freezing and recovery for verified investors — [Stellar Docs: OpenZeppelin](https://developers.stellar.org/docs/tools/developer-tools/openzepplin-contracts)
- EU Regulation 2020/1503 (ECSP) applies from 10 Nov 2021 to crowdfunding service providers matching investors with businesses via loans or transferable securities; recognises project owner, investors, and the CSP — [Norton Rose Fulbright](https://nortonrosefulbright.com/en/knowledge/publications/97e1caa6/eu-crowdfunding-regulation); [Regulation text](https://www.legislation.gov.uk/eur/2020/1503/data.html); [MFSA overview](https://www.mfsa.mt/wp-content/uploads/2021/03/The-European-Crowdfunding-Service-Providers-Regulation.pdf)
- Portugal: Regime Jurídico do Financiamento Colaborativo, Lei n.º 102/2015 (amended by Lei n.º 3/2018), four modalities (donation, reward, equity, loan); prior CMVM registration applies to equity and loan platforms; tax treatment unclear (OCC recommends binding ruling from AT) — [OCC](https://occ.pt/pt-pt/noticias/crowdfunding-0); [OCC](https://www.occ.pt/index.php/en/node/12867)

### Inferences
- **K1. Producer KYB (pilot).** Off-chain: certidão permanente (company registry), NIF, IBAN proof, director ID, licence (e.g. IVV/CVR registration for wine producers — background, unverified), cellar address. Fermento records `attest(KYB, producer_address, hash(dossier), expiry)` and only then `set_producer`. SEP-12 is relevant if Fermento uses an anchor for EUR off-ramp to the producer — the anchor's KYB then doubles as identity binding of the payout address (receiver of fiat is a verified company), which helps legal recourse.
- **K2. Legal wrapper.** A signed producer agreement (Portuguese law, Lisbon/Porto courts or a Portuguese arbitration centre) that (a) recognises the on-chain shares as claims on specific identified units (tag IDs) held on behalf of holders, (b) authorises escrow/bond slashing per the on-chain rules, (c) grants Fermento/inspector audit access, (d) includes a penalty clause (cláusula penal) for double-sale and non-delivery, (e) retention of title / deposit arrangement so units are not the producer's free assets in insolvency (background: Portuguese Civil Code contrato de depósito / reserva de propriedade — unverified, needs a lawyer).
- **Regulatory classification matters for which mechanisms are mandatory:** if shares are redeemable for physical units (pre-sale/reward-like), the ECSP regime (loans/securities) may not apply, and Lei 102/2015 reward modality may; if shares are marketed as investments with a value mark and secondary trading, they risk being treated as financial instruments/MiCA crypto-assets. Escrow + KYB + clear redemption rights help under every classification.

### Pilot synthesis (one Portuguese producer, hackathon stage)
1. Escrow tranches in `batch_shares` (D1): 50% at fill / 2×15% inspections / 20% at redemption; refund path for missed deadlines.
2. Retained 10–15% shares locked to redemption completion (C1) + bond-from-proceeds 5% (C2).
3. Check-ins no longer add price premium unless co-signed or evidence + nonce (R1–R3, V1); rating from verified redemptions only (R4).
4. Optimistic milestone assertions with a holder challenge bond and a named human Dispute Resolver (V5, tier 3).
5. 1–2% guarantee pool from sales (I1); parametric freeze on sensor excursions (I2).
6. KYB attestation + signed producer agreement under Portuguese law (K1–K2); timelock on admin levers (D4).
Option: swap D1 for Trustless Work multi-release escrow to showcase ecosystem integration, accepting per-escrow funding/refund complexity.

### Gaps
- Exact SEP-12 organisation field names (e.g. `organization.name`) not confirmed from the spec in this session.
- No CMVM guidance found on reward/pre-sale crowdfunding or tokenized physical goods; no Portuguese legal source retrieved on deposit/retention-of-title treatment of pre-sold goods in producer insolvency.
- MiCA classification of redeemable batch shares not researched here (likely covered by another researcher).
- No Stellar anchor offering KYB-as-a-service to third-party apps was identified.
