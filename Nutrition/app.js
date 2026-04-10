/* =====================================================
   NutriSense India — Application Logic
   ===================================================== */

// ===== CONSTANTS =====
const GROUP_EMOJIS = {
  'A': '🌾', 'B': '🫘', 'C': '🥬', 'D': '🥕', 'E': '🍎',
  'F': '🥔', 'G': '🌶️', 'H': '🥜', 'I': '🍬', 'J': '🍄',
  'K': '📦', 'L': '🥛', 'M': '🥚', 'N': '🍗', 'O': '🥩',
  'P': '🐟', 'Q': '🦐', 'R': '🐚', 'S': '🐠', 'T': '🫒'
};

const MACRO_COLORS = {
  protcnt: '#4361EE',
  fatce: '#F72585',
  choavldf: '#4CC9F0',
  fibtg: '#7209B7'
};

const NUTRIENT_GROUPS = [
  {
    title: 'Energy & Macronutrients',
    icon: '⚡',
    iconBg: '#FFF3E0',
    keys: ['enerc', 'protcnt', 'fatce', 'choavldf', 'fibtg', 'cholc', 'water']
  },
  {
    title: 'Vitamins',
    icon: '💊',
    iconBg: '#E8F5E9',
    keys: ['retol', 'thia', 'ribf', 'nia', 'pantac', 'vitb6c', 'folsum', 'vitc', 'tocpha', 'vitk1']
  },
  {
    title: 'Minerals',
    icon: '⛏️',
    iconBg: '#E3F2FD',
    keys: ['ca', 'fe', 'mg', 'p', 'k', 'na', 'zn', 'cu', 'mn', 'se']
  },
  {
    title: 'Fats Breakdown',
    icon: '🧈',
    iconBg: '#FFF8E1',
    keys: ['fasat', 'fams', 'fapu']
  },
  {
    title: 'Sugars & Starch',
    icon: '🍯',
    iconBg: '#FCE4EC',
    keys: ['fsugar', 'starch']
  }
];


// Language abbreviation map for human-readable names
const LANG_ABBR = {
  'A': 'Assamese', 'B': 'Bengali', 'E': 'English', 'G': 'Gujarati',
  'H': 'Hindi', 'Kan': 'Kannada', 'Kash': 'Kashmiri', 'Kh': 'Khasi',
  'Kon': 'Konkani', 'Mal': 'Malayalam', 'M': 'Manipuri', 'Mar': 'Marathi',
  'N': 'Nepali', 'O': 'Odia', 'P': 'Punjabi', 'S': 'Sanskrit',
  'Tam': 'Tamil', 'Tel': 'Telugu', 'U': 'Urdu'
};

// ===== STATE =====
let currentFood = null;
let mealItems = []; // [{food, grams}]
let deferredInstallPrompt = null;
let isDesktopMode = false;

const ENERGY_PROFILES = {
  'adult_m': { sedentary: 2110, moderate: 2710, heavy: 3470 },
  'adult_f': { sedentary: 1660, moderate: 2130, heavy: 2720 },
  'teen_m': { sedentary: 2500, moderate: 2700, heavy: 3000 },
  'teen_f': { sedentary: 2100, moderate: 2300, heavy: 2500 },
  'child': { sedentary: 1500, moderate: 1700, heavy: 1900 }
};

let userProfile = {
  group: 'adult_m',
  activity: 'sedentary',
  weight: ''
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initNavigation();
  initViewToggle();
  initSearch();
  initQueries();
  initGroupGrid();
  initMealScreen();
  initInstall();
  initPortionModal();
  initProfileModal();
  initCustomQuery();
  loadMealFromStorage();
});


// ===== SERVICE WORKER =====
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}


// ===== NAVIGATION =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const screenId = btn.dataset.screen;
      switchScreen(screenId);
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) { screen.classList.add('active'); }
  // Show/hide search based on screen
  const searchContainer = document.querySelector('.search-container');
  if (screenId === 'screenHome' || screenId === 'screenDetail') {
    searchContainer.style.display = '';
  } else {
    searchContainer.style.display = 'none';
  }
  window.scrollTo(0, 0);
}


// ===== VIEW TOGGLE =====
function initViewToggle() {
  const btnMobile = document.getElementById('btnMobileView');
  const btnDesktop = document.getElementById('btnDesktopView');

  // Restore saved preference
  const saved = localStorage.getItem('nutrisense_viewmode');
  if (saved === 'desktop') {
    setViewMode(true);
  }

  btnMobile.addEventListener('click', () => setViewMode(false));
  btnDesktop.addEventListener('click', () => setViewMode(true));
}

