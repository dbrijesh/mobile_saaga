const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Map new file subcategories to existing category names
const SUBCATEGORY_TO_CATEGORY = {
  'Ghee': 'Oils & Ghee',
  'Powdered Spices': 'Spices',
  'Whole Spices': 'Spices',
  'Dal': 'Lentils & Pulses',
  'Flour & Millets': 'Flours',
  'Rajma Chole & Others': 'Lentils & Pulses',
  'Vadams and Vathals': 'Snacks',
  'Jam': 'Pickles & Condiments',
  'Pickle': 'Pickles & Condiments',
  'Coffee': 'Beverages',
  'Tea': 'Beverages',
  'Milk Drinks': 'Beverages',
  'Vermicelli & Poha': 'Rice & Grains',
  'Dry Fruits & Nuts': 'Dry Fruits & Nuts',
  'Ready to Eat': 'Ready to Eat',
  'Dishwashing Gel & Bar': 'Cleaners & Repellents',
};

function cleanName(name) {
  // Strip trailing comma/space/punctuation artifacts
  return (name || '').trim().replace(/[,\s]+$/, '').trim();
}

function normalizeKey(name, weight, unit) {
  return `${cleanName(name).toLowerCase()}|${String(weight || '').trim()}|${(unit || '').toLowerCase().trim()}`;
}

