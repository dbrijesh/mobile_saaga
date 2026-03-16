const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Converts the Saaga product Excel file to JSON format
 * Rounds SGD prices to 1 decimal place
 */
function convertExcelToJson() {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(path.join(__dirname, '../Saaga_Export_ProductNdPriceList_V01_15Dec2025.xlsx'));

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${rawData.length} products in Excel file`);
    console.log('Sample row:', rawData[0]);

    // Transform the data
    const products = rawData.map((row, index) => {
      // Round SGD Price to 1 decimal place
      const sgdPrice = row['SGD Price'] ? parseFloat(row['SGD Price']).toFixed(1) : '0.0';

      // Determine category based on product name
      const productName = row['PRODUCT'] || row['Product Name'] || row['Name'] || '';
      let category = row['Category'] || 'Uncategorized';

      // Auto-categorize based on product name if no category specified
      if (category === 'Uncategorized' && productName) {
        const nameLower = productName.toLowerCase();
        if (nameLower.includes('rice') || nameLower.includes('basmati')) {
          category = 'Rice & Grains';
        } else if (nameLower.includes('dal') || nameLower.includes('lentil')) {
          category = 'Lentils & Pulses';
        } else if (nameLower.includes('oil') || nameLower.includes('ghee')) {
          category = 'Oils & Ghee';
        } else if (nameLower.includes('spice') || nameLower.includes('masala') ||
                   nameLower.includes('turmeric') || nameLower.includes('cumin') ||
                   nameLower.includes('coriander') || nameLower.includes('pepper')) {
          category = 'Spices';
        } else if (nameLower.includes('flour') || nameLower.includes('atta')) {
          category = 'Flours';
        } else if (nameLower.includes('snack') || nameLower.includes('mixture')) {
          category = 'Snacks';
        } else if (nameLower.includes('tea') || nameLower.includes('coffee')) {
          category = 'Beverages';
        } else if (nameLower.includes('pickle') || nameLower.includes('chutney')) {
          category = 'Pickles & Condiments';
        }
      }

      // Determine unit from UOM
      let unit = 'g';
      const uom = row['UOM'] || row['Unit'] || '';
      if (uom.toLowerCase().includes('gram')) unit = 'g';
      else if (uom.toLowerCase().includes('kg') || uom.toLowerCase().includes('kilo')) unit = 'kg';
      else if (uom.toLowerCase().includes('ml') || uom.toLowerCase().includes('milli')) unit = 'ml';
      else if (uom.toLowerCase().includes('ltr') || uom.toLowerCase().includes('litre')) unit = 'L';
      else if (uom.toLowerCase().includes('pcs') || uom.toLowerCase().includes('piece')) unit = 'pcs';

      return {
        id: `PROD-${String(index + 1).padStart(6, '0')}`,
        name: productName,
        description: row['Description'] || `${productName} - Premium quality Indian grocery product`,
        category: category,
        subCategory: row['Sub Category'] || row['SubCategory'] || '',
        brand: row['Brand'] || '',
        unit: unit,
        weight: row['Qty'] ? String(row['Qty']) : '',
        price: parseFloat(sgdPrice),
        originalPrice: row['Original Price'] ? parseFloat(row['Original Price']).toFixed(1) : null,
        currency: 'SGD',
        stock: row['Stock'] || 100,
        inStock: (row['Stock'] || 100) > 0,
        imageUrl: row['Image URL'] || row['ImageUrl'] || '',
        images: row['Images'] ? row['Images'].split(',').map(img => img.trim()) : [],
        sku: row['SKU'] || `SKU-${String(index + 1).padStart(6, '0')}`,
        barcode: row['Barcode'] || row['EAN'] || '',
        tags: row['Tags'] ? row['Tags'].split(',').map(tag => tag.trim()) : [],
        featured: row['Featured'] === 'Yes' || row['Featured'] === true || false,
        discount: row['Discount'] ? parseFloat(row['Discount']) : 0,
        rating: row['Rating'] ? parseFloat(row['Rating']) : 0,
        reviewCount: row['Review Count'] || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    // Group products by category for easier management
    const categorizedProducts = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {});

    // Create output directory
    const outputDir = path.join(__dirname, '../backend/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save all products
    fs.writeFileSync(
      path.join(outputDir, 'products.json'),
      JSON.stringify(products, null, 2)
    );

    // Save categorized products
    fs.writeFileSync(
      path.join(outputDir, 'products-by-category.json'),
      JSON.stringify(categorizedProducts, null, 2)
    );

    // Extract unique categories
    const categories = [...new Set(products.map(p => p.category))].map((cat, idx) => ({
      id: `CAT-${String(idx + 1).padStart(4, '0')}`,
      name: cat,
      slug: cat.toLowerCase().replace(/\s+/g, '-'),
      productCount: categorizedProducts[cat].length,
      imageUrl: '',
      featured: false
    }));

    fs.writeFileSync(
      path.join(outputDir, 'categories.json'),
      JSON.stringify(categories, null, 2)
    );

    // Generate statistics
    const stats = {
      totalProducts: products.length,
      totalCategories: categories.length,
      averagePrice: (products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2),
      priceRange: {
        min: Math.min(...products.map(p => p.price)).toFixed(1),
        max: Math.max(...products.map(p => p.price)).toFixed(1)
      },
      categoriesBreakdown: categories.map(cat => ({
        category: cat.name,
        count: cat.productCount
      }))
    };

    fs.writeFileSync(
      path.join(outputDir, 'stats.json'),
      JSON.stringify(stats, null, 2)
    );

    console.log('\n✅ Conversion completed successfully!');
    console.log(`📦 Total products: ${stats.totalProducts}`);
    console.log(`📂 Total categories: ${stats.totalCategories}`);
    console.log(`💰 Price range: SGD ${stats.priceRange.min} - ${stats.priceRange.max}`);
    console.log(`\n📁 Files generated:`);
    console.log(`   - backend/data/products.json`);
    console.log(`   - backend/data/products-by-category.json`);
    console.log(`   - backend/data/categories.json`);
    console.log(`   - backend/data/stats.json`);

  } catch (error) {
    console.error('❌ Error converting Excel to JSON:', error);
    process.exit(1);
  }
}

// Run the conversion
convertExcelToJson();