function setViewMode(desktop) {
  isDesktopMode = desktop;
  document.body.classList.toggle('desktop-mode', desktop);
  document.getElementById('btnMobileView').classList.toggle('active', !desktop);
  document.getElementById('btnDesktopView').classList.toggle('active', desktop);
  localStorage.setItem('nutrisense_viewmode', desktop ? 'desktop' : 'mobile');

  // Re-render macro rings if on detail screen (canvas resize)
  if (currentFood && document.getElementById('screenDetail').classList.contains('active')) {
    setTimeout(() => renderMacroRings(currentFood), 100);
  }
  showToast(desktop ? 'Desktop view enabled' : 'Mobile view enabled');
}


// ===== SEARCH =====
function initSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    clearBtn.classList.toggle('visible', q.length > 0);
    if (q.length < 2) {
      hideSearchResults();
      return;
    }
    debounce = setTimeout(() => performSearch(q), 200);
  });

  input.addEventListener('focus', () => {
    // Switch to home screen if not there
    if (!document.getElementById('screenHome').classList.contains('active')) {
      switchScreen('screenHome');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-screen="screenHome"]').classList.add('active');
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.remove('visible');
    hideSearchResults();
    input.focus();
  });
}

function performSearch(query) {
  const q = query.toLowerCase();
  const results = IFCT_DATA.foods.filter(f => {
    return f.name.toLowerCase().includes(q) ||
           f.scie.toLowerCase().includes(q) ||
           f.lang.toLowerCase().includes(q) ||
           f.code.toLowerCase().includes(q) ||
           f.grup.toLowerCase().includes(q);
  }).slice(0, 50);

  showSearchResults(results, query);
}

function showSearchResults(results, query, isGroup = false) {
  const container = document.getElementById('searchResults');
  const countEl = document.getElementById('resultsCount');
  const listEl = document.getElementById('foodList');
  const groupGrid = document.querySelector('.group-grid');
  const banner = document.querySelector('.who-banner');
  const sectionTitle = document.querySelector('#screenHome .section-title');
  const langTip = document.getElementById('searchLangTip');

  container.style.display = 'block';
  if (groupGrid) groupGrid.style.display = 'none';
  if (banner) banner.style.display = 'none';
  if (sectionTitle) sectionTitle.style.display = 'none';

  // Add Back to Groups button if it's a group search
  let backBtnHtml = '';
  if (isGroup) {
    backBtnHtml = `
      <button class="group-back-btn" onclick="hideSearchResults(); document.getElementById('searchInput').value=''; document.getElementById('searchClear').classList.remove('visible');">
        <span>←</span> Back to All Groups
      </button>`;
  }

  // Show multilingual tip when searching
  const q = query.toLowerCase();
  const hasLangMatch = results.some(f =>
    !f.name.toLowerCase().includes(q) &&
    !f.code.toLowerCase().includes(q) &&
    f.lang.toLowerCase().includes(q)
  );
  langTip.style.display = hasLangMatch ? 'flex' : 'none';

  if (results.length === 0) {
    countEl.textContent = '';
    langTip.style.display = 'none';
    listEl.innerHTML = `
      ${backBtnHtml}
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No foods found</div>
        <div class="no-results-hint">Try searching in Hindi, Tamil, Bengali, Kannada, or by scientific name</div>
      </div>`;
    return;
  }

  countEl.textContent = `${results.length} food${results.length !== 1 ? 's' : ''} found`;
  listEl.innerHTML = backBtnHtml + results.map(f => renderFoodItem(f, q)).join('');

  listEl.querySelectorAll('.food-item').forEach(el => {
    el.addEventListener('click', () => {
      const code = el.dataset.code;
      const food = IFCT_DATA.foods.find(f => f.code === code);
      if (food) showFoodDetail(food);
    });
  });
}

function hideSearchResults() {
  const container = document.getElementById('searchResults');
  const groupGrid = document.querySelector('.group-grid');
  const banner = document.querySelector('.who-banner');
  const sectionTitle = document.querySelector('#screenHome .section-title');

  container.style.display = 'none';
  if (groupGrid) groupGrid.style.display = '';
  if (banner) banner.style.display = '';
  if (sectionTitle) sectionTitle.style.display = '';
}

