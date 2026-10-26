# Producer dishonesty safeguards: how wine, whisky and collectible-asset platforms build trust, and what known frauds teach

Scope note: researched 2026-10-25. Fermento's model puts the goods in the producer's own cellar and pays the producer at fill. Almost every failure below happened because the goods, or the record of who owns them, sat with the party that took the money. Several sources are vendor marketing or commentary from brokers with a commercial interest. They are flagged where relevant.

## Q1. Platforms and their controls: who holds the goods, who confirms title, how often audited, who insures

### Takeaway
Every credible platform uses the same pattern. Goods sit with a third-party bonded warehouse, or a warehouse the platform owns but keeps legally separate. Each item is assigned to a named client, and title is evidenced by the warehouse's own ledger, not by a certificate from the seller. Stronger operators add a monthly external reconciliation (escrow or audit) and insurance. No platform found lets the seller or producer hold the goods unverified after receiving the money. That is Fermento's default, and it has no precedent among the platforms reviewed.

### Cited Findings

**Cult Wines / CultX (UK, active)**
- Wines are held at Coterie Vaults, a "purpose-built bonded warehouse near London". Each wine is assigned to a named client. Wines "remain your property at all times" and are "not part of Cult Wines' company assets". — [Cult Wines, Where is your wine](https://www.wineinvestment.com/us/how-it-works/where-is-your-wine/)
- Cult's platform is linked to Coterie's warehouse ledger. Each month, assignment reports go to "a third party escrow provider" for independent ownership verification, and the FAQ mentions "independent monthly audits". — [Cult Wines](https://www.wineinvestment.com/us/how-it-works/where-is-your-wine/)
- Insurance is described as "full replacement value" in one place and as "market value… at the time of the successful claim" in another. These wordings are inconsistent. — [Cult Wines](https://www.wineinvestment.com/us/how-it-works/where-is-your-wine/)
- Failure plan: if Cult stops trading, wines stay at Coterie, which would invoice clients directly for storage. Cult states it is not registered with the SEC or any state regulator. — [Cult Wines](https://www.wineinvestment.com/us/how-it-works/where-is-your-wine/)
- CultX requires wines offered for sale to be stored in its bonded facilities, so it can transfer ownership instantly. — summarised via [CultX sell page](https://www.cultx.com/contact/sell-wine)

**Vinovest (US, active)**
- Wine is stored in bonded warehouses in France, Denmark, Singapore, Hong Kong, the UK and the US. Vinovest issues "ownership certificates" and says every bottle is fully insured at market price. It authenticates provenance before adding wine to a portfolio and takes high-resolution photos of bottles and cases. — [Vinovest help](https://help.vinovest.co/how-does-vinovest-work); [Vinovest blog](https://www.vinovest.co/blog/vine-international); [Vinovest trade](https://www.vinovest.co/trade)
- I found no evidence of an independent third-party audit of Vinovest holdings. Its ownership certificates are issued by Vinovest itself, the kind of document that cask-fraud guidance warns is not proof of title (see Q2). — inference from the sources above plus [Whiskey Wash on WOWGR](https://thewhiskeywash.com/whiskey-articles/whisky-cask-ownership-just-changed-forever-wowgr-regulations-abolished-after-25-years/)

**Liv-ex (UK exchange for trade members)**
- Liv-ex opens a storage account for each trading member at authorised warehouses and updates it with every exchange transaction. Title passes when a contract of sale is made. Risk passes once the wine reaches an authorised warehouse and a proof of delivery is signed (clause 16.3). Traded wine passes through the Liv-ex warehouse in London, where it can be inspected. — [Liv-ex membership terms](https://www.liv-ex.com/liv-ex-membership-terms/)

**Oeno Group (UK). Listed as a platform, but it COLLAPSED (see Q2)**
- Oeno went bust in December 2025. Only about 20% of its wine was in individual customer accounts. The rest sat in an account controlled by Oenofuture Limited. — [67 Pall Mall](https://www.67pallmall.com/under-the-surface-why-wine-investment-scams-keep-happening/); [The Drinks Business, Mar 2026](https://www.thedrinksbusiness.com/2026/03/court-warns-of-lengthy-process-winding-down-oenofutures/)

**Vint (US, Reg A+ fractional wine and spirits). WINDING DOWN, June 2026**
- Vint sold fractional shares in 59 series LLCs under SEC Regulation A+. Each offering had legal review, a third-party valuation and ongoing reporting. Inventory sat in bonded warehouses, provider not named. — [Angel Investors Network](https://angelinvestorsnetwork.com/alternative-investments/vint-wine-platform-winddown-2026)
- In June 2026 Vint hired G2 Capital and SimpleClosure for an asset sale and orderly shutdown. It had a 2025 net loss of about $890k and a going-concern flag from its auditor. Inventory across all 59 series will be sold, with proceeds paid per series after costs. No fraud has been alleged; the failure was economic, caused by the cost of compliant offerings. Vint had restricted new offerings to accredited investors from 1 January 2024. — [Angel Investors Network](https://angelinvestorsnetwork.com/alternative-investments/vint-wine-platform-winddown-2026); [AltStreet](https://altstreet.investments/blog/vint-closure-wine-investing-platform-wind-down-what-happens-to-investors) (403 on fetch; search snippet only)

**WhiskyInvestDirect (UK)**
- It was founded by Galmarley Ltd, the team behind BullionVault (2003), and applies the bullion-vault model to bulk whisky. An older article reported about 4,000 accounts and roughly £10m invested in about 3m litres. — [Business Standard (dated)](https://www.business-standard.com/article/pf/looking-for-a-non-traditional-asset-invest-in-whisky-by-the-barrel-117042001468_1.html)
- Fees are reported as 1.75% to buy and sell, plus storage and insurance of £0.227 per litre of pure alcohol per year (not verified against company terms). — [El Club de Inversión](https://www.elclubdeinversion.com/ufaq/que-costes-y-comisiones-tiene-la-compra-de-barriles-de-whisky/)
- The company's custody page returned 404, so I could not verify which warehouse holds the stock, how often it reconciles or who insures it.

**BlockBar (NFT-backed spirits, Singapore)**
- All physical bottles behind its NFTs are stored in a bonded warehouse in Singapore. Owners can trade the NFT or burn it to have the bottle shipped; burning is irreversible. Brands such as Glenfiddich sell directly through it. — [Whiskey Wash](https://thewhiskeywash.com/whiskey-news/glenfiddich-blockbar-to-auction-single-cask-whisky-nft-to-be-redeemed-for-bottles/); [NFT Plazas](https://nftplazas.com/glenfiddich-blockbar-rare-whisky-nfts/)

**BAXUS (Solana)**
- Each bottle is authenticated, stored in a "secure, insured, temperature-controlled vault" and issued as an NFT on Solana. Redemption voids the NFT. BAXUS raised $5m from Multicoin and Solana Ventures. — [Alcohol Professor](https://www.alcoholprofessor.com/blog-posts/baxus-spirits-nft); [The Block](https://www.theblock.co/post/291956/blockchain-booze-trading-platform-baxus-raises-5-million-from-multicoin-solana-ventures); [Fortune](https://dc.fortune.com/crypto/2024/05/01/multicoin-capital-baxus-web3-wine-spirits-marketplace)

**Naked Wines Angels (producer crowdfunding by pre-purchase, UK/US/AU)**
- Customers ("Angels") pay a monthly sum, about £25 in the UK or $40 in the US, into a credit balance. Naked uses it to fund independent winemakers directly. The investor gets wine credit, not a share in a specific batch. Naked once raised £5m through a "fine wine bond" to age wine without tying up its own capital. — [Naked Wines about](https://www.nakedwines.co.uk/about/about-us); [Harpers](https://cdn796.pressflex.net/news/fullstory.php/aid/16181/Naked_Wines_looks_to_recruit_25,000_more_angels_by_year-end.html); [intowine](https://www.intowine.com/naked-wines-disrupting-wine-industry-crowdfunding)

**Scotch cask custody rules (for all cask brokers: Cask Trade, VCL Vintners, CaskX and others)**
- By law, Scotch must mature in an HMRC-approved warehouse in Scotland. Title transfers by a delivery order addressed to the warehouse keeper, and DLA Piper recommends written confirmation that the keeper's register has been updated. — [DLA Piper](https://www.dlapiper.com/en/insights/publications/2024/01/scotch-whisky-a-guide-to-the-regulatory-framework-article); [Mark Littler summary of SWA guidance](https://www.marklittler.com/personal-investment-in-a-scotch-whisky-cask-summary-swa-guidance/)
- On 3 March 2025 the Warehousekeeper Regulations replaced WOWGR. The new regime regulates only warehouses, not cask owners. Warehouses must keep clear ownership records, and ownership is evidenced by a delivery order from the warehouse, "not merely a certificate from a broker". (Written by broker Mark Littler, who has a commercial interest.) — [Whiskey Wash](https://thewhiskeywash.com/whiskey-articles/whisky-cask-ownership-just-changed-forever-wowgr-regulations-abolished-after-25-years/)
- Sources conflict on how strict this is. SWA guidance, as quoted, says "an invoice or owner's certificate may suffice", while Littler says anything not countersigned by the warehouse is not a delivery order. — [Mark Littler on SWA](https://www.marklittler.com/personal-investment-in-a-scotch-whisky-cask-summary-swa-guidance/); SWA primary text: [SWA cask investment guidance 2025 (PDF)](https://scotch-whisky.org.uk/media/2411/cask-investment-guidance_2025.pdf) (downloaded but could not be parsed)
- If title is transferred only on a company's internal ledger, HMRC and the warehouse keeper have no record that anyone other than the company owns the cask. — [Brodies](https://brodies.com/insights/food-and-drink/what-you-need-to-know-about-the-scotch-whisky-cask-purchase-process/) (via search snippet)

**Tokenised wine on Stellar**
- TERWA, from the Bordeaux merchant BTC-WINE, is a Soroban vault. It takes USDC deposits, issues tokens at a fixed price and settles them. Each token is a claim on wine production across several vintages, redeemable for USDC at a floor price or for physical wine. Independent appraisals are planned to be published on-chain. A related SCF proof of concept tokenises future revenue from five harvests of one hectare of Château Coutet in Saint-Émilion. — [SCF, TERWA](https://communityfund.stellar.org/project/terwa-fds); [SCF submission](https://communityfund.stellar.org/submissions/recub0G7qf25j381y)
- Tiamonds (SCF #33) plans tokenised diamonds, commodities and collectibles on Stellar, but not on Soroban in that submission. — [SCF dashboard](https://communityfund.stellar.org/dashboard/submissions/recKcYc2YjpGu3IuQ)

### Inferences
- The industry's standard control is to separate the custodian from the seller. Liv-ex, Cult/Coterie, BlockBar, BAXUS, WhiskyInvestDirect and every legitimate cask broker rely on it. Fermento drops it by design, because producers keep batches in their own cellars, so it must replace it with something equivalent. Candidates:
  - (a) an independent attestor with legal standing over the goods, such as the regional DOP or IG body (IVDP for Douro and Port, CVRVV for Vinho Verde, a cheese DOP certifier) or an excise warehouse regime;
  - (b) recurring unannounced physical audits;
  - (c) per-unit identifiers (NFC tags, rotation numbers or cask numbers) bound on-chain and checked at each audit.
- "Ownership certificate issued by the seller" is the weakest evidence in the whole sector. A Fermento share token minted by the producer's own contract call is effectively that certificate unless a third party countersigns the batch's existence. Countersigning could mean an attestor key in the registry contract.
- Cult's design is worth copying: monthly assignment reports go to an independent escrow agent. On-chain, this could be a monthly attestation transaction by an independent auditor key, with the batch flagged when attestations lapse.
- Cult's failure plan (the warehouse bills clients directly if the platform dies) and Vint's per-series liquidation show that platform insolvency must be planned for separately from producer fraud.

### Gaps
- UNXD (wine and spirits NFT marketplace), WiV Technology, Uvvy, Vinesia, CaskX, Cask Trade, VCL Vintners, WineFi and Crowdcube wine raises: none of my searches returned their current custody terms or status. I cannot confirm whether they are still operating as of October 2026. "UNXD/Bacchus" returned nothing.
- I found no published independent audit reports from any platform, only claims of audits.
- Whether Liv-ex audits third-party platforms' segregation: not found.
- WhiskyInvestDirect's warehouse partner and reconciliation frequency: not verified (custody page returned 404).

## Q2. Frauds and failures: mechanism, the control that failed, the control that would have caught it

### Takeaway
The frauds fall into four types. Phantom goods (Bordeaux Cellars, Cask Spirits Global, Imperial Wine). Commingled title, with stock in the seller's own account (Oeno). Overvaluation, or marks that cannot be realised (Oeno's 2023 reports, cask mark-ups). Counterfeit or misattributed goods (Kurniawan, Rodenstock, false Douro DOC). In every case the investor relied on documents from the seller and never got independent confirmation from the custodian or the appellation body. The cheapest effective control was direct confirmation from the warehouse or the appellation body before money moved.

### Cited Findings

**Bordeaux Cellars (London / Hong Kong; sentenced April 2026)**
- Mechanism: from at least June 2017 to February 2019, James Wellesley presented himself as CFO of Bordeaux Cellars. It promised investors interest from loans to "high net worth wine collectors", supposedly backed by bonded wine. About $100m was raised from roughly 140 people (71 in the US, 21 in the UK, 10 in Hong Kong). Interest was paid from new investors' money. He was sentenced on 20 April 2026 to 10 years and ordered to forfeit $1m. — [DHS/HSI](https://www.dhs.gov/news/2026/04/23/hsi-announces-sentencing-british-alien-nearly-100-million-ponzi-scheme-involving)
- The wine, the storage facilities and the borrowers were fictitious. Losses exceeded $83m, with about $14m repaid. — [The Drinks Business](https://www.thedrinksbusiness.com/2026/04/uk-national-jailed-for-10-years-over-us97m-fine-wine-fraud/); [BGWM summary](https://bgwm.co.uk/blogs/the-blanco-gomez-blog/chateau-briefing-episode-2-sentencing-the-architect-of-a-97-million-wine-fraud-scheme) (the DHS release itself does not detail the fictitious collateral)
- Failed control: the existence of collateral was never independently confirmed with a bonded warehouse.
- What would have caught it: asking the named warehouse directly whether the wine existed, and checking a registry of borrowers.

**Cask Spirits Global Ltd (UK; wound up 25 August 2026)**
- Mechanism: cold calling, social media ads, and promised returns of up to 150% with claimed tax benefits. Only 4 of 17 customers had valid ownership documents. Some certificates named a fictitious company or gave false storage details, and some casks did not exist. A Scottish bonded warehouse named to one customer denied any link to the firm. The firm handed over only 2 of the 29 accounting documents investigators requested. It went quiet around March 2025 and then tried to open a new bonded warehouse account. Customers paid £97,249 in total. — [The Spirits Business](https://www.thespiritsbusiness.com/2026/08/scam-whisky-firm-shut-down-by-uk-government/)
- Failed control: buyers accepted the seller's certificate as title.
- What would have caught it: written confirmation from the warehouse keeper, in the buyer's name, before payment. Brodies recommends independently checking the chain of title and warehouse records. — [Brodies](https://brodies.com/insights/commercial-contracts-and-outsourcing/a-watershed-moment-for-the-whisky-cask-investment-sector-lessons-from-the-cask-spirits-global-winding-up/) (403; search snippet only)

**Oeno Group / Oenofuture Ltd (UK; collapsed December 2025, compulsory winding-up 4 March 2026)**
- Mechanism: Oeno claimed £71m of wine in reserves. London City Bond reportedly holds only £5–10m of Oeno stock in Burton-upon-Trent, against roughly £7m of debts. In 2023, monthly client reports showed portfolios up 20%, but when investors tried to sell they were down about 30% after fees. In summer 2025 Oeno was still promoting a "regulated fine wine investment fund". — [67 Pall Mall (commentary)](https://www.67pallmall.com/under-the-surface-why-wine-investment-scams-keep-happening/)
- City of London Trading Standards warned that only about 20% of the wine sat in individual customer accounts. MHA Advisory were appointed joint liquidators after provisional liquidation on 5 February 2026, and they are investigating the directors. About 2,600 investors are affected, and the court warned the process will be "very lengthy". — [The Drinks Business, Feb 2026](https://www.thedrinksbusiness.com/2026/02/oenofuture-appoints-liquidator/); [The Drinks Business, Mar 2026](https://www.thedrinksbusiness.com/2026/03/court-warns-of-lengthy-process-winding-down-oenofutures/)
- Failed controls: stock was held in the merchant's own warehouse account, not on trust per client, so investors may rank as unsecured creditors. Valuations were self-reported and not tied to realisable prices.
- What would have caught it: a warehouse account in the client's own name, rotation numbers and photos per client, assets held on trust, and marks benchmarked to actual sales. — [67 Pall Mall](https://www.67pallmall.com/under-the-surface-why-wine-investment-scams-keep-happening/)

**Whisky Merchants Trading / Cask 88 / Braeburn (Scotland; administration around May 2025)**
- Braeburn USA had claimed $80m in assets. The firms stopped trading around May 2025. Edinburgh Group Spirits (Edinburgh Cask Management) bought the assets, and an audit pushed by owners in a Facebook group is matching owners to their casks. — [InsideHook](https://www.insidehook.com/whiskey/whisky-cask-investment-bankruptcy); [Companies House SC594833](https://find-and-update.company-information.service.gov.uk/company/SC594833); [Forbes (403; headline only)](https://www.forbes.com/sites/felipeschrieberg/2025/05/02/80-million-scotch-whisky-cask-investment-firm-goes-bust/)
- Failed control: owners could not readily match themselves to specific casks after the firm failed, which suggests weak per-owner records at the warehouse. This is an inference; the article gives no detail.
- What would have caught it: a per-cask owner register at the warehouse, independent of the broker.

**Imperial Wine & Spirits Merchant (UK)**
- Three people were convicted of fraudulent trading at St Albans Crown Court. 41 victims lost £6m in total, and the "merchant" was in reality a London call centre. The exact date was not confirmed. — [AOL / news report](https://www.aol.com/news/trio-jailed-over-wine-investment-060034750.html)
- Failed control: no independent check of stock. Victims trusted a sales operation with no warehouse relationship.

**Asia: Premium Liquid Assets (Singapore / Hong Kong) and others**
- PLA's former president was arrested after 13 years on the run. About 400 Hong Kong investors lost roughly €5.9m on Bordeaux en primeur purchases. — [Wein.Plus / Vino Joy](https://magazine.wein.plus/news/singapore-manager-arrested-for-bordeaux-fraud-damage-is-said-to-amount-to-over-8-million-euros)
- European Fine Wines (UK) collapsed, with the failure blamed on a failed Hong Kong office. Debts were about £2m against about £1m in assets. — [Decanter](https://www.decanter.com/wine-news/european-fine-wines-ltd-debt-totals-2m-8945)
- Best Leader Financial Group (Taiwan) promised returns of 9.5–13.5% every six months, and ten people were charged. — [The Drinks Business](https://www.thedrinksbusiness.com/?p=168961)
- En primeur is hard to verify before delivery, so it is hard to confirm that the merchant actually bought the stock. — [67 Pall Mall](https://www.67pallmall.com/under-the-surface-why-wine-investment-scams-keep-happening/)
- Relevance to Fermento: young, still-ageing batches share the en primeur weakness.

**Rudy Kurniawan (US; counterfeit fine wine)**
- Mechanism: he bought cheap old Burgundy and relabelled it as prestigious producers and vintages. Agents found Napa wine with notes indicating it was to be passed off as old Bordeaux, along with corks, stamps and labels. He sold through Acker Merrall & Condit, Christie's and Spectrum. Convicted 18 December 2013, sentenced 7 August 2014 to 10 years, released November 2020 and deported 2021. *Sour Grapes* (2016) estimates up to 10,000 fakes remain in circulation. — [Wikipedia](https://en.wikipedia.org/wiki/Rudy_Kurniawan); [Decanter](https://www.decanter.com/wine-news/guilty-rudy-kurniawan-convicted-in-new-york-court-30766/)
- How it was detected: collector Doug Barzelay noticed that Domaine Ponsot Clos Saint-Denis lots dated 1945–1971 could not exist, because Ponsot only began producing that wine in 1982. Laurent Ponsot had the lots withdrawn at Acker in April 2008. A 1923 Bonnes Mares predated the producer's first vintage of 1924, and the FBI arrested Kurniawan in March 2012. — [Wine Diarist](https://winediarist.com/?p=204); [Wikipedia](https://en.wikipedia.org/wiki/Rudy_Kurniawan)
- Failed control: auction houses relied on the consignor's provenance and did not check with the producer.
- What caught it: the producer's own records of what it had made. This is the analogue of a producer-signed batch registry that cannot be backdated.

**Hardy Rodenstock ("Jefferson bottles")**
- Mechanism: bottles engraved "Th. J." with 1780s vintages, explained by an unverifiable story of a walled-up Paris cellar. A 1787 Lafite sold at Christie's in 1985 for £105,000. Bill Koch paid about $500k for four bottles. Forensic analysis indicated the engravings were made with an electric power tool, and a tritium test and carbon-14 tests reportedly dated the wine to about 1962. Koch won a default judgment in May 2010. Rodenstock died in 2018. — [Wikipedia](https://en.wikipedia.org/wiki/Hardy_Rodenstock); [Decanter](https://www.decanter.com/wine-news/worlds-most-expensive-bottle-claimed-fake-as-renowned-collector-sued-93457/)
- Failed control: the provenance story could not be checked (no named seller, no address, no bottle count). The Monticello archive did not support it.
- What would have caught it: requiring a verifiable chain of custody before sale, and checking against producer or historical records.

**Portugal: appellation and labelling fraud (directly relevant to a Portuguese pilot)**
- November 2025: ASAE dismantled a hidden bottling line in Vila Real, behind a false wall. It seized 1,326 bottles falsely labelled as Douro DOC reserva and 12,000 labels. A criminal case was opened for usurping a designation of origin, with technical support from IVDP. — [The Drinks Business](https://www.thedrinksbusiness.com/2025/11/illegal-douro-wine-operation-shutdown-near-spanish-border/); [The Portugal News](https://www.theportugalnews.com/news/2025-11-17/illegal-wine-operation-closed-down/918767)
- December 2025, "Puro Verde": four members of the Vinho Verde regional commission (CVRVV) were arrested in a wine fraud investigation. — [The Drinks Business crime files](https://www.thedrinksbusiness.com/2025/12/the-db-wine-crime-files-part-2/); [Food Safety News](https://www.foodsafetynews.com/2025/12/investigations-target-meat-honey-and-wine-sectors-in-portugal/)
- October 2024, Gouveia: ASAE seized more than 7,000 litres of wine whose labelling had not been reported to the national wine institute. — [The Drinks Business](https://www.thedrinksbusiness.com/2024/10/more-than-7000-litres-of-wine-seized-by-portuguese-authorities/)
- Lesson: in Portugal the appellation bodies (IVDP, CVRs) hold the volumes and labels issued to each producer, so they can independently confirm a batch's volume and certification. The Puro Verde case shows that the certifier itself can be compromised, so a single attestor is not enough.

**Other enforcement and context**
- The ASA issued an enforcement notice in November 2023 over "misleading and socially irresponsible" cask investment ads. City of London Police investigated Cask Whisky Ltd, now in liquidation. — [City of London Police](https://www.cityoflondon.police.uk/news/city-of-london/news/2023/november/dont-make-pour-decisions-that-leave-your-finances-on-the-rocks-city-of-london-police-urges-people-to-stay-vigilant-over-misleading-whisky-investment-ads/); [Lexology](https://www.lexology.com/library/detail.aspx?g=e8f44116-4a5a-4c33-944b-6aa0d5c4f280)
- July 2026: the ASA ruled against Capgroup Int (formerly London Cask Company / Caskcap) for misleading review scores and missing risk warnings. The BBC documentary *Disclosure: Hunting the Whisky Bandits* aired in March 2025. — [The Spirits Business](https://www.thespiritsbusiness.com/2026/08/scam-whisky-firm-shut-down-by-uk-government/)
- Ireland: Gardaí warned that casks are sold at inflated prices, may not exist, or are sold to several investors, and that this may fund organised crime. The Irish Whiskey Association said there were no significant instances. Both accounts come from the same Forbes piece, so they conflict within one source. — [Forbes](https://www.forbes.com/sites/felipeschrieberg/2025/05/01/irish-police-warns-irish-whiskey-cask-fraud-can-fund-organized-crime/)
- One secondhand claim says a March 2025 BBC investigation found barrels duplicated across investor ledgers, marked up 2–3 times over fair value, or existing only on a warehouse spreadsheet. I could not verify this against the BBC. — [Finshots](https://finshots.in/archive/whiskey-whisky-investment-scams-explained-uk-ireland-scotch/)

**Platform failure without fraud**
- Vint (June 2026): the asset worked (it reported a 28.29% net annualised return on its 2022 exits) while the sponsor failed on cost. Investors cannot exit while the wind-down runs. — [Angel Investors Network](https://angelinvestorsnetwork.com/alternative-investments/vint-wine-platform-winddown-2026)

### Inferences
Mapping of failed controls to Fermento design. These are inferences, not sourced facts.

| Fraud pattern | Failed control | What a Fermento pilot would need |
|---|---|---|
| Phantom batch (Bordeaux Cellars, Cask Spirits Global, Imperial) | No custodian confirmation independent of the seller | Before shares are sold, an independent attestor (DOP body, notary, accountant, or a Fermento field auditor) signs on-chain that the batch exists, with volume and lot number from IVDP/CVR declarations. NFC or tag IDs are bound to the batch. |
| Same unit sold twice | Off-ledger title kept by the seller | A single on-chain registry where tag-to-batch binding is one-to-one (the repo already has a "tag binds to one batch only" test). Batch volume declared to the appellation body caps total shares. |
| Commingling / selling stock already promised (Oeno's 20%) | Stock not held on trust per client | A legal wrapper making shares a co-ownership or trust claim on a specific batch, not a debt of the producer. A producer pledge or registry entry in the cellar book. |
| Overvaluation (Oeno marks, cask mark-ups) | Seller-reported marks | Marks only from realised sales or an independent appraiser. The condition-oracle "mark" should not be producer-driven alone; the repo's capped and decaying producer care bonus partly addresses this. |
| Counterfeit or substituted batch at redemption (Kurniawan, Douro DOC) | Provenance relied on the seller | Producer-signed batch record plus appellation seal numbers. Redemption checks the same NFC tag and seal. Random sampling at fill and at redemption. |
| Producer pays himself at fill, then batch spoils or vanishes | Up-front payment removes the incentive | Escrow or tranche release: part at fill, the rest at verified milestones or at redemption. A producer bond or insurance. |
| Platform insolvency (Vint, Oeno, Cask 88) | Records held only by the platform | On-chain registry readable without Fermento. A documented run-off plan, as in Cult's warehouse-bills-client-directly approach. |

### Gaps
- I found no reliable sources on fake DOP cheese (e.g. Serra da Estrela) or cured-ham (presunto) labelling fraud in Portugal. The search returned only wine cases. Spain's Ibérico and Italy's Parmigiano frauds were not researched.
- Tokenised-wine or NFT-whisky failures: no specific failure found for BlockBar, BAXUS or UNXD in 2025–2026 coverage. Their status is unknown, not confirmed as failed.
- Imperial Wine & Spirits Merchant sentencing date and the Bordeaux Cellars co-defendant's sentence were not confirmed.
- The scale of cask fraud in the UK and Ireland (total losses, counts) has no authoritative statistic.

## Q3. Regulatory classification: when these offerings become collective investment schemes or securities, and how that shapes controls

### Takeaway
UK precedent: selling specific, individually allocated physical goods (a named case or cask in the buyer's name) generally stays outside FCA regulation, with no FSCS or Ombudsman protection. Pooled or managed arrangements risk being unregulated collective investment schemes, which cannot be promoted to most retail investors. In the EU, the question is whether a token is a MiFID II financial instrument (ESMA guidelines, March 2025) or a MiCA crypto-asset. Fractional shares in a batch whose return depends on the producer's management look closer to a financial instrument or a CIS than to sale of goods. That pushes toward regulated custody, prospectus or crowdfunding (ECSP) rules, and audited accounts.

### Cited Findings
- UK: whisky cask investment is outside FCA regulation, with no FSCS or Financial Ombudsman protection. The FCA says it keeps receiving reports of scams involving "high-priced drinks such as wine and whisky". — [Lexology](https://www.lexology.com/library/detail.aspx?g=e8f44116-4a5a-4c33-944b-6aa0d5c4f280); [Cask Trade](https://www.casktrade.com/news-events/as-rare-whisky-prices-rise-so-do-scams-and-schemes/)
- Wine and whisky only fall within the FCA's remit if structured as a collective investment scheme. Brokers stress individually allocated casks rather than pooled funds, and this is the distinction the CIS test turns on. (Promotional source.) — [Whisky Investment UK](https://whiskyinvestmentuk.co.uk/important-information-risk-warning/)
- Statutory test (FSMA 2000 s.235): a CIS is any arrangement over property whose purpose is for participants to share in profits or income, where participants lack day-to-day control and contributions are pooled or the property is managed as a whole by or for the operator. — [FSMA 2000 s.235, legislation.gov.uk](https://www.legislation.gov.uk/ukpga/2000/8/section/235) (statutory text; not fetched this session)
- The FCA (then FSA) banned promotion of unregulated collective investment schemes and close substitutes to retail investors except to certified sophisticated or high-net-worth investors. The 2012 proposals explicitly named wine. A Court of Appeal ruling in the FCA's favour signalled more scrutiny of schemes in wine and other unquoted assets. — [The Drinks Business 2012](https://www.thedrinksbusiness.com/2012/09/fsa-announces-tighter-control-on-selling-of-fine-wine-investments/); [TLW Solicitors](https://www.tlwsolicitors.co.uk/?p=179351)
- Oeno marketed a "regulated fine wine investment fund" in 2025 while its core business sat outside regulation. — [67 Pall Mall](https://www.67pallmall.com/under-the-surface-why-wine-investment-scams-keep-happening/)
- US: Vint's choice of SEC Reg A+ series LLCs (legal review, third-party valuation, ongoing reporting) added enough compliance cost to contribute to its failure. — [Angel Investors Network](https://angelinvestorsnetwork.com/alternative-investments/vint-wine-platform-winddown-2026)
- EU: ESMA published final guidelines on qualifying crypto-assets as MiFID II financial instruments on 19 March 2025, applying from around May 2025 (sources differ on 18 vs 19 May). They cover asset-referenced tokens, NFTs and hybrid tokens. Financial instruments fall under MiFID II; MiCA covers crypto-assets not covered by other EU law. — [Deloitte Luxembourg](https://www.deloitte.com/lu/en/Industries/investment-management/perspectives/ESMA-clarifies-which-crypto-assets-might-qualify-as-financial-instruments-in-the-EU.html); [FIN-FSA](https://www.finanssivalvonta.fi/en/publications-and-press-releases/supervision-releases/2025/the-european-supervisory-authorities-have-issued-a-number-of-guidelines-regarding-crypto-assets/); [ESMA compliance table](https://www.esma.europa.eu/sites/default/files/2025-10/ESMA75-113276571-1626_Compliance_table_Guidelines_on_qualification_of_crypto-assets_as_financial_instruments.pdf)
- The ECSP Regulation (EU 2020/1503) excludes MiCA crypto-assets. A tokenised share or bond could be offered through a licensed crowdfunding platform; crypto-assets outside the financial-instrument definition fall under MiCA. (Blog reading; confirm against legal text.) — [InvestHub](https://investhub.org/blog/en/the-ecsp-regulation-crowdfunding-rules-for-tokenised-raises/)
- Portuguese law-firm analysis of tokenisation under MiCA. — [PLMJ, "A tokenização de ativos e o Regulamento MiCA" (PDF)](https://thinktank.plmj.com/xms/files/02_Fintech/Insights/A_tokenizacao_de_ativos_e_o_Regulamento_MiCA.pdf) (not read in full)

### Inferences
- A Fermento share has four features: a fraction of a batch, a return from the producer's ageing work (managed by someone else), money paid to the producer at fill, and many holders per batch (pooled). This matches the elements of the UK CIS test and probably the ESMA "transferable security / financial instrument" analysis better than a sale of an allocated cask does. The defence brokers rely on, "you own a specific allocated cask", does not apply to fractions of one batch.
- If the token is classed as a financial instrument in Portugal, CMVM rules apply. That likely means a prospectus (or an exemption under thresholds), or an ECSP-licensed crowdfunding platform with investor limits and key investment information sheets. Either route brings custody, conflict-of-interest and reporting duties, which are the same controls the frauds above lacked.
- Alternative structure: a pre-sale or forward purchase of a defined number of bottles or units from a named batch, with the token as a delivery receipt (closer to Naked Wines Angels or en primeur). This may stay a consumer sale. But en primeur has its own verification weakness, and EU consumer-law and excise rules (alcohol in duty suspension) then apply.
- For a small pilot, the lowest-regret path appears to be: (1) take legal advice from Portuguese counsel and CMVM on classification before any public offer; (2) limit the pilot to sophisticated or known investors, or a small capped pre-sale; (3) adopt regulated-style controls voluntarily: third-party existence attestation, escrowed funds, periodic audits and an on-chain registry that survives the platform.

### Gaps
- No CMVM or ESMA statement found specifically on tokenised wine, cheese or other perishable or ageing goods, or on commodity-backed tokens under MiCA's asset-referenced token regime.
- Exact text of the FCA's current consumer warning on wine and whisky could not be retrieved (fca.org.uk did not surface in searches).
- The Portuguese excise regime (entreposto fiscal under the Código dos IEC) as a possible independent custodian for wine in duty suspension was not researched. It could be the Portuguese analogue of the UK bonded warehouse and needs confirming.
- Whether Portuguese DOP bodies (IVDP, CVRs, cheese DOP certifiers) would or could act as on-chain attestors: no sources found.
