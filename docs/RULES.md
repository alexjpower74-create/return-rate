# Return Rate — the refund rules (Newfoundland and Labrador)

Researched 2026-09-13 from the primary sources. `worker/src/rules.js` implements THIS file; the tests quote it. If a case isn't covered here, the answer is **unknown**, never a guess.

## Sources
1. Waste Management Regulations, 2003 (NLR 59/03) under the Environmental Protection Act, ss. 12, 14, 18: https://www.assembly.nl.ca/legislation/sr/regulations/rc030059.htm
2. MMSB Beverage Distributor Guide (April 2025), sections 5 ("Deposit-Bearing Beverage Containers", the chart) and 6 ("Not Included"), Appendices A and B: https://mmsb.nl.ca/wp-content/uploads/2025/04/BeverageDistributorsGuide.pdf
3. MMSB, Used Beverage Containers program page and FAQ "What's accepted / not accepted": https://mmsb.nl.ca/programs/used-beverage-containers/ , https://mmsb.nl.ca/faq-type/whats-accepted-not-accepted/
4. NLC FAQ on empties (domestic beer bottles go to Brewer's Agents, $1.20/dozen; everything else to a Green Depot): https://nlliquor.com/faq/

## What a "beverage container" is (reg. s.12, Guide p.2)
A container that held a **ready-to-serve beverage**, delivered **sealed** to a retailer, made of glass, steel, aluminum, plastic, aseptic packaging (tetra/gable) or other recyclable material, **5 litres or less**, **non-refillable**.
"Beverage" = soft drinks (carbonated or not), bottled water (still or sparkling), fruit juice or fruit drink, vegetable juice, beer, alcoholic liquor. **Not** a beverage: milk, infant formula, medicinal nutritional supplements for special dietary needs.

The rule of thumb Alexander gave: **if a deposit was charged at the till, the depot pays a refund**, but only on a beverage container as defined above.

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
| Tetra / gable top | wine and spirits | 20¢ | **10¢** |
| Pouch | non-alcoholic | 8¢ | **5¢** |
| Pouch | wine and spirits | 8¢ | **5¢** |
| Bag-in-a-box | wine and spirits | 8¢ | **5¢** |

So: **10¢ only for wine and spirits in plastic, glass or tetra/gable, 50 mL miniatures excluded.** Everything else that is refundable is **5¢**. A 750 mL pop bottle is 5¢; a 200 mL rum bottle is 10¢; a 50 mL rum miniature is 5¢; a can of wine or a canned cocktail is 5¢; a bag-in-box wine is 5¢ for the whole box (the bag/box is the container).

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

## Condition rules the app repeats (MMSB FAQ)
Empty it. Caps, straws and garbage off. **Labels on** (staff must identify the product). **Don't crush or flatten** (identification, bag weight limits, baling). Glass not broken. The counter's count is the one that pays.

## The classifier `classify(input)` → `{ class, refund_cents, why }`
Input: `{ drink, material, size_ml, refillable, alcohol_pct, label_flags }` where
- `drink` ∈ `soft-drink | water | sparkling-water | juice | vegetable-juice | sports | energy | tea | coffee | kombucha | beer | cider | cooler | wine | spirits | sake | milk | plant-milk | plant-drink-not-protein | infant-formula | meal-replacement | formulated-liquid-diet | concentrate | distilled-water | unknown`
- `material` ∈ `aluminum | steel | clear-plastic | other-plastic | glass | tetra | gable | pouch | bag-in-box | unknown`
Output classes: `regular` (5¢), `liquor` (10¢), `none` (0¢, with the reason), `brewer` (refillable local beer, not MMSB, "ask at the counter"), `unknown` (never shown as an answer).

Order of decisions (first match wins):
1. `size_ml > 5000` → none ("over 5 litres").
2. `refillable && drink === 'beer'` → brewer. Any other `refillable` → none.
3. drink ∈ {milk, plant-milk, infant-formula, meal-replacement, formulated-liquid-diet, concentrate, distilled-water} → none (with the reason). `plant-drink-not-protein` → continues as regular.
4. drink === 'unknown' or material === 'unknown' where it matters (see 6) → unknown.
5. drink ∈ {beer} → regular (5¢) regardless of material.
6. drink ∈ {wine, spirits, sake, cider, cooler} (alcoholic liquor other than beer):
   - `size_ml <= 50` → regular (5¢, miniature).
   - material ∈ {clear-plastic, other-plastic, glass, tetra, gable} → liquor (10¢).
   - material ∈ {aluminum, steel, pouch, bag-in-box} → regular (5¢).
   - material unknown → unknown.
7. Everything else in the "beverage" list (soft drinks, water, sparkling water, juices, sports, energy, tea, coffee, kombucha, plant-drink-not-protein) → regular (5¢), any material, any size ≤ 5 L.

`why` is one plain sentence a customer can read, e.g. "Wine in a glass bottle: 10¢." / "Milk has no deposit, so there's no refund." / "A local brewer's refillable bottle goes back to the beer store; ask at the counter."

## Open questions for Alexander (the app says "ask at the counter" until answered)
- Does APCO take local refillable beer bottles voluntarily, and at what amount?
- Kombucha and "hard kombucha" (alcoholic): treated as regular / liquor by the rules above; confirm the depot sees them that way.
- Tetra-pak wine: the 2025 Guide chart says 10¢; MMSB's web summary once read 5¢. The Guide is the newer, signed document, so 10¢, but confirm with a real carton at the counter.