function findLangMatch(langStr, query) {
  if (!langStr) return null;
  const q = query.toLowerCase();
  // Parse the lang string: format is "A. name; B. name; ..."
  const parts = langStr.split(';').map(s => s.trim());
  for (const part of parts) {
    if (part.toLowerCase().includes(q)) {
      // Extract language abbreviation
      const dotIdx = part.indexOf('.');
      if (dotIdx > 0) {
        const abbr = part.substring(0, dotIdx).trim();
        const name = part.substring(dotIdx + 1).trim();
        const langName = LANG_ABBR[abbr] || abbr;
        return { lang: langName, name: name };
      }
    }
  }
  return null;
}

function getDietTag(tags) {
  if (!tags) return '';
  if (tags.includes('vegetarian')) return '<span class="food-diet-tag tag-veg">Veg</span>';
  if (tags.includes('eggetarian')) return '<span class="food-diet-tag tag-egg">Egg</span>';
  if (tags.includes('fishetarian')) return '<span class="food-diet-tag tag-fish">Fish</span>';
  if (tags.includes('nonveg')) return '<span class="food-diet-tag tag-nonveg">Non-Veg</span>';
  return '';
}

function renderFoodItem(f, query) {
  const kcal = f.n.enerc ? Math.round(f.n.enerc * 0.239006) : 0;
  let langMatchHtml = '';
  if (query) {
    const q = query.toLowerCase();
    // Check if the match was via local language
    if (!f.name.toLowerCase().includes(q) &&
        !f.code.toLowerCase().includes(q) &&
        !f.scie.toLowerCase().includes(q)) {
      const match = findLangMatch(f.lang, q);
      if (match) {
        langMatchHtml = `<span class="lang-match"><span class="lang-tag">${match.lang}</span>${match.name}</span>`;
      }
    }
  }
  const isVeg = !/^[MNOPQRS]/.test(f.code);
  const vegClass = isVeg ? 'food-name-veg' : 'food-name-nonveg';
  const dietTag = getDietTag(f.tags);

  return `
    <li class="food-item" data-code="${f.code}">
      <div class="food-code-badge">${f.code}</div>
      <div class="food-info">
        <div class="food-name ${vegClass}">${f.name}${dietTag}</div>
        <div class="food-scie">${f.scie || f.grup}</div>
        ${langMatchHtml}
      </div>
      <div class="food-energy">
        <div class="food-kcal">${kcal}</div>
        <div class="food-kcal-label">kcal (per 100g)</div>
      </div>
      <span class="food-arrow">›</span>
    </li>`;
}


// ===== TOP QUERIES CHART =====
let currentQueryChart = null;

function initQueries() {
  window.runSmartQuery = function(nKey, cat, title) {
    document.getElementById('queryChartContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderQueryChart(nKey, cat, title);
  };
  
  // Render default smart query on load
  setTimeout(() => window.runSmartQuery('vitc', 'all', 'Top Vitamin C Foods'), 500);
}

function renderQueryChart(nKey = 'protcnt', cat = 'all', title = 'Top Foods') {
  const container = document.getElementById('queryChartContainer');
  const canvas = document.getElementById('queryCanvas');
  const meta = IFCT_DATA.meta[nKey];
  
  if (!meta) return;
  container.style.display = 'block';
  document.getElementById('queryChartTitle').textContent = title;

  // Filter foods by Category
  let filtered = IFCT_DATA.foods.filter(f => f.n[nKey] && f.n[nKey] > 0);
  
  if (cat === 'veg') {
    filtered = filtered.filter(f => !/^[MNOPQRS]/.test(f.code));
  } else if (cat === 'nonveg') {
    filtered = filtered.filter(f => /^[MNOPQRS]/.test(f.code));
  } else if (cat !== 'all') {
    // Specific Group Code (A-T)
    filtered = filtered.filter(f => f.code.startsWith(cat));
  }

  // Find top 10
  const sorted = filtered.sort((a, b) => b.n[nKey] - a.n[nKey]).slice(0, 10);
  
  if (currentQueryChart) {
    currentQueryChart.destroy();
  }

  if (sorted.length === 0) {
    return;
  }

  const labels = sorted.map(f => f.name.length > 20 ? f.name.substring(0, 20) + '...' : f.name);
  const dataVals = sorted.map(f => f.n[nKey]);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 350);
  gradient.addColorStop(0, 'rgba(0, 169, 157, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 169, 157, 0.0)');

  currentQueryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${meta.name}`,
        data: dataVals,
        backgroundColor: gradient,
        borderColor: '#00A99D',
        borderWidth: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#00A99D',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { bottom: 30 } // Ensure labels are not cut off
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 40, 64, 0.95)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (ctx) => sorted[ctx[0].dataIndex].name,
            label: (ctx) => `${formatNum(ctx.raw)} ${meta.unit}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 11, family: 'Inter, sans-serif' } }
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          showFoodDetail(sorted[index]);
        }
      }
    }
  });
}

