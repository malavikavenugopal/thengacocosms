export const CLEAN_CATEGORIES = [
  'Bowls',
  'Spoons',
  'Cups',
  'Tableware',
  'Decor',
  'Candles',
  'Kitchen',
  'Home & Garden',
  'Gifting',
  'Corporate Gifts',
  'Pet Accessories',
  'Other'
];

export const DEFAULT_CATEGORIES = CLEAN_CATEGORIES;

/**
 * Normalizes any category string OR automatically infers a proper category 
 * from the product name if the category is 'Other' or missing.
 *
 * @param {string} rawCategory 
 * @param {string} productName 
 * @returns {string} Normalized standard category name
 */
export const normalizeCategory = (rawCategory, productName = '') => {
  const trimmedCat = (rawCategory || '').trim();
  const lowerCat = trimmedCat.toLowerCase();
  const nameLower = (productName || '').toLowerCase();

  // If existing category is valid and specific (not 'other', 'others', empty, 0, null, etc.)
  if (lowerCat && !['other', 'others', '0', 'null', 'undefined', 'opening stock', ''].includes(lowerCat)) {
    // Check exact match in CLEAN_CATEGORIES
    const exact = CLEAN_CATEGORIES.find(c => c.toLowerCase() === lowerCat);
    if (exact) return exact;

    // Direct category text rules
    if (lowerCat.includes('corporate gift')) return 'Corporate Gifts';
    if (lowerCat.includes('gift') || lowerCat.includes('hamper')) return 'Gifting';
    if (lowerCat.includes('spoon') || lowerCat.includes('cutlery')) return 'Spoons';
    if (lowerCat.includes('bowl')) return 'Bowls';
    if (lowerCat.includes('cup')) return 'Cups';
    if (lowerCat.includes('candle')) return 'Candles';
    if (lowerCat.includes('home & garden') || lowerCat.includes('garden') || lowerCat.includes('planter')) return 'Home & Garden';
    if (lowerCat.includes('decor')) return 'Decor';
    if (lowerCat.includes('kitchen')) return 'Kitchen';
    if (lowerCat.includes('tableware')) return 'Tableware';
    if (lowerCat.includes('pet')) return 'Pet Accessories';
  }

  // If category was 'Other' or missing, analyze product name to assign proper category!
  if (nameLower) {
    if (nameLower.includes('hanging') || nameLower.includes('magnet') || nameLower.includes('medal') || nameLower.includes('wall art') || nameLower.includes('keychain') || nameLower.includes('key ring')) {
      return 'Decor';
    }
    if (nameLower.includes('rakhi') || nameLower.includes('lapel pin') || nameLower.includes('gift') || nameLower.includes('hamper') || nameLower.includes('badge')) {
      return 'Gifting';
    }
    if (nameLower.includes('planter') || nameLower.includes('pot') || nameLower.includes('vase') || nameLower.includes('garden')) {
      return 'Home & Garden';
    }
    if (nameLower.includes('bowl')) {
      return 'Bowls';
    }
    if (nameLower.includes('spoon') || nameLower.includes('fork') || nameLower.includes('spatula') || nameLower.includes('ladle') || nameLower.includes('cutlery')) {
      return 'Spoons';
    }
    if (nameLower.includes('cup') || nameLower.includes('mug') || nameLower.includes('glass')) {
      return 'Cups';
    }
    if (nameLower.includes('candle') || nameLower.includes('tea light') || nameLower.includes('diya')) {
      return 'Candles';
    }
    if (nameLower.includes('coaster') || nameLower.includes('tray') || nameLower.includes('plate') || nameLower.includes('dish') || nameLower.includes('tableware')) {
      return 'Tableware';
    }
    if (nameLower.includes('pet')) {
      return 'Pet Accessories';
    }
  }

  return 'Other';
};

/**
 * Returns a sorted list of unique categories combining clean default categories, custom categories, and stock categories.
 * @param {Array} stockList - List of products from global state
 * @param {Array} customCategories - List of user-added custom categories
 * @returns {Array<string>} List of unique category names
 */
export const getCategoryOptions = (stockList = [], customCategories = []) => {
  const existingCategories = (stockList || [])
    .map(item => normalizeCategory(item?.category, item?.name))
    .filter(Boolean);

  const combined = Array.from(new Set([
    ...CLEAN_CATEGORIES, 
    ...(customCategories || []), 
    ...existingCategories
  ]));
  
  // Keep 'Other' at the end if present, sort the rest alphabetically
  const withoutOther = combined.filter(c => c.toLowerCase() !== 'other').sort((a, b) => a.localeCompare(b));
  if (combined.some(c => c.toLowerCase() === 'other')) {
    withoutOther.push('Other');
  }

  return withoutOther;
};
