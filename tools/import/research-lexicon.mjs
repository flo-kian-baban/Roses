// The ingredient lexicon of the menu research checks (Kian via the PM, 2026-10-12: "every ingredient a description names must appear in that
// item's allergen draft"). Each entry: the allergen the ingredient brings (null: none of the priority allergens), the canonical ingredient
// the item's key ingredients must name, and the words a description may use for it, English and Persian. Longer phrases are matched first
// and consume their words, so "peanut butter" is peanuts (not milk), "almond milk" tree nuts, "oat milk" oats, "cream of coconut" none,
// "ginger ale" none, "بادام‌زمینی" peanuts (not tree nuts). Matching is on whole words, case-insensitive, an English plural "s" allowed;
// Persian words are matched on whole words with or without the zero-width non-joiner.
export const LEXICON = [
  // phrases that would otherwise match a shorter word wrongly
  [null, 'coconut', 'cream of coconut', 'coconut cream', 'coconut milk', 'شیر نارگیل', 'خامه نارگیل'],
  [null, 'cocoa butter', 'cocoa butter', 'کره کاکائو'],
  [null, 'ginger ale', 'ginger ale', 'جینجر ایل'],
  [null, 'cream soda', 'cream soda'],
  [null, 'rice', 'rice milk', 'شیر برنج'], // a Persian rice pudding word; no allergen of its own here
  [null, 'starch noodle', 'starch noodle', 'rice noodle', 'cornstarch noodle', 'corn starch noodle', 'rice vermicelli', 'رشته نشاسته', 'رشته نشاسته‌ای', 'رشته‌های نشاسته‌ای', 'رشته فالوده', 'رشته برنجی'], // faloodeh's noodles: starch, not wheat
  ['peanuts', 'peanut butter', 'peanut butter', 'کره بادام‌زمینی', 'کره بادام زمینی'],
  ['peanuts', 'peanut', 'peanut', 'بادام‌زمینی', 'بادام زمینی'],
  ['tree nuts', 'almond milk', 'almond milk', 'شیر بادام'],
  ['oats', 'oat milk', 'oat milk', 'شیر جو دوسر', 'شیر جودوسر'],
  ['oats', 'oat', 'oat', 'oatmeal', 'جو دوسر', 'جودوسر'],
  ['soy', 'soy milk', 'soy milk', 'soya milk', 'شیر سویا'],
  ['milk', 'ice cream', 'ice cream', 'gelato', 'بستنی'],
  ['milk', 'cream cheese', 'cream cheese', 'پنیر خامه‌ای'],
  ['milk', 'clotted cream', 'clotted cream', 'gheymagh', 'kaymak', 'qaymaq', 'سرشیر', 'قیماق', 'قیماق'],
  ['milk', 'condensed milk', 'condensed milk', 'evaporated milk', 'dulce de leche', 'tres leches', 'شیر عسلی'],
  ['egg', 'mayonnaise', 'mayonnaise', 'mayo', 'aioli', 'مایونز', 'سس مایونز'],
  ['fish', 'worcestershire sauce', 'worcestershire', 'سس ورچستر'],
  ['molluscs', 'clamato', 'clamato', 'clam', 'کلاماتو', 'صدف'],
  ['barley', 'beer', 'beer', 'lager', 'malt', 'آبجو', 'مالت'],
  ['wheat', 'bread', 'bread', 'flatbread', 'lavash', 'sangak', 'barbari', 'baguette', 'bun', 'toast', 'نان', 'لواش', 'سنگک', 'بربری', 'باگت', 'تست'],
  // milk
  ['milk', 'milk', 'milk', 'milky', 'buttermilk', 'شیر'],
  ['milk', 'cream', 'cream', 'whipped cream', 'خامه'],
  ['milk', 'butter', 'butter', 'buttery', 'ghee', 'کره'],
  ['milk', 'cheese', 'cheese', 'cheesecake', 'cheddar', 'mozzarella', 'feta', 'mascarpone', 'parmesan', 'halloumi', 'ricotta', 'پنیر', 'چدار', 'موزارلا', 'فتا', 'ماسکارپونه', 'پارمزان'],
  ['milk', 'yogurt', 'yogurt', 'yoghurt', 'mast', 'maast', 'doogh', 'ماست', 'دوغ'],
  ['milk', 'kashk', 'kashk', 'kashke', 'whey', 'کشک'],
  ['milk', 'latte', 'latte', 'cappuccino', 'mocha', 'macchiato', 'flat white', 'milkshake', 'لاته', 'کاپوچینو', 'موکا', 'ماکیاتو', 'میلک‌شیک', 'میلک شیک'],
  ['milk', 'custard', 'custard', 'کاستارد'],
  ['milk', 'baileys', 'baileys', 'irish cream', 'بیلیز'],
  // egg
  ['egg', 'egg', 'egg', 'omelette', 'omelet', 'meringue', 'تخم‌مرغ', 'تخم مرغ', 'املت'],
  // wheat and the other gluten sources
  ['wheat', 'flour', 'flour', 'wheat', 'semolina', 'bulgur', 'couscous', 'آرد', 'گندم', 'بلغور'],
  ['wheat', 'pastry', 'pastry', 'puff pastry', 'phyllo', 'filo', 'dough', 'crust', 'croissant', 'kataifi', 'خمیر', 'کروسان', 'کروسانت', 'یوفکا'],
  ['wheat', 'noodle', 'noodle', 'pasta', 'reshteh', 'رشته'],
  ['wheat', 'cake', 'cake', 'sponge', 'ladyfinger', 'biscuit', 'cookie', 'oreo', 'lotus biscuit', 'biscoff', 'waffle', 'pancake', 'کیک', 'بیسکویت', 'کوکی', 'اورئو', 'وافل', 'پنکیک'],
  ['wheat', 'pizza dough', 'pizza', 'sandwich', 'bagel', 'پیتزا', 'ساندویچ', 'بیگل', 'بیگل'],
  ['barley', 'barley', 'barley', 'جو'],
  ['rye', 'rye', 'rye', 'چاودار'],
  // tree nuts
  ['tree nuts', 'almond', 'almond', 'بادام'],
  ['tree nuts', 'pistachio', 'pistachio', 'پسته'],
  ['tree nuts', 'walnut', 'walnut', 'gerdoo', 'گردو'],
  ['tree nuts', 'hazelnut', 'hazelnut', 'nutella', 'praline', 'فندق', 'نوتلا'],
  ['tree nuts', 'cashew', 'cashew', 'بادام هندی', 'کاجو'],
  ['tree nuts', 'pecan', 'pecan', 'pine nut', 'macadamia', 'marzipan', 'frangipane', 'پکان', 'ماکادمیا'],
  // sesame, soy, mustard
  ['sesame', 'sesame', 'sesame', 'tahini', 'tahina', 'کنجد', 'ارده'],
  ['soy', 'soy', 'soy', 'soya', 'tofu', 'سویا', 'توفو'],
  ['mustard', 'mustard', 'mustard', 'خردل'],
  // fish and shellfish
  ['fish', 'fish', 'fish', 'trout', 'salmon', 'tuna', 'anchovy', 'anchovies', 'cod', 'ماهی', 'قزل‌آلا', 'قزل آلا', 'سالمون', 'آنچوی'],
  ['crustaceans', 'shrimp', 'shrimp', 'prawn', 'crab', 'lobster', 'میگو', 'خرچنگ', 'لابستر'],
  ['molluscs', 'squid', 'squid', 'calamari', 'mussel', 'oyster', 'scallop', 'اسکوئید', 'کالاماری'],
  // added sulphites
  ['sulphites', 'wine', 'wine', 'rosé', 'sangria', 'prosecco', 'champagne', 'vermouth', 'شراب', 'سانگریا', 'پروسکو', 'شامپاین'],
  ['sulphites', 'raisin', 'raisin', 'sultana', 'dried apricot', 'کشمش'],
].map(([allergen, ingredient, ...words]) => ({ allergen, ingredient, words }));