// ===== FOOD GROUP GRID =====
function initGroupGrid() {
  const grid = document.getElementById('groupGrid');
  grid.innerHTML = IFCT_DATA.groups.map(g => `
    <div class="group-card" data-group="${g.code}">
      <span class="group-emoji">${GROUP_EMOJIS[g.code] || '📋'}</span>
      <div class="group-name">${g.name}</div>
      <div class="group-count">${g.count} foods</div>
    </div>
  `).join('');

  grid.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => {
      const groupCode = card.dataset.group;
      searchByGroup(groupCode);
    });
  });
}

function searchByGroup(groupCode) {
  const group = IFCT_DATA.groups.find(g => g.code === groupCode);
  if (!group) return;
  const results = IFCT_DATA.foods.filter(f => f.code.startsWith(groupCode));
  const input = document.getElementById('searchInput');
  input.value = group.name;
  document.getElementById('searchClear').classList.add('visible');
  showSearchResults(results, group.name, true);
}




// ===== FOOD DETAIL =====
function showFoodDetail(food) {
  currentFood = food;
  switchScreen('screenDetail');

  // Hero
  document.getElementById('detailName').textContent = food.name;
  document.getElementById('detailScie').textContent = food.scie || '';
  document.getElementById('detailGroup').textContent = food.grup;

  // Back button
  document.getElementById('detailBack').onclick = () => {
    switchScreen('screenHome');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-screen="screenHome"]').classList.add('active');
  };

  // Add to meal
  document.getElementById('detailAddMeal').onclick = () => openPortionModal(food);

  // Macro rings
  renderMacroRings(food);

  // Nutrient sections
  renderNutrientSections(food);
}

function renderMacroRings(food) {
  const container = document.getElementById('macroRings');
  const macros = [
    { key: 'protcnt', label: 'Protein', color: MACRO_COLORS.protcnt, rda: 50 },
    { key: 'fatce', label: 'Fat', color: MACRO_COLORS.fatce, rda: 65 },
    { key: 'choavldf', label: 'Carbs', color: MACRO_COLORS.choavldf, rda: 300 },
    { key: 'fibtg', label: 'Fiber', color: MACRO_COLORS.fibtg, rda: 25 }
  ];

  container.innerHTML = macros.map(m => {
    const val = food.n[m.key] || 0;
    const pct = Math.min(100, (val / m.rda) * 100);
    const unit = IFCT_DATA.meta[m.key]?.unit || 'g';
    return `
      <div class="macro-ring">
        <canvas class="ring-canvas" width="136" height="136" data-pct="${pct}" data-color="${m.color}"></canvas>
        <div class="macro-value">${formatNum(val)} ${unit}</div>
        <div class="macro-label">${m.label}</div>
      </div>`;
  }).join('');

  // Animate rings
  setTimeout(() => {
    container.querySelectorAll('.ring-canvas').forEach(canvas => {
      drawRing(canvas, parseFloat(canvas.dataset.pct), canvas.dataset.color);
    });
  }, 100);
}

function drawRing(canvas, pct, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, r = 54, lw = 10;

  ctx.clearRect(0, 0, w, h);

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,40,64,0.07)';
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Foreground ring
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * Math.min(pct, 100) / 100);
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center text
  ctx.fillStyle = '#1A2B3D';
  ctx.font = '700 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(pct)}%`, cx, cy - 4);

  ctx.fillStyle = '#8899AA';
  ctx.font = '500 9px Inter, sans-serif';
  ctx.fillText('RDA', cx, cy + 14);
}

