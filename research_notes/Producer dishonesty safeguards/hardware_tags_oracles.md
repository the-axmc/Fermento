# Hardware, tags and oracles to stop producers faking the physical evidence behind tokenized ageing batches (Fermento, Stellar/Soroban)

Research date: 2026-10-25. Scope is a small Portuguese producer pilot: low cost, EU-available, deployable within months. Notes are grouped by the five key questions. Every cited claim carries a link; anything without a source sits under Inferences or Gaps.

Fermento's current baseline for comparison:
- an ed25519 key signs cellar temperature and humidity readings that go to a Soroban condition oracle;
- `sha256(NFC serial)` is bound to the batch on chain;
- a QR code on each unit backs redemption claims.

## 1. Secure-element / attested IoT sensors (incl. DePIN) and signature compatibility with Soroban

### Takeaway
Soroban can verify secure-element signatures directly on chain:
- **secp256r1 (P-256):** `secp256r1_verify`, which takes a 32-byte digest.
- **ed25519:** `ed25519_verify`.
- **secp256k1:** `secp256k1_recover`.

Which chip to use:
- **Cheapest route:** Microchip ATECC608B. It is P-256 only, costs about US$1.4–4 as a chip or about US$5 on a breakout board, and pairs with an ESP32 or other MCU and a temperature/humidity sensor.
- **ed25519 in hardware:** NXP SE050, but only some variants.

No off-the-shelf cellar logger was found that ships signed readings. DePIN stacks (IoTeX ioID/W3bstream, peaq) do device-signed data on their own chains and would add little for a Stellar pilot.

