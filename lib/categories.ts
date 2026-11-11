export const SPENDING = [
  "Rent",
  "Groceries",
  "Subscriptions",
  "Education",
  "Tuition",
  "Soccer",
  "Dining",
  "Shopping",
  "Transport",
  "Gas",
  "Bills & Utilities",
  "Health & Fitness",
  "Entertainment",
  "Fees & Interest",
  "Other",
] as const;

export const INCOME = ["UPEISU", "Dyne Holding", "Lobster on the Wharf", "Tips", "Other Income"] as const;

/** Money lent to friends or borrowed from them. It isn't spending or income, but it's worth keeping track of. */
export const LOANS = ["Lent", "Borrowed"] as const;

export const TRANSFERS = ["Transfers & Payments"] as const;

export const CATEGORIES = [...SPENDING, ...INCOME, ...LOANS, ...TRANSFERS] as const;
export type Category = (typeof CATEGORIES)[number];

export type Kind = "spending" | "income" | "loan" | "transfer";

export function kindOf(c: Category): Kind {
  if ((INCOME as readonly string[]).includes(c)) return "income";
  if ((LOANS as readonly string[]).includes(c)) return "loan";
  if ((TRANSFERS as readonly string[]).includes(c)) return "transfer";
  return "spending";
}

// The chart palette has 8 colours (in a fixed order that stays readable for colour-blind
// users). They go to your main categories. Everything else shares a neutral grey and is
// identified by its label.
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const NEUTRAL = "#a3a29b";

export function colorOf(c: Category): string {
  const i = SPENDING.indexOf(c as (typeof SPENDING)[number]);
  return i >= 0 && i < SLOTS.length ? SLOTS[i] : NEUTRAL;
}

type Rule = { category: Category; pattern: RegExp; when?: "in" | "out" };

// The first match wins, so order matters. Rules marked "in" only apply to money coming in,
// so paying for a meal at Lobster on the Wharf won't be counted as income from your job there.
const RULES: Rule[] = [
  { category: "UPEISU", pattern: /upeisu|upei student union|student union/i, when: "in" },
  { category: "Dyne Holding", pattern: /dyne/i, when: "in" },
  { category: "Lobster on the Wharf", pattern: /lobster on the wharf|lobster/i, when: "in" },
  { category: "Tips", pattern: /\btips?\b|gratuit/i, when: "in" },
  { category: "Other Income", pattern: /payroll|salary|direct dep|\bwages\b|pay ?cheque|paycheck|employment insurance|gst credit/i, when: "in" },
  // Rent is often paid by e-transfer, so it has to be checked before the transfer rule.
  { category: "Rent", pattern: /\brent\b|landlord|property m|apartments?\b|mortgage/i },
  { category: "Transfers & Payments", pattern: /payment[\s-]*(thank|received)|thank you|autopay|e-?transfer|\btransfer\b|\btfr\b|credit card payment|card payment|\bpymt\b|to savings|from savings|from chequing|to chequing/i },
  { category: "Tuition", pattern: /tuition|student fees|student account|university of p/i },
  { category: "Soccer", pattern: /soccer|futsal|football|\bfc\b/i },
  { category: "Fees & Interest", pattern: /\bfee\b|fees\b|interest charge|purchase interest|service charge|overdraft|\bnsf\b/i },
  { category: "Subscriptions", pattern: /netflix|spotify|disney|hulu|prime video|amazon prime|apple\.com|icloud|youtube|crave|adobe|openai|chatgpt|anthropic|github|microsoft|xbox|playstation|nintendo|patreon|audible|dropbox|notion/i },
  { category: "Education", pattern: /upei|universit|college|bookstore|udemy|coursera|pearson|chegg|textbook/i },
  { category: "Dining", pattern: /restaurant|\bcafe\b|caf[eé]|coffee|tim hortons|\btims\b|starbucks|mcdonald|burger|pizza|subway|a&w|wendy|\bkfc\b|domino|uber ?eats|doordash|skip ?the ?dishes|grubhub|chipotle|popeyes|taco|sushi|\bpub\b|grill|\bbar\b|diner|bistro|kitchen|dairy queen|second cup|bakery|shawarma|pho\b|ramen|lobster/i },
  { category: "Transport", pattern: /\buber\b|lyft|taxi|transit|\bbus\b|parking|via rail|air canada|westjet|porter air|airline|flight|\btoll\b|car wash/i },
  { category: "Gas", pattern: /\bshell\b|esso|petro|irving|ultramar|chevron|exxon|husky|pioneer|circle k|gas station|\bfuel\b|\bgas\b/i },
  { category: "Groceries", pattern: /sobeys|superstore|loblaw|no ?frills|walmart|costco|\bmetro\b|safeway|food basics|freshco|kroger|whole foods|trader joe|\baldi\b|save-?on|grocer|giant tiger|foodland|co-?op|instacart|farm boy|t&t/i },
  { category: "Health & Fitness", pattern: /pharmacy|shoppers drug|lawtons|rexall|guardian|dental|dentist|clinic|doctor|medical|physio|optometr|walgreens|\bcvs\b|\bgym\b|goodlife|fitness|yoga/i },
  { category: "Bills & Utilities", pattern: /hydro|electric|\bwater\b|utilit|internet|\bbell\b|rogers|telus|eastlink|\bfido\b|koodo|virgin|freedom mobile|insurance|wireless|mobile/i },
  { category: "Entertainment", pattern: /cineplex|cinema|theatre|theater|ticketmaster|steam|concert|bowling|museum|eventbrite/i },
  { category: "Shopping", pattern: /amazon|amzn|ebay|best buy|canadian tire|winners|marshalls|h&m|zara|uniqlo|old navy|\bgap\b|ikea|target|dollarama|staples|apple store|indigo|etsy|shein|temu|aliexpress|sport chek|home depot|lowe'?s|sephora|paypal/i },
];

export function categorize(description: string, amount: number): Category {
  const direction = amount > 0 ? "in" : "out";
  for (const rule of RULES) {
    if (rule.when && rule.when !== direction) continue;
    if (rule.pattern.test(description)) return rule.category;
  }
  // Money coming in that isn't a known refund or transfer is most likely income.
  return amount > 0 ? "Other Income" : "Other";
}

/** Colours for the two chart series that show up everywhere: money in and money out. */
export const SERIES = { income: "#2a78d6", spent: "#eb6834" };