function renderNutrientSections(food) {
  const container = document.getElementById('nutrientSections');
  container.innerHTML = NUTRIENT_GROUPS.map(group => {
    const rows = group.keys.map(key => {
      const meta = IFCT_DATA.meta[key];
      if (!meta) return '';
      const val = food.n[key] || 0;
      let displayVal = val;
      let unit = meta.unit;

      // For energy, show kcal too
      if (key === 'enerc') {
        const kcal = Math.round(val * 0.239006);
        return `
          <div class="nutrient-row">
            <span class="nutrient-name">${meta.name}</span>
            <span class="nutrient-val">${formatNum(val)} kJ / ${kcal} kcal</span>
            <div class="nutrient-bar-wrap"><div class="nutrient-bar bar-mid" style="width:100%"></div></div>
          </div>`;
      }

      // RDA bar
      let barPct = 0, barClass = 'bar-mid';
      if (meta.rda && meta.rda > 0) {
        barPct = Math.min(100, (val / meta.rda) * 100);
        if (barPct < 15) barClass = 'bar-low';
        else if (barPct < 80) barClass = 'bar-mid';
        else if (barPct <= 100) barClass = 'bar-high';
        else barClass = 'bar-over';
      }

      return `
        <div class="nutrient-row">
          <span class="nutrient-name">${meta.name}</span>
          <span class="nutrient-val">${formatNum(displayVal)} ${unit}</span>
          <div class="nutrient-bar-wrap">
            <div class="nutrient-bar ${barClass}" style="width:${barPct}%"></div>
          </div>
        </div>`;
    }).filter(Boolean).join('');

    if (!rows) return '';

    return `
      <div class="nutrient-section">
        <div class="nutrient-section-title">
          <div class="nutrient-section-icon" style="background:${group.iconBg}">${group.icon}</div>
          ${group.title}
        </div>
        ${rows}
      </div>`;
  }).join('');
}


// ===== MEAL CALCULATOR =====
function initMealScreen() {
  document.getElementById('mealAddBtn').addEventListener('click', () => {
    switchScreen('screenHome');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-screen="screenHome"]').classList.add('active');
    document.getElementById('searchInput').focus();
  });

  document.getElementById('mealClearBtn').addEventListener('click', () => {
    if (mealItems.length === 0) return;
    if (confirm('Clear all foods from your meal?')) {
      clearAllMeal();
    }
  });
}

function clearAllMeal() {
  mealItems = [];
  saveMealToStorage();
  renderMeal();
  showToast('Meal cleared');
}

function addToMeal(food, grams) {
  mealItems.push({ food, grams });
  saveMealToStorage();
  renderMeal();
  showToast(`${food.name} added (${grams}g)`);
}

function removeMealItem(index) {
  mealItems.splice(index, 1);
  saveMealToStorage();
  renderMeal();
}

function updateMealQty(index, delta) {
  const item = mealItems[index];
  item.grams = Math.max(10, item.grams + delta);
  saveMealToStorage();
  renderMeal();
}