function getNextProductId(existingProducts) {
  let maxNum = 0;
  for (const p of existingProducts) {
    const match = (p.id || '').match(/^PROD-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return maxNum;
}

function mergeProducts() {
  const outputDir = path.join(__dirname, '../backend/data');

  // Load existing products — clean names, remove blank-name junk rows, deduplicate
  const rawExisting = JSON.parse(
    fs.readFileSync(path.join(outputDir, 'products.json'), 'utf8')
  );
  const seenExisting = new Set();
  const existingProducts = [];
  let removedJunk = 0;
  let removedExistingDups = 0;
  for (const p of rawExisting) {
    const cleaned = { ...p, name: cleanName(p.name) };
    if (!cleaned.name) { removedJunk++; continue; }
    const key = normalizeKey(cleaned.name, cleaned.weight, cleaned.unit);
    if (seenExisting.has(key)) { removedExistingDups++; continue; }
    seenExisting.add(key);
    existingProducts.push(cleaned);
  }
  if (removedJunk > 0) console.log(`Removed ${removedJunk} blank-name entries from existing data`);
  if (removedExistingDups > 0) console.log(`Removed ${removedExistingDups} duplicate entries from existing data`);
  console.log(`Loaded ${existingProducts.length} existing products`);

  // Build lookup key → existing product index for fast duplicate detection
  const existingKeys = new Map();
  existingProducts.forEach((p, idx) => {
    const key = normalizeKey(p.name, p.weight, p.unit);
    existingKeys.set(key, idx);
  });

  // Load new Excel file
  const wb = XLSX.readFile(path.join(__dirname, '../Saaga Online New Products.xlsx'));
  const ws = wb.Sheets['Sheet1'];
  const rawRows = XLSX.utils.sheet_to_json(ws);
  console.log(`Found ${rawRows.length} rows in new Excel file`);

  // Deduplicate within new file: keep first occurrence of each name+weight+unit
  const seenInNew = new Map();
  const dedupedRows = [];
  let intraFileDups = 0;
  for (const row of rawRows) {
    const key = normalizeKey(row['PRODUCT NAME'], row['WEIGHT'], row['UNIT']);
    if (seenInNew.has(key)) {
      intraFileDups++;
    } else {
      seenInNew.set(key, true);
      dedupedRows.push(row);
    }
  }
  console.log(`Removed ${intraFileDups} intra-file duplicates → ${dedupedRows.length} unique rows`);

  // Process each unique row from new file
  let nextId = getNextProductId(existingProducts);
  let added = 0;
  let updated = 0;

  for (const row of dedupedRows) {
    const name = (row['PRODUCT NAME'] || '').trim();
    if (!name) continue;

    const rawCategory = (row['CATEGORY'] || '').trim();
    const rawSubCategory = (row['SUB- CATEGORY'] || '').trim();
    const category = SUBCATEGORY_TO_CATEGORY[rawSubCategory] || rawCategory;
    const weight = row['WEIGHT'] != null ? String(row['WEIGHT']) : '';
    const unit = (row['UNIT'] || 'g').trim();
    const price = row['PRICE'] != null ? parseFloat(parseFloat(row['PRICE']).toFixed(2)) : 0;
    const stock = row['STOCK'] != null ? parseInt(row['STOCK'], 10) : 100;

    const key = normalizeKey(name, weight, unit);

    if (existingKeys.has(key)) {
      // Update existing product with fresh price and stock
      const idx = existingKeys.get(key);
      existingProducts[idx].price = price;
      existingProducts[idx].stock = stock;
      existingProducts[idx].inStock = stock > 0;
      existingProducts[idx].updatedAt = new Date().toISOString();
      if (rawSubCategory) existingProducts[idx].subCategory = rawSubCategory;
      updated++;
    } else {
      // New product — append
      nextId++;
      const newProduct = {
        id: `PROD-${String(nextId).padStart(6, '0')}`,
        name,
        description: `${name} - Premium quality Indian grocery product`,
        category,
        subCategory: rawSubCategory,
        brand: '',
        unit,
        weight,
        price,
        originalPrice: null,
        currency: 'SGD',
        stock,
        inStock: stock > 0,
        imageUrl: '',
        images: [],
        sku: `SKU-NEW-${String(row['SKU']).padStart(6, '0')}`,
        barcode: '',
        tags: [],
        featured: false,
        discount: 0,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      existingProducts.push(newProduct);
      existingKeys.set(key, existingProducts.length - 1);
      added++;
    }
  }

  console.log(`Added ${added} new products, updated ${updated} existing products`);

  // Group by category
  const categorizedProducts = existingProducts.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // Build categories list, preserving existing IDs where possible
  const existingCats = JSON.parse(
    fs.readFileSync(path.join(outputDir, 'categories.json'), 'utf8')
  );
  const existingCatMap = new Map(existingCats.map(c => [c.name, c]));

  let catIdCounter = existingCats.length;
  const mergedCategories = Object.keys(categorizedProducts)
    .sort()
    .map(catName => {
      if (existingCatMap.has(catName)) {
        const existing = existingCatMap.get(catName);
        return {
          ...existing,
          productCount: categorizedProducts[catName].length,
        };
      }
      catIdCounter++;
      return {
        id: `CAT-${String(catIdCounter).padStart(4, '0')}`,
        name: catName,
        slug: catName.toLowerCase().replace(/\s+/g, '-'),
        productCount: categorizedProducts[catName].length,
        imageUrl: '',
        featured: false,
      };
    });

  // Save all files
  fs.writeFileSync(path.join(outputDir, 'products.json'), JSON.stringify(existingProducts, null, 2));
  fs.writeFileSync(path.join(outputDir, 'products-by-category.json'), JSON.stringify(categorizedProducts, null, 2));
  fs.writeFileSync(path.join(outputDir, 'categories.json'), JSON.stringify(mergedCategories, null, 2));

  const validPrices = existingProducts.filter(p => p.price > 0).map(p => p.price);
  const stats = {
    totalProducts: existingProducts.length,
    totalCategories: mergedCategories.length,
    averagePrice: validPrices.length
      ? (validPrices.reduce((s, p) => s + p, 0) / validPrices.length).toFixed(2)
      : '0.00',
    priceRange: {
      min: validPrices.length ? Math.min(...validPrices).toFixed(2) : '0.00',
      max: validPrices.length ? Math.max(...validPrices).toFixed(2) : '0.00',
    },
    categoriesBreakdown: mergedCategories.map(cat => ({
      category: cat.name,
      count: cat.productCount,
    })),
  };
  fs.writeFileSync(path.join(outputDir, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log('\n✅ Merge completed successfully!');
  console.log(`📦 Total products: ${stats.totalProducts}`);
  console.log(`📂 Total categories: ${stats.totalCategories}`);
  console.log(`💰 Price range: SGD ${stats.priceRange.min} - ${stats.priceRange.max}`);
  console.log('\nCategories breakdown:');
  stats.categoriesBreakdown.forEach(c => console.log(`  ${c.category}: ${c.count} products`));
}

mergeProducts();