### Cited Findings
**Soroban crypto primitives**
- The soroban-sdk crypto module exposes three functions — [soroban-sdk crypto docs (mintlify mirror)](https://www.mintlify.com/stellar/rs-soroban-sdk/api/modules/crypto):
  - `ed25519_verify(32-byte pubkey, message, 64-byte sig)`, which panics on failure.
  - `secp256r1_verify(65-byte SEC-1 pubkey, 32-byte digest, 64-byte sig)`.
  - `secp256k1_recover(32-byte digest, 64-byte sig, recovery id 0–3)`, which returns a 65-byte SEC-1 pubkey.
- A Stellar PR discussed a split in the API shape. The standard `Crypto` set would take the full message and hash it internally, and low-level variants would move to `CryptoHazmat`. Check the current soroban-sdk version before relying on either form — [rs-soroban-env PR #1376](https://github.com/stellar/rs-soroban-env/pull/1376).
- secp256r1 was added mainly for passkeys and WebAuthn — [Stellar dev meeting 2024-02-01](https://developers.stellar.org/meetings/2024/02/01); [stellar-protocol discussion #1435](https://github.com/stellar/stellar-protocol/discussions/1435).

**Microchip ATECC608B**
- Supports ECDSA (FIPS 186-3) and ECDH on NIST P-256 (secp256r1) only. No Ed25519 appears in Microchip's summary — [Microchip ATECC608B-TCSM](https://www.microchip.com/en-us/product/atecc608b-tcsm); [ATECC608B datasheet](https://cdn.sparkfun.com/assets/a/3/7/1/9/ATECC608B_datasheet.pdf).
- Distributor single-unit prices: about US$1.36 (SOIC-8) and about US$3.89 (UDFN) — [LCSC ATECC608B-SSHCZ-B](https://www.lcsc.com/product-detail/C1020341.html); [LCSC ATECC608B-MAVDA-S](https://www.lcsc.com/product-detail/C17350254.html).
- Breakout boards:
  - Adafruit ATECC608 breakout (STEMMA QT/Qwiic, I2C): US$4.95, falling to US$3.96 at 100+ — [Adafruit 4314](https://www.adafruit.com/product/4314).
  - EU/UK reseller: £4.80 — [The Pi Hut](https://thepihut.com/products/adafruit-atecc608-breakout-board-stemma-qt-qwiic-ada4314).
  - SparkFun ATECC608A breakout: US$5.05. Some features need a Microchip NDA to get the full datasheet — [SparkFun 15838](https://www.sparkfun.com/products/15838).

**NXP EdgeLock SE050**
- The datasheet (Rev 3.8, Oct 2023) lists ECDSA, EdDSA, ECDH and ECDAA. Curves include NIST, Brainpool, Koblitz, BN, Twisted Edwards Ed25519 and Montgomery Curve25519 — [NXP SE050 datasheet](https://cn.nxp.com/docs/en/data-sheet/SE050-DATASHEET.pdf); [NXP SE050 product page](https://nxp.com/products/security-and-authentication/authentication/edgelock-se050-plug-trust-secure-element-family-enhanced-iot-security-with-maximum-flexibility:SE050).
- Ed25519 is marked only for some SE050 variants, so confirm the exact part number — same sources.
- wolfSSL's SE050 port supports ECDSA, ECDHE and Ed25519/Curve25519 — [wolfSSL blog](https://www.wolfssl.com/?p=38226).
- The FIPS 140-2 security policy covers ECDSA/P-256 and does not clearly cover EdDSA — [sec-certs FIPS 3840](https://sec-certs.org/fips/id/3840).
- An NXP community thread reports unresolved Ed448 documentation discrepancies on the SE050E — [NXP community](https://community.nxp.com/t5/Multi-Source-Translation-Content/2350589-en-US/ta-p/2351320).

**Infineon OPTIGA Trust M**
- A third-party reproduction of the feature table lists NIST curves up to P-521 and Brainpool r1 up to 512, with some curves only on certain hardware versions. Ed25519 is not mentioned — [optiga-trust-m GitHub (third party)](https://github.com/bootstrap-prime/optiga-trust-m).

**Commercial LoRaWAN loggers**
- The JRI LoRa SPY TH (temperature and humidity, LoRaWAN) encrypts data in transit and at rest to the JRI MySirius cloud. It is marketed for museums, archives and warehouses. No device signing or secure element is documented — [DirectIndustry JRI SPY TH](https://www.directindustry.com/prod/jri/product-67888-2827302.html).
- The ATEK DGN-LHT65 (LoRaWAN temperature/humidity) likewise shows no signing or tamper features — [ATEK datasheet](https://medusa.atek.io/static/1783949677450-datasheet.pdf).

**DePIN stacks**
- IoTeX ioID gives devices an on-chain identity with their own smart-contract wallet and private key to sign data on the device. W3bstream verifies computations over device data with ZK, TEE or SMPC provers — [IoTeX technology update](https://iotex.io/blog/iotex-technology-update); [W3bstream multi-prover docs](https://docs.iotex.io/depin-infra-modules-dim/w3bstream-depin-verification/multi-prover-architecture).
- An aggregator reports a 21 Feb 2026 ioTube bridge exploit on the Ethereum side. This is single-source — [yellow.com IOTX](https://yellow.com/asset/iotx).
- peaq uses DID documents that hold machine public keys; data is signed and linked to the DID — [peaq DID docs](https://docs.peaq.xyz/peaqchain/learn/peaqDID.md).
- "peaq Verify" has three tiers: machine-origin certification (Tier 1), pattern matching (Tier 2) and oracle-based checks (Tier 3). The docs said the device-origin SDK was "shortly released" — [peaq verify docs](https://docs.peaq.xyz/peaqchain/sdk-reference/javascript/verify/verify.md).
- Helium has a community LoRaWAN coverage map at mappers.helium.com, but no Portugal-specific density data was found — [RAK Helium mapper guide](https://learn.rakwireless.com/hc/en-us/articles/26743716941975-How-To-Make-a-Helium-Mapper-with-WisBlock).
- A commercial LoRaWAN operator (Lorin, a joint venture with Netmore/ECN) entered Portugal in 2023 — [IoT Now](https://www.iot-now.com/2023/06/28/132074-netmore-group-and-ecn-expands-lorawan-network-to-portugal/).

### Inferences
**Best-fit pilot build (about €30–60 per node in parts)**
- **Hardware:** an ESP32 or nRF board, an ATECC608B on Qwiic, and a Sensirion-class temperature/humidity sensor.
- **Key handling:** generate the P-256 key inside the ATECC608, where it is non-exportable. Lock the config zone. Register the 65-byte public key on chain.
- **Contract change:** switch the condition oracle from `ed25519_verify` to `secp256r1_verify` over `sha256(batch_id ‖ seq ‖ timestamp ‖ readings)`.
- **What this fixes:** the "sensor key extracted" threat. A firmware/MCU compromise can still make the secure element sign fabricated readings unless the MCU path is also hardened, so the secure element proves *which chip signed*, not *that the reading is true*.

**Why secp256r1, and an unverified detail**
- secp256r1 is the natural match because the ATECC608, OPTIGA Trust M and SE050 all do P-256. Ed25519 in hardware needs an SE050 variant with Edwards support.
- Unverified (see Gaps): the Soroban P-256 host function may require low-S normalized signatures. If so, the relayer can normalise `s → n − s` before submission, which is harmless.

**Key custody**
- To stop the *producer* from re-keying, Fermento or a third-party auditor should provision the secure element and record its public key. The ATECC608 can carry a Microchip-signed device certificate chain in its Trust&GO/TrustFLEX variants (see Gaps). Otherwise the producer simply registers a key on a device they control.

**DePIN**
- DePIN chains (IoTeX, peaq) mainly add identity registries and reward tokens. For Fermento, the same trust comes from on-chain registration of a secure-element public key on Stellar.
- Bridging an IoTeX/peaq attestation into Soroban would add a second chain and trust assumption with little gain for a pilot.

### Gaps
- No primary Infineon OPTIGA Trust M datasheet was retrieved, so its lack of Ed25519 support is unconfirmed (believed P-256/P-384/P-521, Brainpool and RSA).
- Whether Soroban's `secp256r1_verify` enforces low-S was not confirmed in this research.
- Prices for the SE050 and OPTIGA modules (e.g. Arduino Portenta's SE050, the Infineon Shield2Go) were not found.
- ATECC608 Trust&GO pre-provisioned certificate details were not fetched.
- No off-the-shelf commercial logger with documented per-reading device signatures and tamper switch was found. Vendors in cold-chain or GxP spaces (e.g. Sensitech, Tive, Elitech) were not checked.
- No current Helium coverage data for the Portuguese wine regions (Douro, Alentejo, Dão) was found.

## 2. Binding the sensor to the physical cask, and evidence against "sensor in a fridge"

### Takeaway
No product found binds a sensor to a cask cryptographically. The practical defences are:
- (a) mount the sensor inside the bung or on the cask, with a tamper loop or seal;
- (b) measure quantities that only the real cask produces: weight loss (angel's share), ullage/headspace, and ethanol vapour;
- (c) cross-check readings against outdoor weather and against several sensors.

Bung-mounted ullage and temperature sensing has been shown to work at very low cost (about AUD 27 in parts). Load-cell cask monitoring exists as patents.

### Cited Findings
**Bung-mounted sensing**
- University of Adelaide prototype (Sensors, 2015):
  - It sits in the barrel bung and measures ullage with an IR distance sensor, plus wine temperature with a DS18B20 probe hanging into the wine.
  - It runs at least 12 months on battery and costs about AUD 27 in parts.
  - It sends wireless alerts on drift so barrels can be topped up or moved.
  - [Zhang et al., Sensors 2015 (PMC4570382)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4570382/)
- Patent application US 20150198474, "Barrel Bung Wireless Sensor Pack": a fluid-level and temperature sensor inside a wine or whiskey barrel bung, with a wireless gateway, that also alerts on leaks — [Justia](https://patents.justia.com/patent/20150198474).
- Commercial smart bungs from Sapere and TrenLot were reported in 2017 as "6–12 months from launch" at a planned US$10 per barrel per month. Current availability is unverified and they may never have shipped — [Wineland](https://wineland.co.za/use-cordless-smart-barrel-bungs).

**Weight and vapour monitoring**
- US 11954554 (DT Whisky Solutions) gives each monitored cask a load cell, an RFID reader, an accelerometer and an alcohol vapour sensor:
  - It estimates ABV from alcohol content and measured liquor weight.
  - Up to four casks per subsystem; power by battery or PoE.
  - It cites an angel's share of about 2% volume a year in Scotland and up to 5% elsewhere.
  - [Google Patents US11954554](https://patents.google.com/patent/US11954554)
- An earlier patent, US10416036, measures loss by light transmission through an expansion volume around the cask — [Google Patents US10416036](https://patents.google.com/patent/US10416036).
- Bacardi/John Dewar & Sons are trialling a robot dog with ethanol sensors to find leaking casks. NMIS calls it an early-stage proof of concept — [The Manufacturer](https://www.themanufacturer.com/articles/robot-dog-sniffs-out-the-future-of-whisky-warehousing-innovation/).

**Photo attestation (C2PA)**
- Google Pixel 10 Camera signs photos with C2PA Content Credentials at Assurance Level 2, backed by Tensor G5 and the Titan M2 security chip — [Google Security Blog, Sep 2025](https://security.googleblog.com/2025/09/pixel-android-trusted-images-c2pa-content-credentials.html?hl=pt_BR).
- Secondary sources say Samsung Galaxy S25 credentials apply only to AI-edited images — [softwareseni (secondary)](https://softwareseni.com/c2pa-adoption-in-2026-hardware-platforms-and-verification-reality).
- Nikon reportedly suspended its C2PA signing after a vulnerability. This is unverified.

### Inferences
**Anti-"fridge" checks the oracle contract or an off-chain scorer can apply**
1. **Thermal-mass signature.** A real cask in a cellar shows heavily damped, lagged diurnal swings relative to outdoor temperature. A fridge shows a flat line or compressor sawtooth.
   - Correlate the signed readings with free public weather data for the registered location. IPMA (Portugal) or Open-Meteo would fit, though these specific APIs were not researched here.
   - Flag series that are too flat or too periodic.
2. **Two-sensor differential.** One sensor sits in the bung (liquid or headspace) and one is ambient on the cask face. Both are signed by the same secure-element node or by two nodes. Their difference and lag should match physics.
3. **Accelerometer plus tamper loop.** An accelerometer detects removal or movement. A tamper loop runs through the mounting strap, or an NTAG 424 DNA TagTamper sits across the bung (see section 3). An "opened" event is signed and posted.
4. **Weight or ullage trend.** Expected monotone loss of about 2–5% a year is hard to fake without the real cask. A refill shows as a step up, and dilution shows as weight up with ullage down.
5. **Location.**
   - The cheapest useful option is a Wi-Fi/BLE scan fingerprint (BSSIDs seen) hashed into the signed payload.
   - GPS works poorly indoors in cellars.
   - LoRaWAN gateway metadata (which gateway heard it, RSSI) is weak evidence of location, but it is controlled by the network operator rather than the producer.
6. **Random audits.** A periodic "challenge" asks the producer to tap the cask's NFC tag with a C2PA-signing phone (Pixel 10). This yields a signed photo plus a fresh SUN/HaLo signature with a server nonce, binding time, tag and image.
- None of these is proof in isolation. Together they raise the cost of faking from "move one sensor" to "simulate a cask's physics across several signed channels".

### Gaps
- No commercial, currently shipping smart bung or cask load cell with price and EU availability was confirmed. The Sapere and TrenLot status is unknown.
- No academic source quantifying cellar-versus-outdoor temperature damping for wine cellars was retrieved; the inference is based on physics.
- Wi-Fi fingerprinting and LoRaWAN geolocation products were not researched.
- Pixel 10 availability and C2PA verification libraries in Portugal were not checked.

## 3. Anti-cloning NFC and tamper-evident seals

### Takeaway
The current `sha256(serial)` binding gives almost no protection. Any phone reads the UID, a "magic" or emulated tag reproduces it, and the hash is public on chain.

Recommended upgrade:
- **Lowest cost:** NXP NTAG 424 DNA with SUN/SDM. A fresh AES-CMAC over UID and counter is produced on every tap. The TagTamper variant adds an open/closed loop for bung or capsule seals.
- **Verification:** AES-CMAC is symmetric, so the check must run off chain by whoever holds the tag key. That should be Fermento or an auditor, not the producer. The result is then posted to Soroban.
- **On-chain alternative:** Arx HaLo chips sign with secp256k1. Soroban's `secp256k1_recover` can verify them on chain, and HaLo keys carry a manufacturer attestation.

### Cited Findings
**NTAG 424 DNA and SUN/SDM**
- NTAG 424 DNA adds a dynamic AES-CMAC to the NDEF URL on each read, computed from the UID and a 24-bit read counter; the server verifies it — [WakDev NTAG424 knowledge base](https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag424-dna.html).
- A cloned NDEF carries a stale CMAC, and an attacker without the key cannot produce a fresh one — [Stacker News dev post (secondary)](https://www.stacker.news/items/1501862).
- Replay protection depends on the server storing the last accepted counter per tag and rejecting anything not higher. The Rust `ntag424` crate's verifier takes a counter-store argument — [docs.rs ntag424](https://docs.rs/ntag424); [NXP community: verify CMAC](https://community.nxp.com/t5/NFC/How-to-verify-the-CMAC-myself/m-p/1046998).
- The UID can still be copied, so authenticity comes from the CMAC and counter, not from the UID — [WakDev](https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag424-dna.html).
- NTAG 424 DNA succeeds NTAG 413 DNA and adds LRP mode against side-channel attacks — same source.
- NTAG 424 DNA TagTamper adds a tamper loop to detect whether a product was opened before sale — [NXP NTAG 424 DNA product page](https://nxp.com/products/rfid-nfc/nfc-hf/ntag-for-tags-labels/ntag-424-dna-424-dna-tagtamper-advanced-security-and-privacy-for-trusted-iot-applications:NTAG424DNA); [WIOT group](https://wiot-group.com/think/en/products/nxp-semiconductors-ntag-424-dna-ntag-424-dna-tagtamper/).
- Open-source Android tooling exists for configuring the SDM feature — [AndroidCrypto/Ntag424SdmFeature](https://github.com/AndroidCrypto/Ntag424SdmFeature).

**NTAG 424 DNA prices (no clean EU per-piece price found)**
- Chinese manufacturer tamper seal sticker: US$0.11 sample price, die variant unclear — [RFID Tag World](https://www.rfidtagworld.com/products/Self-destructive-tag/Tamper-HF-NFC-Tag/nfc-ndef.html).
- UK: £1.66 per PVC card — [usmartcards](https://usmartcards.co.uk/ntag-424-dna).
- Italy: Avery Dennison Circus Pro NTAG424 DNA Ø22 mm wet inlay, price not shown — [rfid.it](https://rfid.it/en/avery-dennison/1354-circus-pro-nxp-ntag424-dna-o-22-wet-3-layer-hf-nfc.html).
- Avery Dennison Bullseye Pro NTAG424 DNA datasheet — [Avery Dennison](https://rfid.averydennison.com/content/dam/rfid/en/products/rfid-products/data-sheets/datasheet-Bullseye-Pro-NTAG424-DNA.pdf).
- NTAG 424 DNA TT 25×50 mm labels: US$145–3,013, likely quantity tiers — [rfidsolution.com](https://rfidsolution.com/?p=1232).
- Bare IC NT4H2421G0DA8 at volume — [element14 TW](https://tw.element14.com/en-TW/nxp/nt4h2421g0da8-02j/nfc-rfid-tags-transponders-nfc/dp/4784260).

**Arx HaLo**
- The libhalo command set documents signing as "plain ECDSA (secp256k1)":
  - Slots #1 and #3 sign raw digests. Slot #3 is user-generated with `gen_key` and can be password-protected.
  - Slot #2 is a protected key used for `sign_random` (4-byte counter plus 28 random bytes) and `sign_challenge` (signs a caller-supplied 32-byte challenge).
  - `rootAttestSig` is the manufacturer's signature over the tag's public key #2. Other keys carry attestations signed by key #2.
  - Older tags (version below 01.C4) need a legacy sign command.
  - [libhalo halo-command-set.md](https://github.com/arx-research/libhalo/blob/master/docs/halo-command-set.md)
- No P-256 or Ed25519 support is documented for HaLo — same source.
- No public HaLo pricing was found.
- Arx Research also makes "Burner" — [Arx/Burner help](https://intercom.help/arx-research/en/articles/9762674-who-built-burner).

**Wine closure and anti-refill products**
- Selinko InTact (with Amcor Capsules): an NFC chip in the capsule that shows authenticity and whether the bottle has been opened. It was adopted by Domaine Ponsot and Henri Rebourseau (2017) — [The Drinks Business](https://www.thedrinksbusiness.com/2017/04/domaine-ponsot-adopts-new-authentication-measure/).
- Selinko CapSeal (with Inside Secure): an NFC tag under the capsule — [NFC World wine](https://www.nfcw.com/technology/wine/).
- Selinko and Toppan launched a sensor plus NFC tag under the capsule that detects removing, tampering with or piercing the cork — [Labels & Labeling](https://labelsandlabeling.com/news/interactive-technology/selinko-and-toppan-launch-new-protection-against-wine-bottle-refilling).
- Selinko LabelSeal: a 13.56 MHz NFC tag in the label — [NFC World](https://www.nfcw.com/?p=29399).
- No prices were published. Sources date from about 2014–2017, so current status is unverified.
- Luxury wine brands moving to smart closures (2026) — [Vinetur, Jun 2026](https://www.vinetur.com/en/amp/20260602101876/luxury-wine-brands-turn-to-smart-closures.html).
- eProvenance makes case-level temperature monitors and NFC temperature loggers for wine shipments; InTact was designed to work with them — [The Drinks Business](https://www.thedrinksbusiness.com/2017/04/domaine-ponsot-adopts-new-authentication-measure/).
- Academic reference design for NFC wine anti-counterfeiting — [arXiv 1601.06372](https://arxiv.org/abs/1601.06372).

### Inferences
**Comparison with Fermento's current approach**

| Option | Clonable? | Verify where | Detects opening? | Approx. unit cost | Soroban fit |
|---|---|---|---|---|---|
| Current: `sha256(UID)` on chain | Yes (UID readable; magic or emulated tags) | Anywhere | No | Cheapest NTAG21x | Hash compare only; proves nothing |
| NTAG 424 DNA SUN | No, if the key is secret; replay blocked by counter check | Server holding the AES key | No | Sticker from about US$0.1 (CN sample) to about €1–2 retail (unverified for EU) | Server verifies, then posts an attestation or counter to the contract |
| NTAG 424 DNA TagTamper | As above | Server | Yes (loop state in the SUN message) | Higher; quote needed | As above, plus "sealed/opened" state on chain |
| Arx HaLo (secp256k1) | No (key in chip; manufacturer attestation) | On chain via `secp256k1_recover` | No (unless built into a seal) | Unknown | Contract recovers the pubkey from `sign_challenge(nonce)` and compares it to the stored key |
| Selinko / Toppan capsule seals | Vendor-managed | Vendor cloud | Yes | Quote only | Vendor API, then Fermento server, then chain |

**NTAG 424 SUN flow for Fermento**
1. Fermento, not the producer, personalises the tags and keeps the AES app keys in its server or HSM. If the producer holds the keys, they can write fresh valid tags for any cask, which defeats the purpose.
2. The tag URL points at the Fermento verifier. The verifier checks the CMAC and that the counter is strictly greater than the last one, then decrypts the PICCData (UID plus counter).
3. The verifier posts `(batch_id, uid_hash, counter, tamper_status)` to the Soroban contract, signed by a verifier key that is ed25519 or P-256 and registered on chain.
4. The contract stores the last counter per tag to keep the replay check on chain as well.

**HaLo flow**
- The contract issues a nonce. The producer or holder taps and gets a `sign_challenge(nonce)` signature. The contract runs `secp256k1_recover`, compares against the registered tag public key and checks the manufacturer attestation off chain once at registration.
- This proves "the physical chip was present now" without a trusted verifier. It still does not prove the chip is on the right cask.

**Binding the tag to the cask**
- Embed the tag under the bung or capsule so that removing it breaks the antenna or tamper loop. Self-destructive / frangible labels exist in the NTAG 424 range.
- Tag the cask, and also tag each unit or bottle at bottling with a separate SUN tag linked to the batch on chain. This replaces the static QR, which is trivially copied.
- Keep QR codes only as a fallback for phones without NFC.

### Gaps
- No Arx HaLo price or EU purchase channel was found.
- Kong (Kong.cash) chips were not researched.
- No Prooftag (bubble seal) or Ennoblement information was retrieved.
- Verisart is mainly art certification and appears irrelevant.
- No firm EU per-unit price for NTAG 424 DNA TagTamper stickers.
- The exact TagTamper SUN message format (how tamper status is encoded) was not fetched from the NXP datasheet or application notes.
- Current Selinko product status and pricing were not found.

## 4. Oracles on Stellar (2025–2026) and attestation frameworks usable from Soroban

### Takeaway
As of October 2026, the Stellar docs list six oracle providers: RedStone, Reflector, Band, DIA (testnet only), Pyth and Chainlink.
- All are market or price data. None mentions IoT.
- Band describes itself as connecting "real-world data and APIs", and RedStone and DIA offer custom feeds.
- Chainlink Data Feeds and Data Streams went live on Stellar mainnet on 14 Oct 2026.

For Fermento's sensor and tag evidence, no third-party oracle network adds trust today. The right pattern is a self-run, signed relay verified with Soroban's native signature checks. Optionally, ZK proofs can be verified on chain now that BN254 pairing (Protocol 25 "X-Ray") and a RISC Zero Groth16 verifier exist.

### Cited Findings
**Oracle providers in the Stellar docs**
- The Stellar docs list RedStone (mainnet and testnet), Reflector (mainnet and testnet), Band (mainnet and testnet), DIA (testnet only), Pyth (mainnet and testnet) and Chainlink (mainnet and testnet). None of the providers mentions IoT — [Stellar Docs: Oracle Providers](https://developers.stellar.org/docs/data/oracles/oracle-providers).
- Band is described as "a cross-chain data oracle aggregating and connecting real-world data and APIs to smart contracts" — same source.
- RedStone "can deploy custom feeds with a configurable pricing methodology" — same source.
- DIA offers "custom oracle configuration with tailored sources and methodologies" — same source.
- Reflector offers subscriptions with "user-defined customized triggers", WebHook notifications, and "an on-chain proof of the triggered event" — same source.
- Reflector is a set of Soroban contracts plus peer-to-peer consensus among data-provider nodes run by Stellar ecosystem organisations. Feeds cover on- and off-chain asset prices, CEX/DEX rates, FX, and stock indices — [Reflector tutorial (GitHub)](https://github.com/olivmath/reflector-tutorial).
- RedStone uses a push model: off-chain updaters operated by RedStone submit to an on-chain Adapter contract when prices move past deviation thresholds; Blend is preparing to integrate. This is a vendor source — [RedStone blog, 4 Mar 2026](https://blog.redstone.finance/2026/03/04/stellar-finally-gets-the-oracle-infrastructure-it-deserves/).

**Chainlink on Stellar**
- Data Feeds and Data Streams went live on Stellar mainnet on 14 Oct 2026. Feeds can be read from a Soroban contract or through RPC simulation. SDF covers the operating costs under Chainlink's Scale program — [Crypto Briefing](https://cryptobriefing.com/stellar-integrates-chainlink-data-services-defi/); [KuCoin flash](https://www.kucoin.com/news/flash/chainlink-launches-data-services-on-stellar-network).
- One analysis notes that availability does not show DeFi usage, and that CCIP on Stellar is not confirmed — [CoinGabbar](https://www.coingabbar.com/en/chainlink-news-stellar-defi-apps-adoption-check).
- An earlier SCF project relayed Chainlink VRF (randomness) to Soroban through Fantom, which is outdated relative to the native launch — [Stellar blog SCF recap](https://stellar.org/blog/ecosystem/stellar-community-fund-recap-soroban-infrastructure).

**DIA**
- DIA brought price feeds and randomness to Soroban testnet through an SCF award — [DIA blog](https://diadata.org/blog/post/soroban-stellar-oracle-dia).

**ZK verification on Soroban**
- Protocol 25 "X-Ray" (Jan 2026) added the BN254 host functions `bn254_g1_add`, `bn254_g1_mul` and `bn254_multi_pairing_check`, plus Poseidon, which enable on-chain zk-SNARK verification — [Stellar blog: X-Ray](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25).
- Protocol 26 added CAP-0080 (BN254 MSM, Fr arithmetic, on-curve checks) — [Stellar skills: zk-proofs](https://skills.stellar.org/skills/zk-proofs/SKILL.md).
- Nethermind built a RISC Zero Groth16 verifier for Soroban — [Boundless: verifying proofs on Stellar](https://boundless.network/blog/verifying-proofs-on-stellar).
- A community tool reports that Groth16 verification costs about 12M CPU instructions, about 12% of the budget. This is a third-party figure — [stellar-zk (ecosyste.ms)](https://awesome.ecosyste.ms/projects/github.com%2Fsalazarsebas%2Fstellar-zk).

### Inferences
- No Stellar oracle carries IoT or cellar data. Using Band, RedStone or DIA "custom feeds" would just put a third party between Fermento's sensor and the chain without improving physical truth.
- **Price oracles are still useful.** Chainlink, Reflector or RedStone could supply EUR/USD or XLM prices for valuations or redemptions in the app.
- **Recommended evidence path:**
  1. The secure-element sensor (P-256) or SUN verifier signs.
  2. A relayer submits the readings.
  3. The Soroban contract runs `secp256r1_verify` or `ed25519_verify` against the registered device key, then enforces rules: monotonic sequence, timestamp window, plausible ranges, and maximum reading gap.
- **ZK route for richer checks without putting raw data on chain.** A RISC Zero guest program could verify a month of SE-signed readings plus a weather-API response and output "cellar damping ratio OK". The Groth16 receipt is then verified on Soroban through the Nethermind verifier.
- zkTLS (TLSNotary or Reclaim) would let the weather-API fetch be proven, but no Soroban integration was found (see Gaps). This suits a later phase, not a months-long pilot.

### Gaps
- No evidence was found of TLSNotary, Reclaim, Pluto or other zkTLS verifiers deployed on Soroban.
- The Chainlink Functions equivalent on Stellar was not found; only Data Feeds and Streams are confirmed.
- No details were found on whether Band's "real-world data and APIs" on Stellar includes any non-price feed in practice.
- DIA mainnet status on Stellar remains "testnet only" in the docs.

## 5. Physical-chemistry evidence that can be sensed or sampled remotely

### Takeaway
Three physical signals are the strongest evidence against cask swaps, dilution or refills:
- **Weight loss over time** (angel's share, about 2–5% a year);
- **ullage / headspace;**
- **ethanol vapour** at the cask.

For a pilot, low-cost options are load cells and bung ullage sensors. Inline ABV and dissolved-oxygen probes exist at winery-process scale, but no prices were published and they suit tanks more than individual casks. Periodic sampled lab ABV or density checks remain the cheap ground truth.

### Cited Findings
**Weight, ullage and vapour**
- DT Whisky Solutions' system (patent) combines a load cell, an alcohol vapour sensor, an accelerometer and RFID per cask, and estimates ABV from alcohol content and measured liquor weight. Angel's share is about 2% a year in Scotland and up to 5% elsewhere — [US11954554](https://patents.google.com/patent/US11954554).
- Bung ullage (IR distance) plus a wine temperature probe was demonstrated for about AUD 27 in parts with at least 12 months of battery life — [Sensors 2015](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4570382/).
- An ethanol-sniffing robot (Boston Dynamics-style) at Dewar's is a proof of concept for leak detection — [The Manufacturer](https://www.themanufacturer.com/articles/automation-in-scottish-whisky-robot-dog-monitors-the-angels-share-at-john-dewar-sons/).

**Inline ABV**
- BevSense VS-3000E is an infrared inline or in-tank sensor that measures up to four concentrations (incl. alcohol) plus temperature; no price is listed — [BevSense datasheet](https://www.beveragesensors.com/wp-content/uploads/vs-3000-beer-wine-and-fermentation-monitor-data-sheet.pdf).

**Dissolved oxygen**
- Hamilton Visiferm DO Arc: optical inline DO up to 25 ppm with built-in wireless and Bluetooth — [The Engineer app report PDF](https://theengineer.markallengroup.com/production/2021/06/XDPIA004EN_E_Monitoring_Dissolved_CarbonDioxide_and_Oxygen_in_Wine_AppRep.pdf).
- Anton Paar Oxy 510: 0–2,000 ppb trace and 0–22.5 ppm — same source.
- PreSens optical sensor spots placed in sight glasses on tanks and barrels to monitor DO during ageing — [PreSens DO application note](https://www.presens.de/knowledge/publications/application-note/dissolved-oxygen-determination-576); [PreSens Oxygen Exchange Window](https://www.presens.de/products/detail/oxygen-exchange-window-oew-pst3).
- Equipment catalogues for winery DO and ABV gear — [Gusmer 2026-27 catalog](https://catalogs.gusmerenterprises.com/view/12736983/34/).

### Inferences
**What each signal catches**
- **Weight curve:** dilution or refill shows as a weight step up. A swap to a different cask breaks the continuous weight series, especially with tare and empty weight recorded at onboarding. A fridge-held sensor shows no weight signal at all.
  - Combine the load cell (a commodity HX711 amplifier plus a 4×50 kg load-cell kit at hobbyist prices; prices not sourced here) with the secure-element-signed node.
- **ABV:** for wine, ABV drift is small. For spirits, ABV falls or rises depending on humidity. Sampled checks at onboarding, mid-term and bottling, by an independent lab or a sworn assessor (e.g. under the Portuguese IVV or regional CVR processes, not researched), are the trust anchor. Their hash goes on chain.
- **Dissolved oxygen:** PreSens spots are non-invasive (read through glass with an optical reader). They are mainly a quality and oxidation signal rather than anti-fraud evidence.
- **Unit level:** bottles and units carry NTAG 424 DNA TagTamper capsules so that refills of bottled units are detectable (Selinko/Toppan show the market pattern).

### Gaps
- No prices for PreSens, Hamilton, Anton Paar or BevSense equipment; quotes are needed.
- No currently shipping commercial cask load-cell product with EU availability was confirmed (DT Whisky Solutions' product status is unknown).
- No source was found on wine-specific (rather than whisky) angel's-share rates in Portuguese cellars, nor on Portuguese regulatory sampling procedures (IVV/CVR) that could serve as an independent oracle.