function renderMeal() {
  const itemsEl = document.getElementById('mealItems');
  const summaryEl = document.getElementById('mealNutrientSummary');

  // Show/hide clear all button
  document.getElementById('mealClearWrap').style.display = mealItems.length > 0 ? '' : 'none';

  if (mealItems.length === 0) {
    itemsEl.innerHTML = `
      <div class="meal-empty">
        <div class="meal-empty-icon">🍽️</div>
        <div class="meal-empty-text">No foods added yet</div>
        <div class="meal-empty-hint">Search and tap + to add foods to your meal</div>
      </div>`;
    document.getElementById('mealTotalKcal').textContent = '0';
    document.getElementById('mealMacrosBar').innerHTML = '';
    document.getElementById('mealMacrosLegend').innerHTML = '';
    summaryEl.innerHTML = '';
    document.getElementById('dgiCard').style.display = 'none';
    return;
  }

  // Calculate totals
  const totals = {};
  Object.keys(IFCT_DATA.meta).forEach(key => totals[key] = 0);
  
  mealItems.forEach(item => {
    const factor = item.grams / 100;
    Object.keys(item.food.n).forEach(key => {
      totals[key] = (totals[key] || 0) + item.food.n[key] * factor;
    });
  });

  // Total kcal
  const totalKcal = Math.round((totals.enerc || 0) * 0.239006);
  document.getElementById('mealTotalKcal').textContent = totalKcal.toLocaleString();

  const macroRda = [
    { key: 'protcnt', label: 'Protein', color: MACRO_COLORS.protcnt, rda: 50 },
    { key: 'fatce', label: 'Fat', color: MACRO_COLORS.fatce, rda: 65 },
    { key: 'choavldf', label: 'Carbs', color: MACRO_COLORS.choavldf, rda: 300 }
  ];

  document.getElementById('mealMacrosBar').style.display = 'none';
  document.getElementById('mealMacrosLegend').innerHTML = `
    <div class="meal-header-rings">
      ${macroRda.map(m => {
        const val = totals[m.key] || 0;
        const pct = Math.min(100, (val / m.rda) * 100);
        const unit = IFCT_DATA.meta[m.key]?.unit || 'g';
        return `
          <div class="header-macro-ring">
            <canvas class="ring-canvas header-ring" width="144" height="144" data-pct="${pct}" data-color="#FFFFFF"></canvas>
            <div class="macro-value">${formatNum(val)}${unit}</div>
            <div class="macro-label">${m.label}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  // Animate header rings
  setTimeout(() => {
    document.querySelectorAll('.header-macro-ring .ring-canvas').forEach((canvas, i) => {
      const macro = macroRda[i];
      drawRing(canvas, parseFloat(canvas.dataset.pct), macro.color);
    });
  }, 150);

  // DGI 2024 My Plate Evaluation
  const dgiCard = document.getElementById('dgiCard');
  if (totalKcal > 0) {
    dgiCard.style.display = 'block';
    
    // Dynamic Energy Requirement
    const eer = ENERGY_PROFILES[userProfile.group]?.[userProfile.activity] || 2000;
    const scale = eer / 2000;

    // Group targets (grams) scaled from default 2000Kcal diet
    const MY_PLATE = [
      { id: 'cereals', name: 'Cereals & Millets', target: Math.round(240 * scale), color: '#F1C40F', codes: ['A'] },
      { id: 'pulses', name: 'Pulses & Legumes', target: Math.round(90 * scale), color: '#E67E22', codes: ['B'] },
      { id: 'veg', name: 'Vegetables', target: Math.round(350 * scale), color: '#2ECC71', codes: ['C', 'D', 'F', 'J'] },
      { id: 'fruits', name: 'Fruits', target: Math.round(150 * scale), color: '#E74C3C', codes: ['E'] },
      { id: 'dairy', name: 'Milk & Dairy', target: Math.round(300 * scale), color: '#3498DB', codes: ['L'] },
      { id: 'fats', name: 'Fats & Oils', target: Math.round(27 * scale), color: '#F39C12', codes: ['T'] },
      { id: 'meat', name: 'Meat/Fish/Egg', target: Math.round(60 * scale), color: '#C0392B', codes: ['M', 'N', 'O', 'P', 'Q', 'R', 'S'] }
    ];

    // Calculate consumed grams per group
    const consumed = {};
    MY_PLATE.forEach(g => consumed[g.id] = 0);

    mealItems.forEach(item => {
      const codeType = item.food.code.charAt(0); // e.g. A, B, C
      MY_PLATE.forEach(g => {
        if (g.codes.includes(codeType)) {
          consumed[g.id] += item.grams;
        }
      });
    });

    const statusEl = document.getElementById('dgiStatus');
    const feedbackEl = document.getElementById('dgiFeedback');
    statusEl.textContent = 'My Plate for the Day (DGI 2024)';
    statusEl.className = 'dgi-status balanced';

    let plateHtml = `<div class="dgi-plate-bars" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">`;
    
    MY_PLATE.forEach(g => {
      const gCon = consumed[g.id];
      if (gCon > 0 || g.target > 0) {
        const pct = Math.min(100, (gCon / g.target) * 100);
        const overLimit = gCon > g.target;
        const barColor = overLimit ? '#E74C3C' : g.color;
        
        plateHtml += `
          <div class="dgi-plate-row" style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #1E293B;">
              <span>${g.name}</span>
              <span style="color: ${overLimit ? '#E74C3C' : '#0F172A'}">${Math.round(gCon)}g <span style="color:#64748B; font-weight:500;">/ ${g.target}g</span></span>
            </div>
            <div style="height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background: ${barColor}; transition: width 0.3s ease;"></div>
            </div>
            ${overLimit ? `<div style="font-size: 11px; color: #E74C3C; font-weight: 500;">Exceeds recommended daily limit.</div>` : ''}
          </div>
        `;
      }
    });
    
    plateHtml += `</div>`;
    feedbackEl.innerHTML = plateHtml;

  } else {
    dgiCard.style.display = 'none';
  }

  // Nutrient summary tiles
  const macroSummary = [
    { key: 'protcnt', label: 'Protein', color: MACRO_COLORS.protcnt, rda: 50 },
    { key: 'fatce', label: 'Fat', color: MACRO_COLORS.fatce, rda: 65 },
    { key: 'choavldf', label: 'Carbs', color: MACRO_COLORS.choavldf, rda: 300 },
    { key: 'fibtg', label: 'Fiber', color: MACRO_COLORS.fibtg, rda: 25 }
  ];

  summaryEl.innerHTML = `
    <div class="section-title">Total Nutritional Summary</div>
    <div class="meal-rda-grid">
      ${macroSummary.map(m => {
        const val = totals[m.key] || 0;
        const pct = Math.min(100, (val / m.rda) * 100);
        const unit = IFCT_DATA.meta[m.key]?.unit || 'g';
        return `
          <div class="meal-rda-tile">
            <canvas class="ring-canvas" width="136" height="136" data-pct="${pct}" data-color="${m.color}"></canvas>
            <div class="macro-value">${formatNum(val)} ${unit}</div>
            <div class="macro-label">${m.label}</div>
          </div>`;
      }).join('')}
    </div>
    <div style="margin-top:24px;"></div>
    ${NUTRIENT_GROUPS.map(group => {
      // Show other nutrients in simple list
      if (group.title === 'Energy & Macronutrients') return '';
      const rows = group.keys.map(key => {
        const meta = IFCT_DATA.meta[key];
        if (!meta) return '';
        const val = totals[key] || 0;
        let barPct = 0, barClass = 'bar-mid';
        if (meta.rda && meta.rda > 0) {
          barPct = Math.min(100, (val / meta.rda) * 100);
          if (barPct < 15) barClass = 'bar-low';
          else if (barPct < 80) barClass = 'bar-mid';
          else if (barPct <= 100) barClass = 'bar-high';
          else barClass = 'bar-over';
        }
        return `
          <div class="nutrient-row">
            <span class="nutrient-name">${meta.name}</span>
            <span class="nutrient-val">${formatNum(val)} ${meta.unit}</span>
            <div class="nutrient-bar-wrap">
              <div class="nutrient-bar ${barClass}" style="width:${barPct}%"></div>
            </div>
          </div>`;
      }).filter(Boolean).join('');
      if (!rows) return '';
      return `
        <div class="nutrient-section">
          <div class="nutrient-section-title">
            <div class="nutrient-section-icon" style="background:${group.iconBg}">${group.icon}</div>
            ${group.title}
          </div>
          ${rows}
        </div>`;
    }).join('')}
  `;

  // Animate rings in summary
  setTimeout(() => {
    summaryEl.querySelectorAll('.ring-canvas').forEach(canvas => {
      drawRing(canvas, parseFloat(canvas.dataset.pct), canvas.dataset.color);
    });
  }, 100);

  // Render items
  itemsEl.innerHTML = mealItems.map((item, i) => `
    <div class="meal-item">
      <div class="food-code-badge" style="width:36px;height:36px;font-size:10px">${item.food.code}</div>
      <div class="meal-item-info">
        <div class="meal-item-name">${item.food.name}</div>
        <div class="meal-item-detail">${Math.round((item.food.n.enerc||0) * item.grams/100 * 0.239006)} kcal</div>
      </div>
      <div class="meal-qty-controls">
        <button class="qty-btn" onclick="updateMealQty(${i}, -25)">−</button>
        <span class="qty-value">${item.grams}g</span>
        <button class="qty-btn" onclick="updateMealQty(${i}, 25)">+</button>
      </div>
      <button class="meal-item-remove" onclick="removeMealItem(${i})">✕</button>
    </div>
  `).join('');

  // The summary is already rendered with rings above.
}


