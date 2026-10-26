# Regulators, custody and labs: independent checks on a producer's ageing batches (Portugal/EU, UK whisky as model)

Scope note: researched 2026-10-25. Many primary sources are Portuguese-language (IVDP, IVV, AT/Portal das Finanças, DGADR, JORAM for Madeira, Diário da República); they are summarised in English below and marked [PT]. Several primary PDFs (notably the IVDP Certification & Control Manual, Ed. 13, May 2024) could not be text-extracted in this session, so some IVDP details rest on IVDP's HTML guide rather than the manual.

## 1. Appellation and regulatory bodies: what records exist and what a third party can verify

### Takeaway
Portugal's wine regulators already keep per-operator stock ledgers: IVDP runs a "conta corrente" (stock current account) per Port/Douro trader that caps sales at certified volume, plus numbered guarantee seals whose use is logged per bottling lot; IVV collects a mandatory annual stock declaration (31 July reference date) from every wine holder via SIVV; IVBAM certifies Madeira with a seal, tasting panel and official lab; CVRPS certifies DO Setúbal (Moscatel). Queijo Serra da Estrela DOP is certified by a private body (Kiwa Sativa) with serial-numbered casein marks and INCM holograms. None of these ledgers is exposed through a public API: a platform could only get access through the producer (a mandate or certificates the producer provides) or through a data-sharing agreement with the body. Consumer-facing checks amount to checking the physical seal, plus email queries to IVDP.

