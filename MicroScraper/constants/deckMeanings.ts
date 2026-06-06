export type DeckRow =
  | { type: 'section'; title: string }
  | { type: 'entry'; deck: string; definition: string };

export const DECK_ROWS: DeckRow[] = [
  { type: 'section', title: 'Primary Assortment' },
  { type: 'entry', deck: 'A Deck', definition: 'Top selling items equaling 10% of the merchandise assortment which produces 65% of units and dollars sold. 100 SKU cap per assortment, excluding Box. Forecasting owned by Merchandising.' },
  { type: 'entry', deck: 'B Deck', definition: 'Secondary items equaling 10% of the merchandise assortment that produces 15% of units and dollars sold. 200 SKU cap per assortment, excluding Box. Forecasting owned by Merchandising.' },
  { type: 'entry', deck: 'C Deck', definition: 'Remaining SKUs that would have been on A and B Deck, along with other focus SKUs. Forecasting owned by Purchasing.' },
  { type: 'entry', deck: 'D Deck', definition: 'Filler items equaling 30% of the merchandise assortment that produces 20% of units and dollars sold. Forecasting owned by Purchasing.' },
  { type: 'section', title: 'Discontinued Product Decks' },
  { type: 'entry', deck: 'Z Deck', definition: 'Discontinued items to be sold through. These SKUs will be marked down 20% if sell-through is less than 10% of average sales for the prior 4 weeks in selling locations.' },
  { type: 'entry', deck: 'N Deck', definition: 'SKU\'s currently being worked by Purchasing to be returned to the vendor or for vendor markdown support. Also includes SKUs that Micro Center has decided to discontinue or sell down but are still active with the vendor.' },
  { type: 'entry', deck: 'M Deck', definition: 'Discontinued items that cannot be returned to the vendor. These SKUs are currently in the progressive markdown process according to the area.' },
  { type: 'entry', deck: 'Y Deck', definition: 'Discontinued items authorized for vendor return are moved to Y Deck. All Y Deck ranked items are to be returned to 005 from stores.' },
  { type: 'entry', deck: 'K Deck', definition: 'Discontinued items with no inventory in any location and no activity in the last 6 months are moved to K Deck. These SKUs should be deleted in the next SKU purge. Ad embargo/street-dated SKUs also appear as K Deck SKUs in stores until the embargo/street date is reached.' },
  { type: 'section', title: 'Test, Evaluation and Future Product Decks' },
  { type: 'entry', deck: 'E Deck', definition: 'The POS will not allow E rank items to be sold. Contains Demo SKUs, Dummy SKUs, Build Parts, and Recalled Items.' },
  { type: 'entry', deck: 'F Deck', definition: 'One-time buy/special-buy SKUs are placed on F Deck while product sells through. Products selling less than 10% of inventory should be evaluated for markdown. Includes refurbished products.' },
  { type: 'entry', deck: 'G Deck', definition: 'Items under evaluation by the New Product Sourcing Group with new vendors/manufacturers and/or new product lines. These items will not be available at all stores. Once added to general assortment, they are assigned to the appropriate retail buyer and merchandising deck.' },
  { type: 'entry', deck: 'H Deck', definition: 'Items under evaluation by the New Product Sourcing Group with new vendors/manufacturers and/or new product lines. These items will be available at all stores. Once added to general assortment, they are assigned to the appropriate retail buyer and merchandising deck.' },
  { type: 'section', title: 'Other Decks' },
  { type: 'entry', deck: 'I Deck', definition: 'Set Items.' },
  { type: 'entry', deck: 'L Deck', definition: 'POSA Cards, Service Plans, and other items with no inventory.' },
  { type: 'entry', deck: 'P Deck', definition: 'Amazon sales products.' },
  { type: 'entry', deck: 'R Deck', definition: 'Items purchased from more than one vendor that are linked together. R Deck SKU\'s are tied to a primary SKU which reports inventory and will reside on decks A-H.' },
  { type: 'entry', deck: 'S Deck', definition: 'Special order items only. Check with the Special Order associate in Purchasing for availability before committing to an order.' },
];

export const getDeckMeaning = (deck: string) => {
  const normalized = String(deck || '').trim();
  if (!normalized) return null;
  const canonical = /deck$/i.test(normalized) ? normalized : `${normalized} Deck`;
  const match = DECK_ROWS.find((row) => row.type === 'entry' && row.deck.toLowerCase() === canonical.toLowerCase());
  return match && match.type === 'entry' ? match.definition : null;
};