// ===== PORTION MODAL =====
let portionFood = null;

function initPortionModal() {
  const modal = document.getElementById('portionModal');
  const input = document.getElementById('portionInput');
  const confirmBtn = document.getElementById('portionConfirm');

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePortionModal();
  });

  document.getElementById('portionCancel').addEventListener('click', closePortionModal);

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      input.value = btn.dataset.val;
    });
  });

  confirmBtn.addEventListener('click', () => {
    const grams = parseInt(input.value) || 100;
    if (portionFood) {
      addToMeal(portionFood, grams);
    }
    closePortionModal();
  });
}

function openPortionModal(food) {
  portionFood = food;
  document.getElementById('portionModalTitle').textContent = food.name;
  document.getElementById('portionInput').value = 100;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('.preset-btn[data-val="100"]').classList.add('selected');
  document.getElementById('portionModal').classList.add('active');
}

function closePortionModal() {
  document.getElementById('portionModal').classList.remove('active');
  portionFood = null;
}

// ===== PROFILE & CUSTOM QUERY MODALS =====

function initProfileModal() {
  const btn = document.getElementById('btnProfileSettings');
  const modal = document.getElementById('profileModal');
  const cancelBtn = document.getElementById('profileCancel');
  const saveBtn = document.getElementById('profileSave');

  if(btn) btn.addEventListener('click', () => {
    document.getElementById('profileGroup').value = userProfile.group;
    document.getElementById('profileActivity').value = userProfile.activity;
    document.getElementById('profileWeight').value = userProfile.weight || '';
    modal.style.display = 'flex';
  });

  if(cancelBtn) cancelBtn.addEventListener('click', () => modal.style.display = 'none');

  if(saveBtn) saveBtn.addEventListener('click', () => {
    userProfile.group = document.getElementById('profileGroup').value;
    userProfile.activity = document.getElementById('profileActivity').value;
    userProfile.weight = document.getElementById('profileWeight').value;
    localStorage.setItem('nutriProfile', JSON.stringify(userProfile));
    modal.style.display = 'none';
    showToast('Profile updated! MyPlate targets adjusted.');
    if (mealItems.length > 0) renderMeal();
  });
  
  try {
    const saved = localStorage.getItem('nutriProfile');
    if(saved) {
      userProfile = JSON.parse(saved);
    }
  } catch(e){}
}

