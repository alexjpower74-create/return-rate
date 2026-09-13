# Return Rate — the refund rules (Newfoundland and Labrador)

Researched 2026-09-13 from the primary sources. `worker/src/rules.js` implements THIS file; the tests quote it. If a case isn't covered here, the answer is **unknown**, never a guess.

## What the app is for (Alexander, 2026-09-13)
**The headline answer is whether the depot ACCEPTS the container: "Yes, we take this" / "No, we don't take this" / "Check the label" (with the exact words to look for).** One simple app for customers and staff alike: scan, read the answer. No passwords, no set-up, no back end anyone has to operate. The cents are shown smaller, underneath. Getting accepted-or-not right matters more than 5¢ vs 10¢.

## Sources
0. Alexander (APCO Recycling owner), 2026-09-13: depot policy on local refillable and Quidi Vidi Iceberg bottles.
1. Waste Management Regulations, 2003 (NLR 59/03) under the Environmental Protection Act, ss. 12, 14, 18: https://www.assembly.nl.ca/legislation/sr/regulations/rc030059.htm
2. MMSB Beverage Distributor Guide (April 2025), sections 5 ("Deposit-Bearing Beverage Containers", the chart) and 6 ("Not Included"), Appendices A and B: https://mmsb.nl.ca/wp-content/uploads/2025/04/BeverageDistributorsGuide.pdf
3. MMSB, Used Beverage Containers program page and FAQ "What's accepted / not accepted": https://mmsb.nl.ca/programs/used-beverage-containers/ , https://mmsb.nl.ca/faq-type/whats-accepted-not-accepted/
5. Liquor Corporation Act definitions of "beer" and "alcoholic liquor" (as consolidated in CNR 1162/96): https://www.assembly.nl.ca/legislation/sr/annualregs/CNR1996/Cr961162.htm
4. NLC FAQ on empties (domestic beer bottles go to Brewer's Agents, $1.20/dozen; everything else to a Green Depot): https://nlliquor.com/faq/

## What a "beverage container" is (reg. s.12, Guide p.2)
A container that held a **ready-to-serve beverage**, delivered **sealed** to a retailer, made of glass, steel, aluminum, plastic, aseptic packaging (tetra/gable) or other recyclable material, **5 litres or less**, **non-refillable**.
"Beverage" = soft drinks (carbonated or not), bottled water (still or sparkling), fruit juice or fruit drink, vegetable juice, beer, alcoholic liquor. **Not** a beverage: milk, infant formula, medicinal nutritional supplements for special dietary needs.

The rule of thumb Alexander gave: **if a deposit was charged at the till, the depot pays a refund**, but only on a beverage container as defined above.

## Which document wins
The Guide's own disclaimer: its contents "do not supersede the authority of the Newfoundland and Labrador Waste Management Regulations; in the event of any discrepancy, the regulations will prevail." The regulation (s.18(1)) says every container that held alcoholic liquor refunds $0.10, with no material distinction. MMSB's chart nonetheless charges 8¢ and refunds 5¢ on liquor in cans, pouches and bag-in-box, and depots are paid by MMSB on that schedule. **APCO confirmed 2026-09-13: cans of wine and canned cocktails are 5¢, same as any can; bag-in-box and pouches 5¢; tetra/carton wine 5¢. Only glass or PET bottles of liquor are 10¢.** Sources are archived in `docs/sources/` (the Guide PDF, its text, and the appendix pages as images).

## History and amounts
Deposits 8¢ (non-alcoholic) and 20¢ (alcoholic liquor) with refunds 5¢ and 10¢ since **July 1, 2001** (Government of NL release, 12 March 2001; before that 6¢/3¢). Unchanged since. The 3¢ / 10¢ difference funds the program (MMSB FAQ). HST applies to deposits at the till, not to refunds.

## The label test a customer can do
Every deposit-bearing container sold in NL **must carry a return-for-refund message** ("Return for Refund", "Refundable", "Return for refund where applicable") plus the recycling symbol or the word "Recyclable", visible on the empty container (Guide s.5). So: **if the label says Return for Refund and you bought it in NL, a deposit was charged and the depot refunds it.** Exempt products carry no such message ("There is no deposit applied upon purchase to non-program materials", MMSB program page). The app tells the customer to look for those words when it cannot know the item.

## Only Newfoundland and Labrador purchases
"Only beverages purchased in Newfoundland & Labrador can be accepted for refund at Green Depots" (MMSB program page). A barcode cannot tell where a container was bought, so every answer carries "if you bought it in NL".

## The refund depends on BOTH the drink and the container (Guide s.5 chart, verbatim)

| Container | Drink | Deposit | **Refund** |
|---|---|---|---|
| Aluminum can | non-alcoholic | 8¢ | **5¢** |
| Aluminum can | beer | 8¢ | **5¢** |
| Aluminum can | wine and spirits (incl. coolers, ciders, canned cocktails) | 8¢ | **5¢** |
| Other metal (steel) | non-alcoholic; beer (non-refillable) | 8¢ | **5¢** |
| Clear plastic | non-alcoholic | 8¢ | **5¢** |
| Clear plastic | 50 mL miniature liquor | 8¢ | **5¢** |
| Clear plastic | wine and spirits | 20¢ | **10¢** |
| Other plastic | non-alcoholic | 8¢ | **5¢** |
| Other plastic | 50 mL miniature liquor | 8¢ | **5¢** |
| Other plastic | wine and spirits | 20¢ | **10¢** |
| Glass | non-alcoholic | 8¢ | **5¢** |
| Glass | beer (non-refillable, i.e. imported / not a local brewer's refillable) | 8¢ | **5¢** |
| Glass | 50 mL miniature liquor | 8¢ | **5¢** |
| Glass | wine and spirits (incl. coolers and ciders in glass) | 20¢ | **10¢** |
| Tetra / gable top | non-alcoholic | 8¢ | **5¢** |
| Tetra / gable top | wine and spirits | 20¢ per the 2025 Guide, 8¢ per MMSB's website | **5¢** (APCO pays 5¢; Alexander 2026-09-13) |
| Pouch | non-alcoholic | 8¢ | **5¢** |
| Pouch | wine and spirits | 8¢ | **5¢** |
| Bag-in-a-box | wine and spirits | 8¢ | **5¢** |

So: **10¢ only for wine and spirits in glass bottles or plastic (PET) bottles over 50 mL. Everything else that is refundable is 5¢** (Alexander confirmed APCO's counter practice 2026-09-13: cans of wine and canned cocktails are 5¢ like any can; bag-in-box and pouches are 5¢; tetra-pak and carton wine are 5¢). Everything else that is refundable is **5¢**. A 750 mL pop bottle is 5¢; a 200 mL rum bottle is 10¢; a 50 mL rum miniature is 5¢; a can of wine or a canned cocktail is 5¢; a bag-in-box wine is 5¢ for the whole box (the bag/box is the container).

## Not refundable at a Green Depot (Guide s.6, Appendix B; MMSB FAQ)
- **Milk**, goat's milk, flavoured milk (Food and Drug Regs B.08.003/004/005/016, B.08.028.1).
- **Fortified plant-based beverages** (soy, almond, oat, etc., B.01.500) that are labelled as milk alternatives. **Exception:** a plant-based beverage labelled *fortified plant-based beverage* AND *not a source of protein* IS refundable (Guide Appendix A).
- **Infant formula** (B.25.045).
- **Meal replacements** and **formulated liquid diets** (B.24.100 / B.24.200): anything with the words "Meal Replacement" or "Formulated Liquid Diet" on the label (Ensure, Boost and the like). (MMSB refunds these only to a consumer with a physician's prescription, at MMSB, not at the depot.)
- **Concentrated beverages** (frozen juice, syrups, cordials, drink mixes) and **premixed fountain** containers.
- **Distilled water** (MMSB program page lists it; it is not a "beverage" for the program).
- **Containers over 5 litres** (water cooler jugs, kegs).
- **Refillable containers in a local distributor program**: local brewers' refillable beer bottles (Labatt, Molson, Quidi Vidi and other NL brewers). They go to a Brewer's Agent for $1.20/dozen, not to MMSB. *Some depots take them voluntarily; APCO's policy is the depot's own, so the app says "ask at the counter" for these, never a cents figure.*
- **Bought outside Newfoundland and Labrador**: no NL deposit was paid, so no refund.
- Unsealed cups, plastic and foam cups, anything sold for on-site consumption.

## Beer, precisely
- **Beer cans** (any brand, domestic or imported): **5¢** at the depot.
- **Imported beer bottles** (non-refillable glass): **5¢** at the depot.
- **Local brewers' refillable bottles**: not MMSB; Brewer's Agent, $1.20/dozen. The app answers "Refillable local beer bottle: take it back to the beer store or ask at the counter."

## What the label says decides it (Guide Appendix A and B, product by product)
MMSB rules by the words on the label, aligned to the Canadian Food and Drug Regulations, not by what the drink "is":
- **DEPOSIT (refundable):** *Milk2Go Sport* "milk protein shake" (not labelled as Milk); *Nesquik* "flavoured milk beverage" carton (not labelled as Milk); *Pedialyte* oral rehydration (not labelled formulated liquid diet or infant formula); *Earth's Own Almond SoFresh* and *Great Value Almond Drink* labelled "fortified almond beverage, **not a source of protein**".
- **NO DEPOSIT:** *Central Dairies* 2%, skim and **chocolate milk**, *Grand Pré* milk (labelled "Milk" under B.08.003/004/005/016; flavoured milk that is labelled Milk counts as milk); *Silk* and *Natura* "fortified soy beverage" (B.01.500, a source of protein); *Carnation Breakfast Essentials* with "Meal Replacement" on the label (B.24.200).
So: a protein shake or "milk beverage" that is NOT labelled as Milk → 5¢; anything labelled Milk, or a fortified plant beverage that is a source of protein, or "Meal Replacement" / "Formulated Liquid Diet" → no refund. When the label is the deciding fact and the app cannot see it, the answer is **unknown / ask at the counter**, never a guess.

## Alcohol words, precisely (Liquor Corporation Act definitions, used by the regulation)
- **"beer"** = an alcoholic beverage from fermenting barley, malt and hops in water. That is beer, ale, lager, stout, porter. **Not** beer: ciders, coolers, hard seltzers, malt-based "teas" and "lemonades" (Twisted Tea, Mike's, Smirnoff Ice, White Claw), canned cocktails, wine, spirits, sake, mead. Those are **alcoholic liquor** for the refund, so: glass/plastic/tetra → 10¢, can/pouch/bag-in-box → 5¢, 50 mL miniature → 5¢.
- **"alcoholic liquor"** = 3% alcohol by volume and up, other than beer. So **non-alcoholic beer** (0.5%) and **de-alcoholised wine** are ordinary non-alcoholic beverages: 5¢ in any container, including glass. **Hard kombucha** at 3%+ is liquor; ordinary kombucha is 5¢.
- The regulation itself (s.14, s.18) says 20¢/10¢ for any container that held alcoholic liquor; MMSB's 2025 chart narrows the 20¢/10¢ to plastic, glass and tetra/gable and puts liquor in cans, pouches and bag-in-box at 8¢/5¢. **The depot pays by MMSB's chart**, because that is what the distributor charged at the till.

## What a depot may refuse (regulation s.18(2), verbatim)
"A depot operator shall not refuse to accept a beverage container for refund, except where (a) the beverage container is crushed, broken or contaminated; (b) the beverage container has no labelling which identifies what it contained; or (c) the beverage container was rejected or discarded by the manufacturer during the manufacturing process."
So the app tells the customer: a crushed can, a broken bottle, a dirty container or one with no label may be refused at the counter even if the product is refundable.

## APCO's own policy (Alexander, 2026-09-13), shown as APCO's, not MMSB's
- **Local brewers' refillable beer bottles** (Labatt, Molson, Quidi Vidi and other NL brewers): MMSB does not cover them and some depots refuse them; **APCO takes them and pays 5¢**. The app says: "Not part of the MMSB program. APCO Recycling takes these and pays 5¢; some other depots don't."
- **Quidi Vidi Iceberg blue bottles**: same: **APCO takes them at 5¢**; some depots don't. Same sentence, naming the bottle.
- Class `brewer` therefore returns `refund_cents: 5` with `depot_policy: true` and that sentence. If this app is ever used at another depot, `brewer` must be re-decided per depot; never present it as a provincial rule.

## Condition rules the app repeats (MMSB FAQ)
Empty it. Caps, straws and garbage off. **Labels on** (staff must identify the product). **Don't crush or flatten** (identification, bag weight limits, baling). Glass not broken. The counter's count is the one that pays.

## The classifier `classify(input)` → `{ class, refund_cents, why }`
Input: `{ drink, material, size_ml, refillable, alcohol_pct, label_flags }` where
- `drink` ∈ `soft-drink | water | sparkling-water | juice | vegetable-juice | sports | electrolyte | energy | tea | coffee | kombucha | protein-shake | flavoured-milk-beverage | na-beer | beer | cider | cooler | seltzer | malt-beverage | cocktail | wine | spirits | sake | mead | hard-kombucha | milk | plant-milk | plant-drink-not-protein | infant-formula | meal-replacement | formulated-liquid-diet | concentrate | distilled-water | unknown` (`milk` = labelled Milk incl. chocolate milk; `flavoured-milk-beverage` and `protein-shake` = NOT labelled Milk)
- `material` ∈ `aluminum | steel | clear-plastic | other-plastic | glass | tetra | gable | pouch | bag-in-box | unknown`
Output classes: `regular` (5¢), `liquor` (10¢), `none` (0¢, with the reason), `brewer` (local refillable beer bottle incl. Quidi Vidi Iceberg blue: not MMSB; **at APCO 5¢**, flagged `depot_policy: true`, wording says some depots don't take them), `unknown` (never shown as an answer).

Order of decisions (first match wins):
1. `size_ml > 5000` → none ("over 5 litres").
2. `refillable && drink === 'beer'` (incl. Quidi Vidi Iceberg blue) → brewer (5¢ at APCO, depot policy). Any other `refillable` → none.
3. drink ∈ {milk, plant-milk, infant-formula, meal-replacement, formulated-liquid-diet, concentrate, distilled-water} → none (with the reason). `plant-drink-not-protein` → continues as regular.
4. drink === 'unknown' or material === 'unknown' where it matters (see 6) → unknown.
5. drink ∈ {beer} → regular (5¢) regardless of material. `na-beer` → regular.
6. drink ∈ {wine, spirits, sake, mead, cider, cooler, seltzer, malt-beverage, cocktail, hard-kombucha} (alcoholic liquor other than beer):
   - `size_ml <= 50` → regular (5¢, miniature).
   - material ∈ {clear-plastic, other-plastic, glass} → liquor (10¢).
   - material ∈ {tetra, gable} → regular (5¢) (APCO practice, confirmed 2026-09-13).
   - material ∈ {aluminum, steel, pouch, bag-in-box} → regular (5¢).
   - material unknown → unknown.
7. Everything else in the "beverage" list (soft drinks, water, sparkling water, juices, sports, electrolyte, energy, tea, coffee, kombucha, protein-shake, flavoured-milk-beverage, plant-drink-not-protein) → regular (5¢), any material, any size ≤ 5 L.

`why` is one plain sentence a customer can read; `depot_policy: true` marks answers that are APCO's policy rather than MMSB's, e.g. "Wine in a glass bottle: 10¢." / "Milk has no deposit, so there's no refund." / "A local brewer's refillable bottle goes back to the beer store; ask at the counter."

## Open questions for Alexander (the app says "ask at the counter" until answered)
- Kombucha and "hard kombucha" (alcoholic): treated as regular / liquor by the rules above; confirm the depot sees them that way.

## Three ways the app knows, in order
1. **The exact barcode is in the list** (built from public product data, gated by the rules below).
2. **The maker's barcode prefix** (`data/prefixes.json`): the first six digits of a UPC belong to one company. For makers that sell nothing but ready-to-serve non-alcoholic drinks in NL (Coca-Cola, PepsiCo, Monster, Red Bull, Tropicana, Lassonde, Ocean Spray, Keurig Dr Pepper, …) every container up to 5 L is 5¢ whatever it is made of, so the maker alone answers. Mixed makers (Costco Kirkland, Loblaw PC) are listed but DISABLED because they also sell milk, plant milks and formula.
3. **The photo** (now a first-class choice next to the barcode, Alexander 2026-09-13 ~02:30). **Anything the photo shows that is not a beverage container (soy sauce, tablets, cleaning products, food) is an immediate "No, we don't take this".** A beverage that is not milk, a fortified plant milk, formula, a meal replacement, a concentrate, distilled water or over 5 L is a **yes**; the reader is told what is on NL shelves (Big 8, Purity, Black Horse, Central Dairies, …) so it names things right. "Check the label" no longer exists as an answer; the only non-answer is "Try another photo" when the picture is unreadable.
   Reader: Cloudflare Workers AI, Mistral Small 3.1 24B (7/7 on the label set, 3–7 s), OpenAI gpt-5.4-mini only as a fallback. Llama 3.2 Vision needs a licence acceptance and was not used; Moondream could not follow the JSON instructions.
   Original design of the photo step: If neither knows, the person photographs the front label and a vision model reads exactly what MMSB rules on: the kind of drink, the container, the size, and the label words (Milk; fortified plant-based beverage; not a source of protein; Meal Replacement / Formulated Liquid Diet; Return for Refund). The rules engine decides; the model never outputs a verdict or a cents figure; the answer shows what the label said. If the label can't be read, the app says so and gives the Return for Refund test. A readable non-alcoholic drink whose label says Return for Refund is a sure 5¢ even if the container material can't be told, because every such container is 5¢.

## What a barcode can and cannot decide (design rule for the product list)
**There is no staff side, no PIN and no confirming step (Alexander, 2026-09-13): the same app for customers and employees. When the barcode can't decide, the app tells the person exactly what to read on the label, using MMSB's own label rules below.**
MMSB publishes **no product registry**; it rules product by product on request from the label. So a barcode database (built from public product data) may auto-answer **only** where the label cannot change the answer:
- Auto-answer allowed: soft drinks, water (not distilled), sparkling water, juice and juice drinks, vegetable juice, sports and energy drinks, iced tea and coffee drinks that are plainly not milk-labelled, beer, wine, spirits, ciders, coolers, seltzers, canned cocktails, and only when the **container material and size are known**.
- Never auto-answer (the app says "Check the label" and gives the specific test for that kind of product): anything dairy or dairy-looking (milk, chocolate milk, flavoured milk beverages, protein shakes, drinkable yogurt, kefir, eggnog, coffee drinks that say milk), plant-based milks and drinks, nutrition and supplement drinks (Boost, Ensure, Premier Protein, Carnation), infant and toddler drinks, electrolyte solutions, soups and broths, cooking wines and vinegars, any container over 4 L (near the 5 L line), kegs, growlers, crowlers, anything refillable, anything whose material the data does not state.
- Unknown barcode: "We don't have this one on our list yet" plus the Return for Refund label test. Nothing is ever guessed and nobody has to confirm anything.

## Edge products, decided by the rules above (each says which rule)
| Item | Answer | Rule |
|---|---|---|
| 5 L Heineken mini keg (steel, non-refillable, exactly 5 L) | 5¢ | ≤ 5 L, beer, metal |
| 5.16 L or bigger keg; any refillable keg; growler | no refund | over 5 L / refillable |
| Crowler (32 oz can sealed at a brewery) | check the label | "delivered sealed to a retailer" is arguable; label may lack Return for Refund |
| 4 L plastic water jug (non-refillable) | 5¢ | ≤ 5 L, water |
| 18.9 L water cooler bottle | no refund | over 5 L and refillable |
| Distilled water, any size | no refund | MMSB program page |
| Boxed Water / water in a carton | 5¢ | tetra/gable, non-alcoholic |
| Coconut water, aloe drink, kombucha (non-alcoholic) | 5¢ | non-alcoholic beverage |
| Non-alcoholic beer, de-alcoholised wine (< 3%) | 5¢ any container | not "alcoholic liquor" |
| Twisted Tea, Smirnoff Ice, Mike's in **glass** | 10¢ | liquor (not beer), glass |
| White Claw, Nude, canned Caesar, canned wine | 5¢ | liquor in a can |
| 50 mL liquor miniature, glass or plastic | 5¢ | miniature row |
| 200 mL / 375 mL / 750 mL / 1.14 L / 1.75 L spirits, glass or plastic | 10¢ | liquor, glass/plastic |
| 3 L / 4 L bag-in-box wine | 5¢ for the box | bag-in-box row |
| Wine in a pouch | 5¢ | pouch row |
| Sake, mead, ice wine, champagne in glass | 10¢ | liquor, glass |
| Imported beer bottle (Corona, Heineken, Stella) | 5¢ | non-refillable beer |
| Any beer can | 5¢ | aluminum can, beer |
| Local refillable beer bottle (Molson, Labatt, Quidi Vidi, other NL brewers), Quidi Vidi Iceberg blue | APCO 5¢, some depots don't | depot policy, not MMSB |
| Juice box, drink pouch (Capri Sun), Gerber juice | 5¢ | non-alcoholic |
| Frozen juice concentrate, cordial, drink mix, syrup | no refund | concentrate |
| Pedialyte | 5¢ | Guide Appendix A |
| Milk2Go Sport protein shake, Nesquik "flavoured milk beverage" | 5¢ | Guide Appendix A (not labelled Milk) |
| Chocolate milk labelled Milk, Fairlife/Grand Pré/Central Dairies milk | no refund | Guide Appendix B |
| Silk / Natura fortified soy (source of protein) | no refund | Guide Appendix B |
| Almond drink labelled "not a source of protein" | 5¢ | Guide Appendix A |
| Boost, Ensure, Carnation Breakfast Essentials (Meal Replacement on label) | no refund | Guide s.6 |
| Baby formula, toddler formula | no refund | Guide s.6 |
| Bought in Nova Scotia / online from outside NL | no refund | MMSB program page |
| Crushed can, broken bottle, dirty, no label | may be refused | reg. s.18(2) |