### Cited Findings
**IVDP (Port, Douro) [PT]**
- IVDP is legally responsible for controlling Port traders' sales capacity ("capacidade de vendas") and for controlling stocks and movements, opening and moving each trader's current account (conta corrente). — [IVDP Circular 148, 2021](https://www.ivdp.pt/pt/docs/circulares/circular_148.pdf); [IVDP circulares index](https://www.ivdp.pt/pt/agentes-economicos/circulares/)
- For Port, a conta corrente is opened for declared stock after the trader enrols, and sales capacity is calculated under Article 35 of the Estatuto. For Douro/IGP, a conta corrente is opened per wine type from the actual quantity of each batch, and sales are limited to the certified volume. Stock must be declared on the "Requisição de Serviços" form. — [IVDP Guia de Comercialização, Cap. 2 (20 Jan 2023)](https://www.ivdp.pt/pt/comunicacao/guias-tematicos/comercializacao/guia-comercializacap/capitulo-2-colocacao-no-mercado/)
- Certification produces a Certificado de Controlo de Qualidade (CCQ), supported by a sensory tasting report (BAS) and a lab analysis report (BAL). The producer applies through the IVDP portal and sends labelled bottles, and the CCQ issues after analytical and sensory approval. Bottled sales also need an IVDP registration number and at least one approved label before seals can be bought. — [IVDP Guia Cap. 2](https://www.ivdp.pt/pt/comunicacao/guias-tematicos/comercializacao/guia-comercializacap/capitulo-2-colocacao-no-mercado/)
- Certification validity windows for Port: Vintage must be bottled by 30 July of the 3rd year after harvest; LBV by 31 Dec of the 6th year; Reserva Tawny/Branco/Garrafeira certification lasts 3 years; Ruby/Tawny/Branco 2 years. — [IVDP Guia Cap. 2](https://www.ivdp.pt/pt/comunicacao/guias-tematicos/comercializacao/guia-comercializacap/capitulo-2-colocacao-no-mercado/)
- Each January, IVDP sends producers their stock data broken down by storage location (Região Demarcada do Douro, Entreposto de Gaia, rest of Portugal, abroad), and producers must return this annual stock declaration (DAE) by a deadline. Shipments and exports need a prior RCDO declaration, and domestic sales need a monthly electronic sales declaration by the 15th of the following month. — [IVDP Guia Cap. 2](https://www.ivdp.pt/pt/comunicacao/guias-tematicos/comercializacao/guia-comercializacap/capitulo-2-colocacao-no-mercado/)
- Guarantee seals (selos de garantia): sellers must buy and collect all seals ordered, and phased pick-up is prohibited. Every Port trader must keep an up-to-date register showing, for each seal used, the bottling date, brand, wine type, destination, quantity and lot number (required since 1998). A 2021 circular added electronic reporting of seal application within a set deadline. — [IVDP Circular 148 (2021)](https://www.ivdp.pt/pt/docs/circulares/circular_148.pdf)
- Seals carry security features, and a bottle without an IVDP seal "is not Port". IVDP points consumers with doubts to ivdp@ivdp.pt and publishes a fraud gallery. No online seal-number lookup was found. — [IVDP Galeria de Fraudes](https://www.ivdp.pt/pt/informacao/galeria-de-fraudes/); [IVDP seal production requirements](https://www.ivdp.pt/pt/formularios/Selos2014/Requisitos%20para%20a%20produ%C3%A7%C3%A3o%20de%20selos%20de%20garantia%20DOP%20Porto,%20DOP%20Douro%20e%20IGP%20Duriense,%20incorporados%20no%20contrarr%C3%B3tulo.pdf); [Port to Port blog on seals (2018, secondary)](https://porttoportwine.blogspot.com/2018/03/the-traditional-ivdp-porto-denomination.html)
- Douro/IGP seals come in four groups (paper label, adhesive, incorporated, "cavaleiro") by capacity band (Portaria 426/2012, DL 94/2012). Coordination, control, promotion and certification fees are paid when seals are bought; the guide gives no amounts. — [IVDP Guia Cap. 2](https://www.ivdp.pt/pt/comunicacao/guias-tematicos/comercializacao/guia-comercializacap/capitulo-2-colocacao-no-mercado/)
- IVDP's Certification and Control Manual (Ed. 13, May 2024) is the governing procedural document. — [IVDP Manual de Certificação e Controlo Ed.13](https://www.ivdp.pt/pt/docs/ManualCertif_Cont_Porto_Douro_Ed13_Maio_2024.pdf) (not text-extractable in this session)

**IVV / SIVV (all Portuguese wine) [PT]**
- Every holder of wine products, individual or company, must file an annual stock declaration (Declaração de Existências) referenced to stocks on 31 July, filed electronically in SIVV between 1 Aug and 10 Sep (2026 campaign). Fines run up to EUR 10,000. — [postal.pt, Jul 2026](https://postal.pt/economia/quem-tiver-vinho-armazenado-tera-de-fazer-esta-declaracao-ate-setembro-ou-arrisca-multa-de-10-mil-euros/)
- The obligation covers volumes held on 31.07 each year. Zero-stock declarations have been allowed since 2023, and more than one declaration per installation is allowed for distinct activities. Login is by NIF and access code at sivv.ivv.gov.pt. — [IVV Nota Informativa 8/2022 via Agroportal](https://www.agroportal.pt/wp-content/uploads/2022/07/Nota_Informativa_8_2022_Declara__o_de_Ex.pdf)
- Fines range from EUR 250 to EUR 10,000 under DL 213/2004 art. 18 (cited in a 2019 notice). — [Agroportal](https://bo.agroportal.pt/?p=735204); [IVDP circular 51](https://www.ivdp.pt/pt/docs/circulares/51.pdf)
- IVDP publishes aggregate stock statistics (e.g. "Info-mercado 2-2018 Existências"), not per-producer data. — [IVDP Info-mercado Existências](https://www.ivdp.pt/pt/docs/Info-mercado%202-2018%20Exist%C3%AAncias.pdf)

**IVBAM (Madeira) [PT]**
- IVBAM was formed in 2006 by merging IBTAM and IVM. Its statutory duties include controlling and inspecting wines and other wine-derived products. — [DLR 18/2006/M](https://www.madeira.gov.pt//Portals/25/Documentos/Legislacao/DLR_18_2006_M.pdf)
- IVBAM's Laboratório de Produtos Vitivinícolas e Bebidas Espirituosas is the EU-designated official lab for physico-chemical quality control of DO/IG Madeira. A 2023 regional portaria updated the fee schedule for lab tests and the Câmara de Provadores (tasting panel); the 2008 schedule had been amended in 2012. — [JORAM I Série 070, 13 Apr 2023](https://joram.madeira.gov.pt/joram/1serie/Ano%20de%202023/ISerie-070-2023-04-13sup2.pdf); [Agroportal on lab accreditation renewal](https://www.agroportal.pt/autoridade-nacional-renova-certificacao-do-laboratorio-de-produtos-vitivinicolas-da-madeira/)
- Every Madeira bottle carries an IVBAM seal (older bottles show "IVM"). Age indications (5 to 50+ years) describe a style, and the IVBAM tasting panel must approve the blend as typical of the stated age. Colheita/Frasqueira are vintage-dated categories. — [Madeira Wine Guide (secondary)](https://madeirawineguide.com/madeira-wine-styles-labels/); [GuildSomm](https://www.guildsomm.com/public_content/features/articles/b/stamp/posts/madeira)
- A 2015 Madeira regional ordinance ties DO Madeira trading to a "permanent minimum stock". If stock falls below it, trading can be suspended, with up to 12 months after IVBAM notification to remedy. — [Official Gazette RAM 13 Feb 2015 (English translation hosted by madeirawijn.nl)](https://madeirawijn.nl/wp-content/uploads/2022/05/Madeira-wijnwetgeving.pdf)

**CVR Península de Setúbal (Moscatel de Setúbal) [PT]**
- CVRPS is the designated certifying entity for controlling production and trade and certifying DO «Setúbal» wines. — [Portaria 614/2008 / Diário da República](https://diariodarepublica.pt/dr/detalhe/portaria/793-2009-492980); [Portaria 118/2014](https://diariodarepublica.pt/dre/detalhe/portaria/118-2014-25345927)
- «Moscatel de Setúbal» / «Moscatel Roxo de Setúbal» require at least 85% Moscatel in the must. — [Portaria 793/2009](https://diariodarepublica.pt/dr/detalhe/portaria/793-2009-492980)
- In 2019 CVRPS certified more than 55 million bottles across its DOs/IG (14% volume growth). — [Echo Boomer](https://echoboomer.pt/vinhos-de-setubal-crescimento-volume-certificacao/)

**Queijo Serra da Estrela DOP [PT]**
- Control and certification body: Kiwa Sativa, Lda. Management body / producer group: ESTRELACOOP. — [DGADR Produtos Tradicionais](https://tradicional.dgadr.gov.pt/pt/cat/queijos-e-produtos-lacteos/31-queijo-da-serra-da-estrela); [Wikipedia PT](https://pt.wikipedia.org/wiki/Queijo_Serra_da_Estrela)
- The specification (2022) says a private control body (OPC) certifies only cheese from licensed, controlled premises. Each cheese gets a serial-numbered casein mark on its base, the model is approved by the producer group, and the number must appear in records linking each milk lot to the cheese lot. — [Caderno de Especificações 2022](https://tradicional.dgadr.gov.pt/images/prod_imagens/queijos/docs/CE_Queijo_Serra_Estrela_2022.pdf)
- The certification mark is a serial-numbered hologram produced by Imprensa Nacional-Casa da Moeda (INCM). — [DN](https://www.dn.pt/arquivo/diario-de-noticias/certificacao-garante-qualidade-do-queijo-da-serra-3701108.html); [Wikipedia PT](https://pt.wikipedia.org/wiki/Queijo_Serra_da_Estrela)

### Inferences
- The IVDP conta corrente and the IVV stock declaration are the strongest existing anti-overselling controls: a producer cannot legally sell (bottle and seal) more certified Port than its conta corrente holds. A Fermento batch could be reconciled against them if the producer authorises IVDP to confirm the balance for a given lot or wine type, or provides its annual DAE/IVV declaration and CCQ. This is a "producer-provided certificate" route. A direct data-sharing agreement with IVDP would be novel and is not evidenced.
- These ledgers track volume per wine type or category, not per cask, and not who holds beneficial economic rights. They cannot by themselves show that the same cask was not sold to a private investor off-platform. They do show that total sellable volume is bounded.
- Serial numbers (IVDP seals, Serra da Estrela casein marks and INCM holograms) are best used at redemption: Fermento can record the expected seal or casein-mark range per batch on-chain and require the delivered units to match.
- For cheese, the "batch" ages for months rather than years, and the casein-mark number links milk lot to cheese lot. That makes it a good anchor for a per-wheel token.

### Gaps
- No evidence of a public online lookup for IVDP seal numbers, IVBAM seals, CVRPS seals or Serra da Estrela hologram numbers; consumer verification appears to be physical plus email to the body.
- Exact Port "sales capacity" formula (Art. 35 Estatuto; the traditional "lei do terço" stock-to-sales ratio) was not confirmed from a source in this session.
- IVDP seal and certification fee amounts, IVBAM fee table amounts, CVRPS fees and Kiwa Sativa certification fees were not found.
- How CVRPS and IVBAM keep per-operator stock accounts (whether they have an equivalent of the IVDP conta corrente) was not found in primary sources.
- "Benefício" (Port production authorisation per vineyard): no current source retrieved in this session.

## 2. Excise and customs: Portuguese bonded warehouses and e-DA; UK HMRC model for whisky casks

### Takeaway
In Portugal, wine held in a fiscal warehouse (entreposto fiscal) moves under EMCS e-DA documents. However, small wine producers under CIEC art. 81 are expressly exempt from needing authorised-warehousekeeper status, so many Fermento-type producers will have no excise warehouse record at all. In the UK, the whisky cask model rests on the HMRC-approved bonded warehouse's own stock records: ownership is shown by a delivery order the warehouse acknowledges. Since 3 March 2025 owners no longer register with HMRC (WOWGR owner and duty-rep registration was removed), so the warehousekeeper's record is now the main check.

### Cited Findings
- AT Ofício-circulado 25106/2026: small wine producers under CIEC art. 81 fall outside the "pequeno produtor" special-status certification process because they are already exempt from the obligations other small producers carry, including obtaining authorised-warehousekeeper status and an entreposto fiscal. [PT] — [Portal das Finanças, Ofício-circulado 25106/2026](https://info-aduaneiro.portaldasfinancas.gov.pt/pt/legislacao_aduaneira/oficios_circulados_doclib/Documents/Oficio-circulado-25106-2026.pdf)
- Wine sold while in an entreposto fiscal is VAT-exempt under CIVA art. 15(1)(d), and suppliers with an entreposto issue e-DA for intra-EU shipments. [PT] — [OCC opinion](https://www.occ.pt/index.php/en/node/13221); [AT binding ruling PIV 26874](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/informacoes_vinculativas/despesa/civa/Documents/PIV_26874.pdf)
- EU e-AD process: the consignor submits a draft e-AD before dispatch, and the dispatching Member State validates it. — [EU Customs & Taxation e-learning](https://customs-taxation.learning.europa.eu/mod/resource/view.php?id=6577)
- Gaia "entreposto" history: since 1926 Port exporters were confined to a defined Gaia zone to guarantee genuineness. DL 86/86 ended the rule that all Port for sale had to ship from Gaia cellars. [PT] — [DL 86/86](https://diariodarepublica.pt/dr/detalhe/decreto-lei/86-1986-227450); [DL 436/78 (Régua entreposto)](https://diariodarepublica.pt/dr/detalhe/decreto-lei/436-1978-325291)
- UK: casks in an HMRC-approved bonded warehouse are duty- and VAT-suspended until removed from bond, and duty is triggered on bottling or removal. — [Braeside Bond](https://braesidebond.co.uk/blogs/news/navigating-hmrc-and-bonded-logic); [Decant Index](https://app.decantindex.com/journal/whisky-cask-storage-and-insurance)
- The delivery order instructs the bonded warehouse to recognise a named party as legal owner of a specific cask. Without a valid DO, ownership may be unclear whatever the invoices say. Individuals rarely hold a DO in their own name, so brokers open a warehouse account for them or use a bailment contract. (Broker sources, marketing-adjacent.) — [whiskyinvestments.com](https://whiskyinvestments.com/storage-and-ownership/); [Vintage Acquisitions](https://vintageacquisitions.com/whisky-cask-ownership/)
- From 3 March 2025 HMRC removed the requirement for owners of warehoused goods and duty representatives to register (WOWGR owner layer). Only warehousekeeper provisions remain, the 72-hour storage rule went too, and warrants W1, W5, W5D, W6 and W6D were affected. — [DLA Piper, 3 Mar 2025](https://www.dlapiper.com/en/insights/topics/whisky-law-insights/2024/wowgr-reform-will-removal-of-owner-registration-requirements-open-up-the-industry); [Mark Littler](https://www.marklittler.com/how-will-wowgr-change-in-2025/); [RPC customs update Feb 2025](https://rpclegal.com/thinking/tax-take/customs-and-excise-quarterly-update-february-2025)
- Overseas owners who used a duty representative for casks bought before March 2025 were advised to make sure the casks are recorded in their own name at the warehouse. — [Mark Littler](https://www.marklittler.com/how-will-wowgr-change-in-2025/)
- Whisky casks are not FCA-regulated and not FSCS-covered. — [comparealternativeinvestments.com](https://comparealternativeinvestments.com/blog/whisky-investment-uk); [Brodies](https://brodies.com/insights/food-and-drink/what-you-need-to-know-about-investing-in-a-scotch-whisky-cask/)

### Inferences
- The anti-double-sale strength of the UK model comes from a single independent registrar, the bonded warehousekeeper, who holds the physical cask and keeps one owner field per cask number. Fermento could copy this by requiring a third-party custodian to sign each batch's ownership attestation (for example, a custodian key co-signing the Soroban record). It cannot get the same from producer self-storage.
- Because Portuguese small producers are often exempt from entreposto status, EMCS/e-DA data will not exist for many pilot producers. Where a producer or a Gaia shipper does run an entreposto fiscal, the AT-validated e-DA history is a strong independent record of movements out of bond, but it is not public. Access would come only as producer-provided copies.

### Gaps
- No source found on whether AT exposes EMCS/e-DA data to third parties (no public API is known), or on per-cask granularity in Portuguese entreposto stock records.
- No official HMRC page was retrieved in this session (HMRC Excise Notice 196/197 text not confirmed). The UK facts above rest on law-firm and broker commentary.
- No source found on commercial third-party entreposto fiscal operators in Portugal that store wine for small producers on a fee basis (see section 4).

## 3. EU digital labelling (wine e-label) and Digital Product Passport

### Takeaway
Since 8 Dec 2023, EU wine must show ingredients and nutrition, with the full list allowed via QR/e-label. That label is a consumer information page, deliberately non-marketing, and not a provenance or custody record. The ESPR Digital Product Passport excludes food and feed, so no mandatory DPP is coming for wine, cheese or ham under ESPR. Any batch passport Fermento builds will be voluntary, possibly using GS1 Digital Link conventions.

### Cited Findings
- From 8 Dec 2023, wine sold in the EU must give ingredient and nutrition information (Reg. 2021/2117 amending Reg. 1308/2013 art. 119). Allergens must be on the physical label, while ingredients and nutrition may be given electronically (QR). Wine produced before 8 Dec 2023 may be sold until stocks run out. — [Scantrust](https://www.scantrust.com/eu-wine-label-requirements-2021-2117/); [Cyprus Chamber of Commerce summary](https://ccci.org.cy/?p=29897)
- The QR destination must list ingredients/nutrition without sales or marketing content and without collecting user data. — [Cyprus Chamber summary](https://ccci.org.cy/?p=29897)
- ESPR (Reg. 2024/1781) art. 1(2) excludes food and feed (as well as medicinal products, living organisms, vehicles) from scope. — [Irish DETE ESPR presentation](https://dbei.gov.ie:443/en/publications/publication-files/presentation-ecodesign-for-sustainable-products-regulation.pdf); [GS1 DPP provisional application standard](https://gs1.eu/wp-content/uploads/2025/07/dpp_provisional_application_standard.pdf)
- GS1 has issued a provisional DPP application standard (2025; GSCN 26-266 v2 in 2026). — [GS1 GSCN-26-266](https://ref.gs1.org/standards/genspecs/gscn/2026/GSCN-26-266-dpp-provisional-v2.pdf)

### Inferences
- The wine e-label rules forbid marketing and tracking on the ingredients page, so a Fermento provenance or ownership page should be a separate QR or link (or NFC, which the app already experiments with). It should not be merged into the regulatory e-label page.
- A voluntary DPP-style record built on GS1 Digital Link identifiers would let the same unit identifier serve the e-label, the IVDP seal number and Fermento's on-chain token.

### Gaps
- Primary EUR-Lex text for 2021/2117 and ESPR art. 1(2) was not fetched; I relied on summaries. No EU initiative was found to extend DPP to food or drink.

## 4. Independent custody: bonded warehouses and "warehouse confirms ownership"

### Takeaway
The UK fine-wine and whisky market relies on large independent bonded warehouses (London City Bond/Vinothèque, Octavian, distillery or independent cask warehouses) that hold accounts per owner. Best practice is the buyer's own account, or a merchant that runs regular audited stock checks. The Nant (Tasmania) case shows what happens without independent custody: casks were sold several times over. No Portuguese equivalent offering third-party, owner-account custody to small producers was found. Port's historical Gaia entreposto is a geographic regime, not a custody service.

### Cited Findings
- London City Bond (Vinothèque, Burton-upon-Trent) and Octavian are the two largest UK bonded wine warehouses. LCB has more than 8,000 private accounts and Octavian about 1,800. Decanter advises opening your own bond account for "greater security and independence" and monitoring movements. A merchant interviewee advises using only firms that do "regular audited stock checks". — [Decanter, "Mayfair Cellars: is your wine safe?"](https://www.decanter.com/features/mayfair-cellars-is-your-wine-safe-247713/)
- Whisky ownership is confirmed by the warehouse storing the cask, usually via a delivery order. Advisers recommend a unique cask number tied to an HMRC-bonded warehouse. — [Food Manufacture, Mar 2025](https://www.foodmanufacture.co.uk/Article/2025/03/21/the-risks-and-safeguards-in-whisky-cask-investment); [MFMac](https://www.mfmac.com/insights/food-drink/on-the-rocks-legal-safeguards-and-risks-in-whisky-cask-investment/)
- Nant Whisky (Tasmania) sold the same barrels several times over, and the fraud came to light in an audit by new owners in 2017. — [Mark Littler, "Learning from whisky scams"](https://www.marklittler.com/learning-from-whisky-scams/); [Angel Investors Network](https://angelinvestorsnetwork.com/alternative-investments/whiskey-cask-investing-risk-guide)
- Industry commentators warn of reputational damage to Scotch from cask-investment scams. — [The Scotsman](https://www.scotsman.com/news/opinion/columnists/why-scotch-whisky-industry-faces-catastrophic-reputational-damage-5392653)
- Vendor attempts at cask ID exist (e.g. CaskID). Treat these as marketing. — [CaskID LinkedIn](https://linkedin.com/company/caskid)

### Inferences
- For Portuguese fortified wine, the realistic "independent custody" options are: (a) wine that stays at the producer, with IVDP/IVBAM/CVR stock accounts acting as a regulator-side ceiling plus Fermento-commissioned audits; (b) moving batches to a Gaia shipper or another licensed operator's entreposto under a bailment contract, with that operator attesting (the closest analogue to a UK delivery order); (c) tamper-evident sealing of casks (numbered seals or NFC on bungs) with periodic third-party inspection.
- For cheese (months of ageing) and cured ham (12-36+ months), independent custody would mean a third-party ageing room or affineur, or certification-body inspection records. No such commercial service was found in this research.

### Gaps
- No Portuguese commercial bonded wine storage with private owner accounts (an LCB/Octavian equivalent) was found. Not confirmed whether Gaia shippers rent cask space to third parties under bailment.
- Fees for UK bonded storage per cask or per case per year were not retrieved.

## 5. Audits and lab testing: inspection, regauging, analysis, authentication methods, costs and Portuguese labs

### Takeaway
Routine chemistry (ABV, sugar, volatile acidity) is cheap and widely available at accredited labs. IVDP has an ISO/IEC 17025 lab and IVBAM an EU-designated official lab. Lab chemistry, though, verifies identity and quality of a sample, not volume. Volume needs physical dipping or regauging by an independent inspector. Isotope methods (SNIF-NMR, IRMS) detect added sugar or water and origin fraud. Radiocarbon dates whisky to within 2-3 years for post-1950s spirit. DNA PCR detects cow milk in sheep cheese, and University of Minho has work specific to Serra da Estrela. A practical anti-swap protocol is to take a reference "fingerprint" sample at listing and compare it at redemption.

### Cited Findings
- IVDP's laboratory in Porto is accredited to ISO/IEC 17025:2018 (IPAC annex L0115-1). IVDP publishes a flexible-scope list of accredited tests using OIV methods (Ed. 12, Apr 2024). — [IVDP accreditation annex 2022](https://www.ivdp.pt/pt/docs/acreditacoes/L0115A1(2022-11-30).pdf); [IVDP accredited test list Ed12](https://www.ivdp.pt/pt/docs/acreditacoes/ListaEnsaiosAcreditFlex%C3%ADvel_Interm_LAB_Ed12_24-04-2024.pdf)
- IVBAM lab and tasting-panel fees are set by a 2023 regional portaria (amounts not extracted). — [JORAM 13 Apr 2023](https://joram.madeira.gov.pt/joram/1serie/Ano%20de%202023/ISerie-070-2023-04-13sup2.pdf)
- SNIF-NMR (deuterium site-specific NMR) was adopted by the EU around 1990 and recognised by the OIV. It is described as the only NMR method that is an official standard, with IRMS complementary for geographic origin and added water or sugar. — [FIRMS 2019 abstract (FEM)](https://openpub.fmach.it/retrieve/handle/10449/58773/97871/Book%20of%20abstract_FIRMS2019_Solovyev.pdf)
- The EU wine isotope databank was originally established by Reg. 2348/91, which has been repealed and superseded, and the databank continues under later rules. A 2015 review covers 25 years of EU wine isotope authentication. — [EUR-Lex 2348/91](https://eur-lex.europa.eu/eli/reg/1991/2348/oj); [BIO Web of Conferences 2015 (DOAJ)](https://doaj.org/article/51d30ee702fe40e78cbdfb81c8cf366c)
- Commercial SNIF-NMR/IRMS testing is offered by Eurofins (no public prices). — [Eurofins SNIF-NMR & IRMS](https://www.eurofins.com/cs-cz/testovani-potravin-a-krmiv/sluzby/autenticita/analyza-snif-nmr-a-irms/)
- A 2023 OIV-conference study compared EIM-IRMS and CS-qNMR and reported a 52.4% detection rate on adulterated samples, so isotope methods are not infallible. — [BIO Web of Conferences 2023](https://www.bio-conferences.org/articles/bioconf/pdf/2023/01/bioconf_oiv2022_02017.pdf)
- SNIF-NMR requires expensive instruments (qualitative statement, no price). — [USPTO patent 9005979](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9005979)
- Radiocarbon whisky dating (SUERC, University of Glasgow) takes a small sample through the cork, distils out the alcohol and reads it against a calibration curve built from distiller-supplied whiskies of known age. Post-1950s spirit dates to within 2-3 years. A 2018 study of 55 "vintage" bottles found 21 fake or not distilled in the stated year. SUERC partnered with Everledger (NFC tamper label plus digital record). — [University of Glasgow / SUERC](https://www.gla.ac.uk/research/az/suerc/news/headline_768202_en.html); [Decanter](https://www.decanter.com/wine-news/fake-whisky-rare-scotch-study-406438/); [Scottish Legal News](https://www.scottishlegal.com/articles/dram-it-third-of-vintage-scotch-whisky-fake)
- Serra da Estrela cheese: University of Minho developed RAPD-PCR/SCAR markers to trace the breed of origin (e.g. distinguishing milk from the Mocha breed), and mitochondrial D-loop PCR to detect cow milk mixed into Serra da Estrela sheep milk. — [UMinho repository 1822/42091](https://repositorium.uminho.pt/handle/1822/42091); [UMinho 1822/75157 (Montenegro-Silva et al.)](https://repositorium.sdum.uminho.pt/bitstream/1822/75157/1/document_55092_1.pdf)
- Analogous PDO-cheese methods: HRM on mtDNA detects bovine milk down to 0.1% in feta. Triplex PCR identifies cow, goat or sheep milk in halloumi. ddPCR quantifies cow DNA in buffalo mozzarella. — [Surrey](https://openresearch.surrey.ac.uk/esploro/outputs/journalArticle/A-novel-closed-tube-method-based-on/99515659902346); [J. Dairy Research (Cambridge)](https://www.cambridge.org/core/product/EE581DA82881B72D616F55A0ECCF94B5/core-reader); [PMC8146313](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8146313/)

### Inferences
- **Anti-swap and dilution protocol:** at listing, an independent sampler draws and seals reference samples from each cask. An accredited lab (IVDP/IVBAM/university) runs a routine panel (ABV, total sugars, volatile acidity, total acidity, density), optionally with a spectroscopic fingerprint (FTIR/NIR) or isotope ratios. The results hash goes on-chain. At redemption or periodic audit, a re-sample is compared against it. Dilution shows up as ABV or density drift beyond the expected ageing trend. Swapping in younger or cheaper wine shows up in chemistry and colour, and for whisky in radiocarbon.
- **Volume:** no lab method verifies quantity. Physical dipping or regauging by an independent inspector, reconciled with expected evaporation ("angels' share") and with the regulator stock declaration, is the only route found.
- Expected-age claims for Port/Madeira tawny-style blends are style designations approved by a tasting panel, not minimum ages. Fermento should present them that way and not as a verifiable average age.

### Gaps
- No per-sample prices were found for routine wine chemistry, SNIF-NMR/IRMS, radiocarbon (SUERC) or PCR milk-species tests. Quotes would have to come from IVDP lab, IVBAM, Eurofins, SUERC and UMinho/other Portuguese labs.
- No source found on independent cask-gauging or inventory inspection services in Portugal, or on ASAE's role in sampling ageing stock.
- No isotope or other origin method specific to Portuguese cured ham (presunto) was researched.

## 6. Insurance for cellar stock and whether insurers require independent inventory confirmation

### Takeaway
Evidence is thin. Insurance covers physical loss or damage and does not prove ownership. For high-value casks, buyers are told to check that the warehouse's policy covers the cask's value. No source was found showing that Portuguese insurers require independent inventory confirmation for cellar stock.

### Cited Findings
- Insurance typically covers physical risks (damage, loss) and does not prove that the ownership record is accurate. Owners of premium casks should confirm that the warehouse insurance is enough to cover the cask's value. — [Food Manufacture, Mar 2025](https://www.foodmanufacture.co.uk/Article/2025/03/21/the-risks-and-safeguards-in-whisky-cask-investment); [Decant Index](https://app.decantindex.com/journal/whisky-cask-storage-and-insurance)

### Inferences
- An insurer's stock schedule or loss-adjuster inventory, if a producer has one, is another document a producer could provide. But it is only as good as the producer's declaration unless the insurer audited it.

### Gaps
- No Portuguese insurer product terms for wine or cheese cellar stock were found, and nothing on stock-valuation basis or audit requirements. No premium rates were found.
