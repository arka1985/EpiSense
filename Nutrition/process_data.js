/**
 * IFCT2017 Data Processor
 * Downloads the raw CSV from GitHub and outputs a compact JSON for the PWA.
 */
const https = require('https');
const fs = require('fs');

const COMPOSITIONS_URL = 'https://raw.githubusercontent.com/nodef/ifct2017/main/compositions/index.csv';
const GROUPS_URL = 'https://raw.githubusercontent.com/nodef/ifct2017/main/groups/index.csv';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Key nutrient columns we want to extract (value only, not error)
const NUTRIENT_COLS = [
  'enerc',     // Energy (kJ)
  'water',     // Moisture (g)
  'protcnt',   // Protein (g)
  'fatce',     // Total Fat (g)
  'fibtg',     // Dietary Fiber (g)
  'choavldf',  // Carbohydrate (g)
  'cholc',     // Cholesterol (mg)
  'retol',     // Retinol/Vit A (µg)
  'cartb',     // β-Carotene (µg)
  'thia',      // Thiamine B1 (mg)
  'ribf',      // Riboflavin B2 (mg)
  'nia',       // Niacin B3 (mg)
  'pantac',    // Pantothenic acid B5 (mg)
  'vitb6c',    // Vitamin B6 (mg)
  'folsum',    // Folates B9 (µg)
  'vitc',      // Vitamin C (mg)
  'ergcal',    // Vitamin D2 (µg)
  'chocal',    // Vitamin D3 (µg)
  'tocpha',    // α-Tocopherol/Vit E (mg)
  'vitk1',     // Vitamin K1 (µg)
  'ca',        // Calcium (mg)
  'fe',        // Iron (mg)
  'mg',        // Magnesium (mg)
  'p',         // Phosphorus (mg)
  'k',         // Potassium (mg)
  'na',        // Sodium (mg)
  'zn',        // Zinc (mg)
  'cu',        // Copper (mg)
  'mn',        // Manganese (mg)
  'se',        // Selenium (µg)
  'fasat',     // Saturated Fat (g)
  'fams',      // Monounsat Fat (g)
  'fapu',      // Polyunsat Fat (g)
  'fsugar',    // Free Sugars (g)
  'starch',    // Starch (g)
];

// Nutrient display metadata
const NUTRIENT_META = {
  enerc:   { name: 'Energy',            unit: 'kJ',  convert: 1,        kcalFactor: 0.239006, rda: null },
  water:   { name: 'Moisture',          unit: 'g',   convert: 1,        rda: null },
  protcnt: { name: 'Protein',           unit: 'g',   convert: 1,        rda: 50 },
  fatce:   { name: 'Total Fat',         unit: 'g',   convert: 1,        rda: 65 },
  fibtg:   { name: 'Dietary Fiber',     unit: 'g',   convert: 1,        rda: 25 },
  choavldf:{ name: 'Carbohydrates',     unit: 'g',   convert: 1,        rda: 300 },
  cholc:   { name: 'Cholesterol',       unit: 'mg',  convert: 1,        rda: 300 },
  retol:   { name: 'Vitamin A (Retinol)', unit: 'µg', convert: 1000000, rda: 900 },
  cartb:   { name: 'β-Carotene',        unit: 'µg',  convert: 1000000,  rda: null },
  thia:    { name: 'Thiamine (B1)',      unit: 'mg',  convert: 1000,     rda: 1.2 },
  ribf:    { name: 'Riboflavin (B2)',    unit: 'mg',  convert: 1000,     rda: 1.3 },
  nia:     { name: 'Niacin (B3)',        unit: 'mg',  convert: 1000,     rda: 16 },
  pantac:  { name: 'Pantothenic acid (B5)', unit: 'mg', convert: 1000,  rda: 5 },
  vitb6c:  { name: 'Vitamin B6',        unit: 'mg',  convert: 1000,     rda: 1.7 },
  folsum:  { name: 'Folate (B9)',        unit: 'µg',  convert: 1000000,  rda: 400 },
  vitc:    { name: 'Vitamin C',          unit: 'mg',  convert: 1000,     rda: 90 },
  ergcal:  { name: 'Vitamin D2',         unit: 'µg',  convert: 1000000,  rda: null },
  chocal:  { name: 'Vitamin D3',         unit: 'µg',  convert: 1000000,  rda: null },
  tocpha:  { name: 'Vitamin E (α-Tocopherol)', unit: 'mg', convert: 1000, rda: 15 },
  vitk1:   { name: 'Vitamin K1',        unit: 'µg',  convert: 1000000,  rda: 120 },
  ca:      { name: 'Calcium',           unit: 'mg',  convert: 1000,     rda: 1000 },
  fe:      { name: 'Iron',              unit: 'mg',  convert: 1000,     rda: 18 },
  mg:      { name: 'Magnesium',         unit: 'mg',  convert: 1000,     rda: 420 },
  p:       { name: 'Phosphorus',        unit: 'mg',  convert: 1000,     rda: 700 },
  k:       { name: 'Potassium',         unit: 'mg',  convert: 1000,     rda: 4700 },
  na:      { name: 'Sodium',            unit: 'mg',  convert: 1000,     rda: 2300 },
  zn:      { name: 'Zinc',              unit: 'mg',  convert: 1000,     rda: 11 },
  cu:      { name: 'Copper',            unit: 'mg',  convert: 1000,     rda: 0.9 },
  mn:      { name: 'Manganese',         unit: 'mg',  convert: 1000,     rda: 2.3 },
  se:      { name: 'Selenium',          unit: 'µg',  convert: 1000000,  rda: 55 },
  fasat:   { name: 'Saturated Fat',     unit: 'g',   convert: 1,        rda: 20 },
  fams:    { name: 'Monounsaturated Fat',unit: 'g',   convert: 1,        rda: null },
  fapu:    { name: 'Polyunsaturated Fat',unit: 'g',   convert: 1,        rda: null },
  fsugar:  { name: 'Free Sugars',       unit: 'g',   convert: 1,        rda: 50 },
  starch:  { name: 'Starch',            unit: 'g',   convert: 1,        rda: null },
};