const FA = /[؀-ۿ]/;
const norm = (s) => String(s ?? '').toLowerCase().replace(/‌/g, ' ').replace(/[ً-ٟ]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// every [entry, word] in the order matched: phrases (more words) first, then longer words
const PATTERNS = LEXICON.flatMap((e) => e.words.map((w) => ({ e, w, n: norm(w) })))
  .sort((a, b) => b.n.split(' ').length - a.n.split(' ').length || b.n.length - a.n.length)
  .map((p) => ({ ...p, re: FA.test(p.w) ? new RegExp(`(^|[^\\u0600-\\u06ff])${escape(p.n)}(?![\\u0600-\\u06ff])`, 'g') : new RegExp(`(^|[^a-z])${escape(p.n)}(?:e?s)?(?![a-z])`, 'g') }));

// The lexicon entries a text names, each once, with the word that named it.
export function named(text) {
  let t = ` ${norm(text)} `;
  const out = new Map();
  for (const p of PATTERNS) {
    if (!p.re.test(t)) continue;
    p.re.lastIndex = 0;
    if (!out.has(p.e)) out.set(p.e, p.w);
    t = t.replace(p.re, (m, pre) => `${pre}${' '.repeat(m.length - pre.length)}`); // consumed: a shorter word inside it is not matched again
  }
  return [...out.entries()].map(([e, word]) => ({ allergen: e.allergen, ingredient: e.ingredient, word }));
}

// Is a named ingredient reflected in an item's key ingredients? Yes when they name it (the canonical word or the description's own word,
// singular or plural), or, for an ingredient that brings an allergen, when they name another ingredient bringing the same allergen
// ("cake" is reflected by "wheat flour", "latte" by "milk", the knafeh's "رشته" by "kataifi pastry"). Entries without an allergen always are.
export function reflected(n, ingredients) {
  if (!n.allergen) return true; // the entries without an allergen only keep a phrase from matching a shorter word wrongly
  const ing = ingredients.map((x) => String(x).toLowerCase());
  const stem = (w) => w.toLowerCase().replace(/(es|s)$/, '');
  if (ing.some((x) => x.includes(stem(n.ingredient)) || stem(n.ingredient).includes(stem(x)) || x.includes(stem(n.word)))) return true;
  return !!n.allergen && named(ing.join(', ')).some((m) => m.allergen === n.allergen);
}

// Health, medical and nutrition claim words (the PM: "no health or medical claims"), English and Persian; and superlatives about the venue.
export const CLAIM_WORDS = ['detox', 'cleanse', 'cleansing', 'immune', 'immunity', 'boost', 'boosts', 'boosting', 'cure', 'cures', 'heal', 'heals', 'healing', 'remedy', 'medicinal', 'therapeutic', 'digest', 'digestion', 'digestive', 'metabolism', 'antioxidant', 'antioxidants', 'anti-inflammatory', 'inflammation', 'weight', 'slimming', 'fat-burning', 'healthy', 'health', 'healthier', 'wellness', 'nourishing', 'vitamin', 'vitamins', 'protein', 'energy', 'energizing', 'energising', 'calming', 'relaxing', 'soothing', 'soothe', 'soothes', 'stress', 'sleep', 'allergy', 'allergies', 'cancer', 'hormone', 'hormones', 'superfood', 'guilt-free', 'good for you',
  'سم‌زدایی', 'سم زدایی', 'پاکسازی', 'ایمنی', 'تقویت', 'درمان', 'شفا', 'دارویی', 'گوارش', 'هضم', 'متابولیسم', 'آنتی‌اکسیدان', 'التهاب', 'لاغری', 'چربی‌سوز', 'سالم', 'سلامت', 'سلامتی', 'ویتامین', 'پروتئین', 'انرژی', 'آرام‌بخش', 'آرامش', 'آرامش‌بخش', 'تسکین', 'استرس', 'خواب', 'حساسیت', 'سرطان', 'مقوی', 'مفید'];
export const SUPERLATIVES = ['best', 'finest', 'perfect', 'perfection', 'famous', 'legendary', 'world-class', 'ultimate', 'unbeatable', 'number one', 'the most', 'greatest', 'unrivalled', 'unrivaled', 'بهترین', 'معروف', 'بی‌نظیر', 'بی نظیر', 'مشهور'];
export function wordsIn(text, list) {
  const t = ` ${norm(text)} `;
  return list.filter((w) => { const n = norm(w); return FA.test(w) ? new RegExp(`(^|[^\\u0600-\\u06ff])${escape(n)}(?![\\u0600-\\u06ff])`).test(t) : new RegExp(`(^|[^a-z])${escape(n)}(?![a-z])`).test(t); });
}