function initCustomQuery() {
  const btn = document.getElementById('btnCustomQuery');
  const modal = document.getElementById('customQueryModal');
  const cancelBtn = document.getElementById('advQueryCancel');
  const runBtn = document.getElementById('advQueryRun');
  
  const nutSelect = document.getElementById('advQueryNutrient');
  const groupSelect = document.getElementById('advQueryGroups');

  if(btn) btn.addEventListener('click', () => {
    // Populate nutrients if empty
    if(nutSelect.children.length === 0 && IFCT_DATA.meta) {
      const allKeys = Object.keys(IFCT_DATA.meta).sort((a,b) => IFCT_DATA.meta[a].name.localeCompare(IFCT_DATA.meta[b].name));
      nutSelect.innerHTML = allKeys.map(k => `<option value="${k}">${IFCT_DATA.meta[k].name} (${IFCT_DATA.meta[k].unit})</option>`).join('');
      groupSelect.innerHTML = IFCT_DATA.groups.map(g => `<option value="${g.code}">${g.name}</option>`).join('');
    }
    modal.style.display = 'flex';
  });

  if(cancelBtn) cancelBtn.addEventListener('click', () => modal.style.display = 'none');
  
  if(runBtn) runBtn.addEventListener('click', () => {
    const k = nutSelect.value;
    const c = document.getElementById('advQueryCategory').value;
    let name = IFCT_DATA.meta[k].name;
    if (c !== 'all' && c !== 'veg' && c !== 'nonveg') {
      const g = IFCT_DATA.groups.find(x => x.code === c);
      if (g) name += ' in ' + g.name;
    } else if (c === 'veg') { name += ' (Veg)'; }
    else if (c === 'nonveg') { name += ' (Animal)'; }
    
    modal.style.display = 'none';
    window.runSmartQuery(k, c, name);
  });
}


// ===== PWA INSTALL =====
function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('btnInstallHeader').style.display = 'flex';
  });

  document.getElementById('btnInstall').addEventListener('click', promptInstall);
  document.getElementById('btnInstallHeader').addEventListener('click', promptInstall);

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('btnInstallHeader').style.display = 'none';
    document.getElementById('installStatus').innerHTML = '✅ App installed successfully!';
    showToast('NutriSense installed! 🎉');
  });
}

function promptInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      deferredInstallPrompt = null;
    });
  } else {
    showToast('Open in Chrome/Edge/Safari to install');
  }
}


// ===== STORAGE =====
function saveMealToStorage() {
  try {
    const data = mealItems.map(item => ({ code: item.food.code, grams: item.grams }));
    localStorage.setItem('nutrisense_meal', JSON.stringify(data));
  } catch (e) {}
}

function loadMealFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem('nutrisense_meal') || '[]');
    mealItems = data.map(d => {
      const food = IFCT_DATA.foods.find(f => f.code === d.code);
      return food ? { food, grams: d.grams } : null;
    }).filter(Boolean);
    renderMeal();
  } catch (e) {
    mealItems = [];
    renderMeal();
  }
}


// ===== UTILITIES =====
function formatNum(n) {
  if (n === 0) return '0';
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}


// Make functions available globally for onclick handlers
window.updateMealQty = updateMealQty;
window.removeMealItem = removeMealItem;
window.clearAllMeal = clearAllMeal;