async function main() {
  console.log('Downloading compositions data...');
  const compCSV = await fetch(COMPOSITIONS_URL);
  console.log('Downloading groups data...');
  const groupsCSV = await fetch(GROUPS_URL);

  // Parse groups
  const groupLines = groupsCSV.trim().split('\n');
  const groups = [];
  for (let i = 1; i < groupLines.length; i++) {
    const cols = parseCSVLine(groupLines[i]);
    if (cols.length >= 4 && cols[0]) {
      groups.push({ code: cols[0], name: cols[1], count: parseInt(cols[2]) || 0, tags: cols[3] });
    }
  }

  // Parse compositions
  const lines = compCSV.trim().split('\n');
  const header = parseCSVLine(lines[0]);
  
  // Build column index map
  const colIdx = {};
  header.forEach((h, i) => colIdx[h] = i);

  const foods = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    if (!cols[colIdx['code']]) continue;

    const food = {
      code: cols[colIdx['code']],
      name: cols[colIdx['name']],
      scie: cols[colIdx['scie']] || '',
      lang: cols[colIdx['lang']] || '',
      grup: cols[colIdx['grup']] || '',
      tags: cols[colIdx['tags']] || '',
      n: {} // nutrients
    };

    for (const key of NUTRIENT_COLS) {
      const idx = colIdx[key];
      if (idx !== undefined) {
        let val = parseFloat(cols[idx]);
        if (isNaN(val)) val = 0;
        // Apply conversion factor (CSV values are in grams for most, need to convert)
        const meta = NUTRIENT_META[key];
        if (meta) {
          val = Math.round(val * meta.convert * 1000) / 1000;
        }
        if (val !== 0) food.n[key] = val;
      }
    }

    foods.push(food);
  }

  console.log(`Processed ${foods.length} foods, ${groups.length} groups`);

  // Build the output
  const output = {
    meta: NUTRIENT_META,
    groups: groups,
    foods: foods
  };

  const json = JSON.stringify(output);
  const jsContent = `// IFCT2017 Food Composition Data (auto-generated)\n// Source: Indian Food Composition Tables 2017, NIN Hyderabad\nconst IFCT_DATA = ${json};\n`;
  
  fs.writeFileSync('data.js', jsContent, 'utf8');
  console.log(`Written data.js (${(jsContent.length / 1024).toFixed(0)} KB)`);
}

main().catch(console.error);
