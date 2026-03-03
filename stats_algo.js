/**
 * stats_algo.js
 * Core logic for the EpiSense Basic Statistical Tests dashboard.
 * Requires PapaParse and jStat to be loaded in the DOM.
 */

// Global state
let currentData = null; // Array of objects
let columns = []; // Array of strings
let varStats = {}; // Objects holding descriptive stats per column
let summaryResultChart = null; // Holds the Chart.js instance for the Summary Stats Mode

// 1. Data Loading & Parsing
function loadData() {
    const fileInput = document.getElementById('csv-file');
    const textInput = document.getElementById('csv-text').value.trim();
    const statusDiv = document.getElementById('data-status');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = file.name.toLowerCase();
        statusDiv.innerText = "Parsing file...";

        if (fileName.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: handleParsedData,
                error: (err) => { statusDiv.innerHTML = `<span style="color:#ff5252">Error parsing CSV: ${err}</span>`; }
            });
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                    handleParsedData({ data: json });
                } catch (err) {
                    statusDiv.innerHTML = `<span style="color:#ff5252">Error parsing Excel: ${err.message}</span>`;
                }
            };
            reader.onerror = function () {
                statusDiv.innerHTML = `<span style="color:#ff5252">Error reading file.</span>`;
            };
            reader.readAsArrayBuffer(file);
        } else {
            statusDiv.innerHTML = `<span style="color:#ff5252">Unsupported file format.</span>`;
        }
    } else if (textInput) {
        statusDiv.innerText = "Parsing text...";
        Papa.parse(textInput, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: handleParsedData,
            error: (err) => { statusDiv.innerHTML = `<span style="color:#ff5252">Error parsing text: ${err}</span>`; }
        });
    } else {
        statusDiv.innerHTML = `<span style="color:#ff5252">Please upload a file or paste Data.</span>`;
    }
}

function handleParsedData(results) {
    const statusDiv = document.getElementById('data-status');
    if (!results.data || results.data.length === 0) {
        statusDiv.innerHTML = `<span style="color:#ff5252">No data found or invalid format. Ensure it has headers.</span>`;
        return;
    }

    currentData = results.data;
    columns = Object.keys(currentData[0]);
    statusDiv.innerHTML = `<span style="color:#00e676">Successfully loaded ${currentData.length} rows and ${columns.length} columns.</span>`;

    // Reset UI
    document.getElementById('desc-card').style.display = 'block';
    document.getElementById('normality-checker-card').style.display = 'block';
    document.getElementById('test-card').style.display = 'block';
    document.getElementById('result-box').style.display = 'none';

    generateDescriptiveStats();
    populateTestSelector();

    // Populate Group Select & Normality Dropdown
    const normSelect = document.getElementById('normality-var-select');
    const groupSelect = document.getElementById('desc-group-select');

    if (normSelect) normSelect.innerHTML = '<option value="" disabled selected>-- Select Continuous Variable --</option>';
    if (groupSelect) groupSelect.innerHTML = '<option value="">-- None (Whole Dataset) --</option>';

    columns.forEach(col => {
        if (varStats[col] && varStats[col].type === 'Continuous') {
            if (normSelect) normSelect.innerHTML += `<option value="${col}">${col}</option>`;
        }
        if (varStats[col] && varStats[col].type === 'Categorical') {
            if (groupSelect) groupSelect.innerHTML += `<option value="${col}">${col}</option>`;
        }
    });
}

// Clear Data Function
function resetData() {
    currentData = null;
    columns = [];
    varStats = {};

    document.getElementById('csv-file').value = '';
    document.getElementById('csv-text').value = '';
    document.getElementById('data-status').innerText = 'Waiting for raw data...';

    document.getElementById('desc-card').style.display = 'none';
    const normCard = document.getElementById('normality-checker-card');
    if (normCard) normCard.style.display = 'none';

    document.getElementById('test-card').style.display = 'none';
    document.getElementById('result-box').style.display = 'none';

    const tbody = document.querySelector('#stats-table tbody');
    if (tbody) tbody.innerHTML = '';
}

// 2. Descriptive Stats & Normality
function generateDescriptiveStats() {
    const tbody = document.querySelector('#stats-table tbody');
    const thead = document.querySelector('#stats-table thead tr');
    const groupCol = document.getElementById('desc-group-select')?.value;

    tbody.innerHTML = '';
    const shouldGroup = !!groupCol;


    // Update Header to show Group column if grouping is active
    if (shouldGroup) {
        thead.innerHTML = `
            <th>Variable</th>
            <th>Group</th>
            <th>Type</th>
            <th>N</th>
            <th>Min / Max</th>
            <th>Mean / Mode</th>
            <th>Median</th>
            <th>Std Dev</th>
            <th>IQR</th>
            <th>Skewness</th>
            <th>Kurtosis</th>
        `;
    } else {
        thead.innerHTML = `
            <th>Variable</th>
            <th>Type</th>
            <th>N</th>
            <th>Min / Max</th>
            <th>Mean / Mode</th>
            <th>Median</th>
            <th>Std Dev</th>
            <th>IQR</th>
            <th>Skewness</th>
            <th>Kurtosis</th>
        `;
    }

    // Helper to calculate stats for a specific subset of values
    const getStats = (col, dataSubset) => {
        const rawVals = dataSubset.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
        const isNumeric = rawVals.length > 0 && rawVals.every(v => typeof v === 'number');
        const n = rawVals.length;

        let stats = {
            col: col,
            type: isNumeric ? 'Continuous' : 'Categorical',
            n: n,
            mean: '-', median: '-', sd: '-', min: '-', max: '-', iqr: '-',
            skew: '-', kurt: '-', normality: '-'
        };

        if (n > 0) {
            if (isNumeric) {
                const mean = jStat.mean(rawVals);
                const median = jStat.median(rawVals);
                const sd = jStat.stdev(rawVals, true);
                const min = jStat.min(rawVals);
                const max = jStat.max(rawVals);
                const q1 = jStat.percentile(rawVals, 0.25);
                const q3 = jStat.percentile(rawVals, 0.75);
                const iqr = q3 - q1;

                let skew = 0; let kurt = 0;
                if (n > 2 && sd > 0) {
                    const zDiffs = rawVals.map(v => (v - mean) / sd);
                    skew = jStat.sum(zDiffs.map(z => Math.pow(z, 3))) / n;
                    kurt = (jStat.sum(zDiffs.map(z => Math.pow(z, 4))) / n) - 3;
                }

                stats.mean = mean.toFixed(2);
                stats.median = median.toFixed(2);
                stats.sd = sd.toFixed(2);
                stats.min = min.toFixed(2);
                stats.max = max.toFixed(2);
                stats.iqr = iqr.toFixed(2);
                stats.skew = skew.toFixed(2);
                stats.kurt = kurt.toFixed(2);
            } else {
                const counts = {};
                rawVals.forEach(v => counts[v] = (counts[v] || 0) + 1);
                let mode = rawVals[0];
                let maxCount = counts[mode];
                for (let k in counts) {
                    if (counts[k] > maxCount) { maxCount = counts[k]; mode = k; }
                }
                stats.mean = `${mode} (${maxCount})`;
            }
        }
        return stats;
    };

    // First pass: Populate varStats for the whole columns (used by other parts of the UI)
    // This should always reflect the overall column properties, regardless of grouping for display
    varStats = {}; // Clear global varStats
    columns.forEach(col => {
        varStats[col] = getStats(col, currentData);
    });

    // Second pass: Render the table, potentially grouped
    columns.forEach(col => {
        if (shouldGroup && col === groupCol) return;

        let subsets = [];
        if (shouldGroup) {
            const groups = [...new Set(currentData.map(r => r[groupCol]).filter(v => v !== null && v !== undefined && v !== ''))];
            groups.forEach(g => {
                subsets.push({
                    name: g,
                    data: currentData.filter(r => r[groupCol] === g)
                });
            });
        } else {
            subsets.push({ name: 'Total', data: currentData });
        }

        subsets.forEach((subset, idx) => {
            const stats = getStats(col, subset.data);

            const tr = document.createElement('tr');
            if (shouldGroup) {
                tr.innerHTML = `
                    <td>${idx === 0 ? `<strong>${col}</strong>` : ''}</td>
                    <td style="color: #60a5fa; font-weight: 600;">${subset.name}</td>
                    <td>${stats.type}</td>
                    <td>${stats.n}</td>
                    <td>${stats.min !== '-' ? stats.min + ' / ' + stats.max : '-'}</td>
                    <td>${stats.mean}</td>
                    <td>${stats.median}</td>
                    <td>${stats.sd}</td>
                    <td>${stats.iqr}</td>
                    <td>${stats.type === 'Continuous' ? stats.skew : '-'}</td>
                    <td>${stats.type === 'Continuous' ? stats.kurt : '-'}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td><strong>${col}</strong></td>
                    <td>${stats.type}</td>
                    <td>${stats.n}</td>
                    <td>${stats.min !== '-' ? stats.min + ' / ' + stats.max : '-'}</td>
                    <td>${stats.mean}</td>
                    <td>${stats.median}</td>
                    <td>${stats.sd}</td>
                    <td>${stats.iqr}</td>
                    <td>${stats.type === 'Continuous' ? stats.skew : '-'}</td>
                    <td>${stats.type === 'Continuous' ? stats.kurt : '-'}</td>
                `;
            }
            tbody.appendChild(tr);
        });
    });
}

// Function to download an Excel template
function downloadExcelTemplate() {
    const data = [
        ['PatientID', 'Age', 'Gender', 'Weight', 'Height', 'TreatmentGroup', 'OutcomeScore'],
        [1, 35, 'Male', 75.2, 175, 'A', 25],
        [2, 42, 'Female', 68.1, 162, 'B', 32],
        [3, 28, 'Male', 80.5, 180, 'A', 28],
        [4, 55, 'Female', 72.0, 168, 'B', 30],
        [5, 39, 'Male', 70.0, 170, 'A', 27]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SampleData");
    XLSX.writeFile(wb, "EpiSense_SampleData.xlsx");
}

// 3. Test Selection UI
function populateTestSelector() {
    // Reset test selector and wait for user
    document.getElementById('test-type').value = "";
    document.getElementById('variable-selectors-container').innerHTML = '';
    document.getElementById('run-test-btn').style.display = 'none';
    document.getElementById('result-box').style.display = 'none';
}

function updateVariableSelectors() {
    const testType = document.getElementById('test-type').value;
    const container = document.getElementById('variable-selectors-container');
    const runBtn = document.getElementById('run-test-btn');

    container.innerHTML = ''; // Clear previous
    document.getElementById('result-box').style.display = 'none';

    if (!testType) return;

    // Helper to generate a dropdown
    const makeSelect = (id, labelText, filterType) => {
        let options = `<option value="" disabled selected>-- Select ${labelText} --</option>`;
        columns.forEach(col => {
            const type = varStats[col].type;
            if (filterType === 'all' || filterType === type || (filterType === 'continuous' && type === 'Continuous') || (filterType === 'categorical' && type === 'Categorical')) {
                options += `<option value="${col}">${col} (${type})</option>`;
            }
        });

        return `
            <div>
                <label for="${id}">${labelText}:</label>
                <select id="${id}">${options}</select>
            </div>
        `;
    };

    let html = '';

    // Configure inputs based on test required structure
    switch (testType) {
        case 't-test':
        case 'mann-whitney':
        case 'anova':
        case 'kruskal':
            html += makeSelect('var-group', 'Grouping Variable (Categorical)', 'categorical');
            html += makeSelect('var-outcome', 'Outcome Variable (Continuous)', 'continuous');
            break;
        case 'paired-t':
        case 'wilcoxon':
        case 'pearson':
        case 'spearman':
            html += makeSelect('var-1', 'Variable 1 (Continuous)', 'continuous');
            html += makeSelect('var-2', 'Variable 2 (Continuous)', 'continuous');
            break;
        case 'chi-square':
        case 'fisher':
            html += makeSelect('var-row', 'Row Variable (Categorical)', 'categorical');
            html += makeSelect('var-col', 'Column Variable (Categorical)', 'categorical');
            break;
        case 'z-test':
            container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-dim);">* NOTE: The standard Z-test strictly requires population variance. Use Unpaired T-test for standard comparison of means in samples instead. For large N (>30), T approximates Z perfectly.</div>`;
            break;
    }

    container.innerHTML += html;

    if (html !== '') {
        runBtn.style.display = 'block';
    } else {
        runBtn.style.display = 'none'; // E.g. for Z-test message
    }
}

// 4. Test Execution Router
function runTest() {
    const testType = document.getElementById('test-type').value;
    const tail = document.getElementById('test-tail')?.value || 'two';
    let result = { name: "Unknown", statName: "Stat", stat: 0, p: 1, df: 0, error: null, tail: tail };

    try {
        if (['t-test', 'mann-whitney', 'anova', 'kruskal'].includes(testType)) {
            const grpCol = document.getElementById('var-group').value;
            const outCol = document.getElementById('var-outcome').value;
            if (!grpCol || !outCol) throw "Please select both variables.";

            // Extract Groups
            const groups = {};
            currentData.forEach(row => {
                const g = row[grpCol];
                const v = row[outCol];
                if (g !== null && v !== null && typeof v === 'number') {
                    if (!groups[g]) groups[g] = [];
                    groups[g].push(v);
                }
            });

            const groupKeys = Object.keys(groups);
            if (groupKeys.length < 2) throw "Grouping variable must have at least 2 distinct categories.";

            if (testType === 't-test' || testType === 'mann-whitney') {
                if (groupKeys.length !== 2) throw `Found ${groupKeys.length} groups. These tests strictly require only 2 groups. Use ANOVA/Kruskal.`;
                const g1 = groups[groupKeys[0]];
                const g2 = groups[groupKeys[1]];

                if (testType === 't-test') result = runTTest(g1, g2, tail);
                if (testType === 'mann-whitney') result = runMannWhitney(g1, g2, tail);

            } else {
                // ANOVA or Kruskal (can handle >2 groups)
                const arrays = groupKeys.map(k => groups[k]);
                if (testType === 'anova') result = runANOVA(arrays);
                if (testType === 'kruskal') result = runKruskal(arrays);
            }

        } else if (['paired-t', 'wilcoxon', 'pearson', 'spearman'].includes(testType)) {
            const v1Col = document.getElementById('var-1').value;
            const v2Col = document.getElementById('var-2').value;
            if (!v1Col || !v2Col) throw "Please select both variables.";

            // Pair data (remove pairs with NaNs/nulls)
            const d1 = [], d2 = [];
            currentData.forEach(row => {
                const v1 = row[v1Col], v2 = row[v2Col];
                if (typeof v1 === 'number' && typeof v2 === 'number') {
                    d1.push(v1); d2.push(v2);
                }
            });
            if (d1.length < 3) throw "Need at least 3 valid complete pairs.";

            if (testType === 'paired-t') result = runPairedT(d1, d2, tail);
            if (testType === 'wilcoxon') result = runWilcoxon(d1, d2, tail);
            if (testType === 'pearson') result = runPearson(d1, d2, tail);
            if (testType === 'spearman') result = runSpearman(d1, d2, tail);

        } else if (['chi-square', 'fisher'].includes(testType)) {
            const rCol = document.getElementById('var-row').value;
            const cCol = document.getElementById('var-col').value;
            if (!rCol || !cCol) throw "Please select both variables.";

            result = runChiSquareLogic(rCol, cCol, testType === 'fisher');
        }

        displayResult(result);

    } catch (e) {
        displayError(typeof e === 'string' ? e : e.message);
    }
}

// 5. Statistical Algorithms
// ============================================

function runTTest(g1, g2, tail = 'two') {
    const n1 = g1.length, n2 = g2.length;
    const m1 = jStat.mean(g1), m2 = jStat.mean(g2);
    // student's t-test (assumes equal variance)
    const var1 = jStat.variance(g1, true);
    const var2 = jStat.variance(g2, true);

    // Pooled variance
    const sp2 = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const t = (m1 - m2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    const df = n1 + n2 - 2;

    // Two tailed p-value
    let p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    if (tail === 'one') p = p / 2;

    return {
        name: "Unpaired t-test",
        testType: 'unpaired-t',
        statName: "t",
        stat: t,
        p: p,
        df: df,
        plotData: {
            groups: [
                { name: "Group 1", mean: m1, sd: Math.sqrt(var1), n: n1, color: '#60a5fa' },
                { name: "Group 2", mean: m2, sd: Math.sqrt(var2), n: n2, color: '#f472b6' }
            ]
        }
    };
}

function runPairedT(d1, d2, tail = 'two') {
    const diffs = d1.map((v, i) => v - d2[i]);
    const n = diffs.length;
    const m_diff = jStat.mean(diffs);
    const sd_diff = jStat.stdev(diffs, true);

    const t = m_diff / (sd_diff / Math.sqrt(n));
    const df = n - 1;
    let p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    if (tail === 'one') p = p / 2;

    return {
        name: "Paired t-test",
        testType: 'paired-t',
        statName: "t",
        stat: t,
        p: p,
        df: df,
        plotData: {
            groups: [
                { name: "After - Before", mean: m_diff, sd: sd_diff, n: n, color: '#a78bfa' }
            ]
        }
    };
}

function runPearson(d1, d2, tail = 'two') {
    const r = jStat.corrcoeff(d1, d2);
    const n = d1.length;
    const df = n - 2;
    // t transform for r
    const t = r * Math.sqrt(df / (1 - r * r));
    let p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    if (tail === 'one') p = p / 2;

    return {
        name: "Pearson Correlation",
        testType: 'correlation',
        statName: "r",
        stat: r,
        p: p,
        df: df,
        plotData: { r: r }
    };
}

// Helper: Rank array, handling ties by averaging ranks
function getRanks(arr) {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
        let j = i;
        while (j < sorted.length && sorted[j].val === sorted[i].val) j++;
        const rankAvg = (i + 1 + j) / 2; // e.g. indices 0 and 1 -> ranks 1 and 2 -> avg 1.5
        for (let k = i; k < j; k++) ranks[sorted[k].idx] = rankAvg;
        i = j;
    }
    return ranks;
}

function runSpearman(d1, d2, tail = 'two') {
    const r1 = getRanks(d1);
    const r2 = getRanks(d2);
    const rs = jStat.corrcoeff(r1, r2);
    const n = d1.length;
    let p = 0;
    // simple t approximation for Spearman
    if (Math.abs(rs) === 1) { p = 0; }
    else {
        const t = rs * Math.sqrt((n - 2) / (1 - rs * rs));
        p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), n - 2));
    }
    if (tail === 'one') p = p / 2;
    return { name: "Spearman Rank Correlation", statName: "rs", stat: rs, p: p, df: n - 2, tail: tail };
}

function runMannWhitney(g1, g2, tail = 'two') {
    const combined = g1.concat(g2);
    const ranks = getRanks(combined);

    let R1 = 0;
    for (let i = 0; i < g1.length; i++) R1 += ranks[i];

    const n1 = g1.length;
    const n2 = g2.length;
    const U1 = R1 - (n1 * (n1 + 1)) / 2;
    const U2 = (n1 * n2) - U1;
    const U = Math.min(U1, U2);

    // Normal approximation for p-value
    const m_U = (n1 * n2) / 2;
    const s_U = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const z = (U - m_U) / s_U;
    let p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    if (tail === 'one') p = p / 2;

    return { name: "Mann-Whitney U Test", statName: "U", stat: U, p: p, df: null, tail: tail };
}

function runWilcoxon(d1, d2, tail = 'two') {
    const diffs = d1.map((v, i) => v - d2[i]).filter(d => d !== 0); // Discard zeros
    const absDiffs = diffs.map(Math.abs);
    const n = diffs.length;
    if (n === 0) throw "All pairs hold identical values.";

    const ranks = getRanks(absDiffs);
    let W_plus = 0, W_minus = 0;

    for (let i = 0; i < n; i++) {
        if (diffs[i] > 0) W_plus += ranks[i];
        if (diffs[i] < 0) W_minus += ranks[i];
    }

    const W = Math.min(W_plus, W_minus);

    // Normal Approximation
    const m_W = (n * (n + 1)) / 4;
    const s_W = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
    const z = (Math.abs(W - m_W) - 0.5) / s_W; // continuity correction
    let p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    if (tail === 'one') p = p / 2;

    return { name: "Wilcoxon Signed-Rank Test", statName: "W", stat: W, p: p, df: null, tail: tail };
}

function runANOVA(groups) {
    const k = groups.length; // number of groups
    const flat = [];
    groups.forEach(g => flat.push(...g));
    const N = flat.length;

    const grandMean = jStat.mean(flat);

    let SSW = 0; // sum of squares within (error)
    let SSB = 0; // sum of squares between (treatment)

    groups.forEach(g => {
        const n_i = g.length;
        const mean_i = jStat.mean(g);
        SSB += n_i * Math.pow(mean_i - grandMean, 2);

        const var_i = jStat.variance(g, true); // sample variance
        SSW += (n_i - 1) * var_i;
    });

    const dfB = k - 1;
    const dfW = N - k;

    const MSB = SSB / dfB;
    const MSW = SSW / dfW;

    const F = MSB / MSW;
    const p = 1 - jStat.centralF.cdf(F, dfB, dfW);

    const ANOVA_Data = {
        groups: groups.map((g, i) => ({
            name: `Group ${i + 1}`,
            mean: jStat.mean(g),
            sd: jStat.stdev(g, true),
            median: jStat.median(g),
            n: g.length,
            color: i === 0 ? '#60a5fa' : i === 1 ? '#f472b6' : i === 2 ? '#fbbf24' : '#34d399'
        }))
    };

    return { name: "One-Way ANOVA", testType: 'anova', statName: "F", stat: F, p: p, df: `${dfB}, ${dfW}`, plotData: ANOVA_Data };
}

function runKruskal(groups) {
    const k = groups.length;
    const combinedList = [];
    groups.forEach((g, gIdx) => {
        g.forEach(val => combinedList.push({ val: val, group: gIdx }));
    });

    const N = combinedList.length;
    const ranks = getRanks(combinedList.map(x => x.val));
    // Assign ranks back to groups
    const rankSums = new Array(k).fill(0);
    const n_i = new Array(k).fill(0);

    for (let i = 0; i < N; i++) {
        const gIdx = combinedList[i].group;
        rankSums[gIdx] += ranks[i];
        n_i[gIdx]++;
    }

    let sumTerms = 0;
    for (let i = 0; i < k; i++) {
        sumTerms += Math.pow(rankSums[i], 2) / n_i[i];
    }

    const H = (12 / (N * (N + 1))) * sumTerms - 3 * (N + 1);
    const df = k - 1;

    // H follows Chi-Square distribution
    const p = 1 - jStat.chisquare.cdf(H, df);

    return { name: "Kruskal-Wallis Test", statName: "H", stat: H, p: p, df: df };
}

function runChiSquareLogic(rCol, cCol, isFisher) {
    // Cross-tabulate
    const matrix = {};
    const rowTots = {};
    const colTots = {};
    let N = 0;

    currentData.forEach(row => {
        const rV = row[rCol];
        const cV = row[cCol];
        if (rV !== null && cV !== null) {
            if (!matrix[rV]) matrix[rV] = {};
            matrix[rV][cV] = (matrix[rV][cV] || 0) + 1;

            rowTots[rV] = (rowTots[rV] || 0) + 1;
            colTots[cV] = (colTots[cV] || 0) + 1;
            N++;
        }
    });

    const rows = Object.keys(rowTots);
    const cols = Object.keys(colTots);

    if (isFisher) {
        if (rows.length !== 2 || cols.length !== 2) throw "Fisher's Exact Test strictly requires a 2x2 categorical setup.";
        // We will approximate Fisher for front-end simplicity using hypergeometric but jStat doesn't have an exact fisher.
        // We will fallback to exact hypergeometric calculation if numbers are small, else throw error.
        const a = matrix[rows[0]][cols[0]] || 0;
        const b = matrix[rows[0]][cols[1]] || 0;
        const c = matrix[rows[1]][cols[0]] || 0;
        const d = matrix[rows[1]][cols[1]] || 0;

        // Exact p requires summing hypergeometric probabilities. 
        // For EpiSense, let's implement the standard factorial approach. Note: Breaks on very large numbers > 170 due to factorial limit.
        const logFact = (x) => jStat.gammaln(x + 1);

        // Numerator = (a+b)! (c+d)! (a+c)! (b+d)! 
        // Denominator = a! b! c! d! N!
        const calcLogProb = (a, b, c, d) => {
            return logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d)
                - logFact(a) - logFact(b) - logFact(c) - logFact(d) - logFact(N);
        };

        const probObserved = Math.exp(calcLogProb(a, b, c, d));
        let pVal = 0;

        // Sum probabilities of all tables that are more extreme or equally extreme
        const minVal = Math.max(0, (a + b) - (b + d));
        const maxVal = Math.min(a + b, a + c);

        for (let x = minVal; x <= maxVal; x++) {
            const currentA = x;
            const currentB = (a + b) - currentA;
            const currentC = (a + c) - currentA;
            const currentD = (c + d) - currentC;

            const currentProb = Math.exp(calcLogProb(currentA, currentB, currentC, currentD));
            if (currentProb <= probObserved * 1.0000001) { // Floating point leeway
                pVal += currentProb;
            }
        }

        const plotData = {
            labels: [rows[0], rows[1]],
            datasets: [
                { label: cols[0], data: [a, c], backgroundColor: 'rgba(96, 165, 250, 0.7)' },
                { label: cols[1], data: [b, d], backgroundColor: 'rgba(236, 72, 153, 0.7)' }
            ]
        };

        return { name: "Fisher Exact Test", testType: 'fisher-exact', statName: "Obs P(table)", stat: probObserved, p: pVal, df: null, plotData: plotData };
    }
    else {
        // Standard Pearson Chi-Square
        let chi2 = 0;
        const labels = cols;
        const datasets = rows.map((r, i) => ({
            label: r,
            data: cols.map(c => matrix[r][c] || 0),
            backgroundColor: i % 2 === 0 ? 'rgba(96, 165, 250, 0.7)' : 'rgba(236, 72, 153, 0.7)'
        }));

        rows.forEach(r => {
            cols.forEach(c => {
                const obs = (matrix[r] && matrix[r][c]) ? matrix[r][c] : 0;
                const exp = (rowTots[r] * colTots[c]) / N;
                chi2 += Math.pow(obs - exp, 2) / exp;
            });
        });

        const df = (rows.length - 1) * (cols.length - 1);
        if (df === 0) throw "Not enough variation in data to calculate Chi-Square (need at least 2 categories per variable).";
        const p = 1 - jStat.chisquare.cdf(chi2, df);

        return { name: "Pearson Chi-Square", testType: 'chi-square', statName: "χ²", stat: chi2, p: p, df: df, plotData: { labels, datasets } };
    }
}


// 6. UI Rendering for Results
function displayResult(res) {
    const box = document.getElementById('result-box');
    box.style.display = 'block';

    const tailText = res.tail === 'one' ? ' (1-Tailed)' : (res.tail === 'two' ? ' (2-Tailed)' : '');
    document.getElementById('test-name-display').innerText = res.name + tailText;
    document.getElementById('stat-value').innerText = `${res.statName} = ${res.stat.toFixed(4)}${res.df !== null ? ' (df=' + res.df + ')' : ''}`;

    const pDisplay = document.getElementById('p-value');
    let pStr = res.p < 0.0001 ? "< 0.0001" : res.p.toFixed(4);
    pDisplay.innerText = pStr;

    const isSig = res.p < 0.05;
    pDisplay.className = `p-value-display ${isSig ? 'sig-yes' : 'sig-no'}`;

    const interpDiv = document.getElementById('interpretation');
    if (isSig) {
        interpDiv.innerHTML = `<span style="color:#f472b6; font-weight:700;">Statistically Significant!</span> We reject the null hypothesis. The observed difference, relationship, or variation is highly unlikely to have occurred by random chance alone assuming the null hypothesis holds true.`;
    } else {
        interpDiv.innerHTML = `<span style="color:#60a5fa; font-weight:700;">Not Statistically Significant.</span> We fail to reject the null hypothesis. There is not sufficient evidence to conclude a true difference, relationship, or variation exists in the population.`;
    }

    // Trigger Charting
    if (res.plotData) {
        document.getElementById('raw-test-chart-viz').style.display = 'block';
        document.getElementById('raw-test-chart-container').style.display = 'block';
        drawTestChart(res.testType, res.plotData);
    } else {
        document.getElementById('raw-test-chart-viz').style.display = 'none';
        document.getElementById('raw-test-chart-container').style.display = 'none';
    }
}

let rawResultChart = null;

function drawTestChart(testType, plotData) {
    const canvas = document.getElementById('test-result-chart');
    if (rawResultChart) rawResultChart.destroy();

    let config = {};

    if (testType === 'chi-square' || testType === 'fisher-exact') {
        config = {
            type: 'bar',
            data: {
                labels: plotData.labels,
                datasets: plotData.datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Categorical Distribution', color: '#fff' }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#cbd5e1' } },
                    x: { ticks: { color: '#cbd5e1' } }
                }
            }
        };
    } else if (testType === 'correlation') {
        const rVal = plotData.r;
        config = {
            type: 'bar',
            data: {
                labels: ['Relationship Strength'],
                datasets: [{
                    label: "Pearson's R",
                    data: [rVal],
                    backgroundColor: rVal > 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)',
                    borderColor: rVal > 0 ? '#34d399' : '#f87171',
                    borderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Relationship Direction & Magnitude', color: '#fff' }
                },
                scales: {
                    x: { min: -1.1, max: 1.1, ticks: { color: '#cbd5e1' } },
                    y: { ticks: { display: false } }
                }
            }
        };
    } else {
        // Continuous data comparisons (T-Tests, ANOVA)
        const datasets = plotData.groups.map(g => ({
            label: g.name,
            data: [generateBoxArray(g.mean, g.sd, g.median, g.iqr, g.min, g.max)],
            backgroundColor: g.color || 'rgba(124, 58, 237, 0.6)',
            borderColor: g.color || '#7c3aed',
            padding: 10,
            itemRadius: 2
        }));

        config = {
            type: 'boxplot',
            data: {
                labels: ['Distribution Analysis'],
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { color: '#cbd5e1' } },
                    title: { display: true, text: 'Clinical Distribution Comparison', color: '#fff' }
                },
                scales: {
                    y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        };
    }

    rawResultChart = new Chart(canvas.getContext('2d'), config);
}

function displayError(msg) {
    const box = document.getElementById('result-box');
    box.style.display = 'block';
    document.getElementById('test-name-display').innerText = "Test Error";
    document.getElementById('stat-value').innerText = "-";
    document.getElementById('p-value').innerText = "-";
    document.getElementById('p-value').className = "p-value-display";
    document.getElementById('interpretation').innerHTML = `<span style="color:#ff5252">${msg}</span>`;
}

// ============================================
// 6.5 Normality Checker Module 
// ============================================

let chartNormHist = null;
let chartNormBox = null;
let chartNormQQ = null;

function runNormalityChecks() {
    const colName = document.getElementById('normality-var-select').value;
    if (!colName) {
        alert("Please select a valid continuous variable first.");
        return;
    }

    // Extract raw array and clean NaNs
    const rawData = currentData.map(row => row[colName]).filter(v => typeof v === 'number' && !isNaN(v));

    if (rawData.length < 5) {
        alert("Not enough valid continuous data points to run normality tests (Need at least 5).");
        return;
    }

    // Render Charts
    renderNormalityHistogram(rawData);
    renderNormalityBoxPlot(rawData);
    renderNormalityQQPlot(rawData);

    // Compute Math Tests
    runNormalityMathTests(rawData);
}

function renderNormalityHistogram(data) {
    const min = jStat.min(data);
    const max = jStat.max(data);
    const mean = jStat.mean(data);
    let sd = jStat.stdev(data, true);
    if (sd === 0) sd = 0.0001;

    const bins = Math.ceil(Math.log2(data.length) + 1); // Sturges' rule
    const binWidth = (max - min) / bins;

    const freqs = new Array(bins).fill(0);
    const labels = [];
    const binCenters = [];

    for (let i = 0; i < bins; i++) {
        let bStart = min + i * binWidth;
        let bEnd = min + (i + 1) * binWidth;
        labels.push(`${bStart.toFixed(1)} - ${bEnd.toFixed(1)}`);
        binCenters.push(bStart + (binWidth / 2));
    }

    data.forEach(val => {
        let idx = Math.floor((val - min) / binWidth);
        if (idx >= bins) idx = bins - 1;
        freqs[idx]++;
    });

    // Generate Normal Curve Overlay
    // Area of histogram = N * binWidth
    const area = data.length * binWidth;
    const curveData = [];

    // Create smooth points for the line curve based on bin centers (and interpolate)
    const curveResolution = 50;
    const step = (max - min) / curveResolution;
    const curveLabels = [];
    const curvePoints = [];

    for (let x = min; x <= max; x += step) {
        curveLabels.push(x);
        // Normal PDF = (1 / (sd * sqrt(2pi))) * e^(-0.5 * ((x-mean)/sd)^2)
        const pdf = (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
        // Scale PDF to histogram frequency scale
        curvePoints.push(pdf * area);
    }

    const ctx = document.getElementById('normalityHistogram').getContext('2d');
    if (chartNormHist) chartNormHist.destroy();

    chartNormHist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Normal Curve Density',
                    type: 'line',
                    data: curveLabels.map((l, i) => ({ x: l, y: curvePoints[i] })),
                    borderColor: 'rgba(52, 211, 153, 0.8)', // Green curve
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.4,
                    // Map x-axis differently to align with scatter curve over categorical bins
                    // A trick in Chart.js for mixed continuous/categorical without true linear x-axis
                    // requires mapping the curve points explicitly to the categorical bin indeces
                },
                {
                    label: 'Frequency',
                    type: 'bar',
                    data: freqs,
                    backgroundColor: 'rgba(96, 165, 250, 0.5)',
                    borderColor: '#60a5fa',
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Fix the Curve mapping trick for mixed axis 
    // Since 'labels' is categorical (bins), line chart points won't align perfectly if we pass arbitrary X.
    // Instead, calculate curve exactly AT the bin centers:
    const curveAtBins = binCenters.map(x => {
        const pdf = (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
        return pdf * area;
    });

    chartNormHist.data.datasets[0].data = curveAtBins; // Replace smooth line with bin-aligned line
    chartNormHist.update();
}

function renderNormalityQQPlot(data) {
    // 1. Sort data
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;

    // 2. Compute theoretical Normal quantiles
    // Using simple inverse CDF approximation for standard normal
    const scatterData = [];
    const theoresticalLine = [];

    sorted.forEach((val, i) => {
        const p = (i + 0.5) / n;
        // Inverse Normal CDF approx
        // Z = 4.91 * [p^0.14 - (1-p)^0.14] (Tukey's Lambda approximation)
        const z = 4.91 * (Math.pow(p, 0.14) - Math.pow(1 - p, 0.14));
        scatterData.push({ x: z, y: val });
    });

    // 3. Line of best fit logic (perfect normal falls exactly on this line)
    // Connecting min/max theoritical to min/max observed isn't exact regression line but visually good enough for basic QQ
    const minZ = scatterData[0].x;
    const maxZ = scatterData[n - 1].x;
    const minO = scatterData[0].y;
    const maxO = scatterData[n - 1].y;

    theoresticalLine.push({ x: minZ, y: minO });
    theoresticalLine.push({ x: maxZ, y: maxO });

    const ctx = document.getElementById('normalityQQPlot').getContext('2d');
    if (chartNormQQ) chartNormQQ.destroy();

    chartNormQQ = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Sample Quantiles',
                data: scatterData,
                backgroundColor: '#f472b6',
                pointRadius: 4
            }, {
                type: 'line',
                label: 'Theoretical Normal',
                data: theoresticalLine,
                borderColor: 'rgba(255,255,255,0.4)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Sample Data', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    title: { display: true, text: 'Theoretical Normal Quantiles', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

function renderNormalityBoxPlot(data) {
    const ctx = document.getElementById('normalityBoxPlot').getContext('2d');
    if (chartNormBox) chartNormBox.destroy();

    // Using true boxplot plugin (@sgratzl/chartjs-chart-boxplot)
    chartNormBox = new Chart(ctx, {
        type: 'boxplot',
        data: {
            labels: ['Value Distribution'],
            datasets: [{
                label: 'Standard Box Plot',
                data: [data], // Plugin expects array of arrays
                backgroundColor: 'rgba(167, 139, 250, 0.5)',
                borderColor: '#a78bfa',
                borderWidth: 2,
                itemRadius: 3,
                itemBackgroundColor: '#f472b6' // outlier color
            }]
        },
        options: {
            indexAxis: 'y', // Render horizontally
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    display: false // Hide 'Value Distribution' label for cleaner UI
                }
            }
        }
    });
}

function runNormalityMathTests(data) {
    const n = data.length;
    let mean = jStat.mean(data);
    let sd = jStat.stdev(data, true);
    if (sd === 0) sd = 0.0001; // prevent div by zero

    const sorted = [...data].sort((a, b) => a - b);

    // ==========================================
    // 1. Kolmogorov-Smirnov (K-S) Test Loop
    // ==========================================
    let maxD = 0;
    for (let i = 0; i < n; i++) {
        const val = sorted[i];

        // Empirical CDF
        const empiricalCDF_before = i / n;
        const empiricalCDF_after = (i + 1) / n;

        // Theoretical CDF (Normal)
        const z = (val - mean) / sd;
        const theoreticalCDF = jStat.normal.cdf(z, 0, 1);

        const diff1 = Math.abs(empiricalCDF_after - theoreticalCDF);
        const diff2 = Math.abs(empiricalCDF_before - theoreticalCDF);

        if (diff1 > maxD) maxD = diff1;
        if (diff2 > maxD) maxD = diff2;
    }

    // P-value approximation for KS statistics
    const en = Math.sqrt(n);
    const lambda = (en + 0.12 + (0.11 / en)) * maxD;

    let ksPValue = 1;
    if (lambda > 0.1) {
        let sum = 0;
        for (let j = 1; j <= 50; j++) {
            sum += Math.pow(-1, j - 1) * Math.exp(-2 * Math.pow(j * lambda, 2));
        }
        ksPValue = 2 * sum;
    }

    // ==========================================
    // 2. D'Agostino-Pearson (K-squared) Test 
    // ==========================================
    // Since true Shapiro-Wilk requires complex matrix math and Royston's coefficients,
    // the industry standard robust alternative for JS environments is D'Agostino-Pearson K2.
    // It uses Skewness and Kurtosis transformations to closely match S-W and K-S.

    // Calculate Skewness and Kurtosis mathematically
    let m2 = 0, m3 = 0, m4 = 0;
    for (let i = 0; i < n; i++) {
        const diff = data[i] - mean;
        m2 += Math.pow(diff, 2);
        m3 += Math.pow(diff, 3);
        m4 += Math.pow(diff, 4);
    }
    m2 /= n; m3 /= n; m4 /= n;

    const skewness = m3 / Math.pow(m2, 1.5);
    const kurtosis = m4 / Math.pow(m2, 2); // non-excess kurtosis

    // Transform Skewness (Z1)
    const y = skewness * Math.sqrt((n + 1) * (n + 3) / (6 * (n - 2)));
    const beta2_skew = 3 * (Math.pow(n, 2) + 27 * n - 70) * (n + 1) * (n + 3) / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
    const W2 = -1 + Math.sqrt(2 * (beta2_skew - 1));
    const delta = 1 / Math.sqrt(Math.log(Math.sqrt(W2)));
    const alpha = Math.sqrt(2 / (W2 - 1));
    const Z1 = delta * Math.log(y / alpha + Math.sqrt(Math.pow(y / alpha, 2) + 1));

    // Transform Kurtosis (Z2)
    const expectedKurtosis = 3 * (n - 1) / (n + 1);
    const varKurtosis = 24 * n * (n - 2) * (n - 3) / (Math.pow(n + 1, 2) * (n + 3) * (n + 5));
    const x = (kurtosis - expectedKurtosis) / Math.sqrt(varKurtosis);

    // Approximation parameters for Kurtosis
    const beta1_kurt = 6 * (n * n - 5 * n + 2) / ((n + 7) * (n + 9)) * Math.sqrt(6 * (n + 3) * (n + 5) / (n * (n - 2) * (n - 3)));
    const A = 6 + 8 / beta1_kurt * (2 / beta1_kurt + Math.sqrt(1 + 4 / Math.pow(beta1_kurt, 2)));
    const term1 = 1 - 2 / A;
    const term2 = (1 + x * Math.sqrt(2 / (A - 4))) / (1 - 2 / A); // safety catch needed
    const Z2 = (term2 > 0) ? (1 - 2 / (9 * A) - Math.pow(term1 / term2, 1 / 3)) / Math.sqrt(2 / (9 * A)) : 0; // Simplified safe-catch

    // K-Squared Statistic
    const K2 = Math.pow(Z1, 2) + Math.pow(Z2, 2);

    // P-value using Chi-Square approximation (df = 2) for K2
    let dpPValue = 1 - jStat.chisquare.cdf(K2, 2);
    if (isNaN(dpPValue)) dpPValue = 0.001; // fallback if transformations break on tiny N


    // ==========================================
    // 3. UI Binding and Verdict Logic
    // ==========================================
    document.getElementById('normality-test-results').style.display = 'block';

    const ksPass = ksPValue > 0.05;
    const dpPass = dpPValue > 0.05;

    // We consider it normal only if BOTH tests fail to reject the null hypothesis (safest approach)
    const isNormal = ksPass && dpPass;

    // Small rounding catch
    const displayKS_p = ksPValue < 0.0001 ? '<0.0001' : ksPValue.toFixed(4);
    const displayDP_p = dpPValue < 0.0001 ? '<0.0001' : dpPValue.toFixed(4);

    document.getElementById('ks-stat-readout').innerHTML = `
        <strong>Kolmogorov-Smirnov:</strong> D = ${maxD.toFixed(3)}, p = ${displayKS_p}
    `;

    // Note: We use D'Agostino-Pearson as our secondary powerful mathematical confirmation.
    document.getElementById('sw-stat-readout').innerHTML = `
        <strong>D'Agostino-Pearson (K²):</strong> K² = ${K2.toFixed(3)}, p = ${displayDP_p}
    `;

    const badge = document.getElementById('normality-verdict-badge');
    const interp = document.getElementById('normality-interpretation');

    if (isNormal) {
        badge.innerText = `Data is Normally Distributed (All p > .05)`;
        badge.style.background = `rgba(52, 211, 153, 0.2)`;
        badge.style.color = `#34d399`;
        badge.style.border = `1px solid #34d399`;

        interp.innerHTML = `<span style="font-weight:600;">Mathematical Verdict:</span> We <strong>fail to reject</strong> the null hypothesis of both mathematically robust normality tests. The data curve closely hugs the theoretical bell curve shape. You can safely assume normality and proceed with <strong style="color: #60a5fa;">Parametric tests</strong> (like t-tests and ANOVA) in the wizard below.`;
    } else {
        badge.innerText = `Data is NOT Normally Distributed (p ≤ .05)`;
        badge.style.background = `rgba(244, 114, 182, 0.2)`;
        badge.style.color = `#f472b6`;
        badge.style.border = `1px solid #f472b6`;

        interp.innerHTML = `<span style="font-weight:600;">Mathematical Verdict:</span> We <strong>reject</strong> the null hypothesis for Normality. The data deviates significantly from a perfect bell curve (it may be skewed or have extreme outliers). You should proceed with <strong style="color: #f472b6;">Non-Parametric tests</strong> (like Mann-Whitney or Kruskal-Wallis) in the wizard below.`;
    }
}

// ============================================
// 7. Interactive Test Selector Wizard
// ============================================

let wizardState = { goal: null, groups: null, paired: null, parametric: null };
let recommendedTestVal = null;

function wizardAnswer(key, value) {
    wizardState[key] = value;
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');

    if (key === 'goal') {
        if (value === 'compare') {
            document.getElementById('wizard-step-2').style.display = 'block';
        } else if (value === 'correlate') {
            document.getElementById('wizard-step-4').style.display = 'block';
        } else if (value === 'categorical') {
            showWizardResult('categorical');
        }
    }
    else if (key === 'groups') {
        if (value === 2) {
            document.getElementById('wizard-step-3').style.display = 'block';
        } else {
            document.getElementById('wizard-step-4').style.display = 'block'; // ANOVA branch
        }
    }
    else if (key === 'paired') {
        document.getElementById('wizard-step-4').style.display = 'block';
    }
    else if (key === 'parametric') {
        determineTest();
    }
}

function wizardBack(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    if (step === 'auto') {
        // dynamic back based on state
        if (wizardState.goal === 'correlate' || wizardState.groups === 3) step = 1;
        else if (wizardState.groups === 2) step = 3;
    }
    document.getElementById(`wizard-step-${step}`).style.display = 'block';
}

function wizardReset() {
    wizardState = { goal: null, groups: null, paired: null, parametric: null };
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('wizard-step-1').style.display = 'block';
}

function showWizardResult(type) {
    let title = ""; let desc = ""; let val = "";

    if (type === 'categorical') {
        title = "Chi-Square or Fisher Exact";
        desc = "Use Chi-Square for general tables. If your table is exactly 2x2 and samples are small, select the Fisher Exact test instead.";
        val = "chi-square";
    }

    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('wizard-result').style.display = 'block';
    document.getElementById('wizard-test-name').innerText = title;
    document.getElementById('wizard-test-desc').innerText = desc;
    recommendedTestVal = val;
}

function determineTest() {
    const s = wizardState;
    let title = ""; let desc = ""; let val = "";

    if (s.goal === 'correlate') {
        if (s.parametric) {
            title = "Pearson Correlation";
            desc = "Parametric test measuring the linear relationship between two continuous variables.";
            val = "pearson";
        } else {
            title = "Spearman Correlation";
            desc = "Non-Parametric test measuring rank-order relationship. Use if data is skewed or an ordinal curve.";
            val = "spearman";
        }
    }
    else if (s.goal === 'compare') {
        if (s.groups === 3) {
            if (s.parametric) {
                title = "One-Way ANOVA";
                desc = "Parametric test comparing the means of 3 or more independent groups.";
                val = "anova";
            } else {
                title = "Kruskal-Wallis Test";
                desc = "Non-Parametric alternative to ANOVA. Compares medians/ranks across 3 or more groups.";
                val = "kruskal";
            }
        }
        else if (s.groups === 2) {
            if (s.paired) {
                if (s.parametric) {
                    title = "Paired T-Test";
                    desc = "Parametric test comparing two related samples (e.g. before/after treatment on the same patient).";
                    val = "paired-t";
                } else {
                    title = "Wilcoxon Signed-Rank Test";
                    desc = "Non-Parametric test for paired data. Used when the differences between pairs are not normally distributed.";
                    val = "wilcoxon";
                }
            } else {
                if (s.parametric) {
                    title = "Unpaired T-Test";
                    desc = "Standard parametric test comparing the means of two completely independent groups.";
                    val = "t-test";
                } else {
                    title = "Mann-Whitney U Test";
                    desc = "Non-parametric alternative to the unpaired t-test. Used when data is skewed or ordinal.";
                    val = "mann-whitney";
                }
            }
        }
    }

    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('wizard-result').style.display = 'block';
    document.getElementById('wizard-test-name').innerText = title;
    document.getElementById('wizard-test-desc').innerText = desc;
    recommendedTestVal = val;
}

function wizardSelectTest() {
    const testDropdown = document.getElementById('test-type');
    if (testDropdown && recommendedTestVal) {
        testDropdown.value = recommendedTestVal;

        // Scroll down to the test section
        document.getElementById('test-card').scrollIntoView({ behavior: 'smooth' });

        // Trigger the change event to build variable selectors
        updateVariableSelectors();
    }
}

// ============================================
// 8. Summary Statistics Calculator Mode
// ============================================

function setMode(mode) {
    const rawContainer = document.getElementById('raw-data-mode-container');
    const sumContainer = document.getElementById('summary-stats-mode-container');
    const btnRaw = document.getElementById('btn-mode-raw');
    const btnSum = document.getElementById('btn-mode-summary');

    if (mode === 'raw') {
        rawContainer.style.display = 'block';
        sumContainer.style.display = 'none';
        btnRaw.style.background = ''; // default primary
        btnRaw.style.color = '';
        btnSum.style.background = 'rgba(255,255,255,0.1)';
        btnSum.style.color = 'var(--text-dim)';
    } else {
        rawContainer.style.display = 'none';
        sumContainer.style.display = 'block';
        btnSum.style.background = ''; // default primary
        btnSum.style.color = '';
        btnRaw.style.background = 'rgba(255,255,255,0.1)';
        btnRaw.style.color = 'var(--text-dim)';
    }
}

function buildSummaryInputs() {
    const testType = document.getElementById('summary-test-select').value;
    const container = document.getElementById('summary-inputs-container');
    const calcBtn = document.getElementById('btn-calc-summary');
    const resBanner = document.getElementById('summary-test-results-banner');

    // Context Panel Elements
    const contextContainer = document.getElementById('summary-context-container');
    const contextFormula = document.getElementById('summary-context-formula');
    const contextExplain = document.getElementById('summary-context-explanation');

    // Reset UI
    container.innerHTML = '';
    calcBtn.style.display = 'block';
    resBanner.style.display = 'none';
    contextContainer.style.display = 'flex';

    if (testType === 'unpaired-t') {
        contextFormula.innerHTML = `
            t = ( x\u0304\u2081 - x\u0304\u2082 ) / \u221A( (s\u2081\u00B2/n\u2081) + (s\u2082\u00B2/n\u2082) )<br>
            <span style="font-size:0.8rem; color:#94a3b8;">*Welch's approximation for unequal variances</span>
        `;
        contextExplain.innerHTML = `<strong>Unpaired (Independent) T-Test:</strong><br><br>This test compares the means of two completely separate groups (like Treatment vs Control) to see if they are statistically different from each other.<br><br>The math calculates the distance between the two group averages, and then divides that by the "noise" (variance) in the data. If the distance is much larger than the noise, you get a significant result!`;
        container.innerHTML = `
            <div class="grid-2" style="gap: 2rem;">
                <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: #60a5fa; margin-bottom: 1rem;">Group 1 Data</h4>
                    <label>Group Name:</label> <input type="text" id="sum-g1-name" class="sum-input" placeholder="e.g. Treatment Group"><br>
                    <label>Mean:</label> <input type="number" id="sum-g1-mean" step="any" class="sum-input"><br>
                    <label>Standard Deviation (SD):</label> <input type="number" id="sum-g1-sd" step="any" class="sum-input"><br>
                    <label>Sample Size (N):</label> <input type="number" id="sum-g1-n" step="1" min="2" class="sum-input"><br>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.2);">
                        <strong style="color: #cbd5e1; font-size: 0.85rem; display: block; margin-bottom: 0.5rem;">Optional (For Exact Box Plot):</strong>
                        <label>Minimum:</label> <input type="number" id="sum-g1-min" step="any" class="sum-input">
                        <label>Median:</label> <input type="number" id="sum-g1-median" step="any" class="sum-input">
                        <label>Maximum:</label> <input type="number" id="sum-g1-max" step="any" class="sum-input">
                        <label>IQR:</label> <input type="number" id="sum-g1-iqr" step="any" class="sum-input">
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: #f472b6; margin-bottom: 1rem;">Group 2 Data</h4>
                    <label>Group Name:</label> <input type="text" id="sum-g2-name" class="sum-input" placeholder="e.g. Control Group"><br>
                    <label>Mean:</label> <input type="number" id="sum-g2-mean" step="any" class="sum-input"><br>
                    <label>Standard Deviation (SD):</label> <input type="number" id="sum-g2-sd" step="any" class="sum-input"><br>
                    <label>Sample Size (N):</label> <input type="number" id="sum-g2-n" step="1" min="2" class="sum-input"><br>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.2);">
                        <strong style="color: #cbd5e1; font-size: 0.85rem; display: block; margin-bottom: 0.5rem;">Optional (For Exact Box Plot):</strong>
                        <label>Minimum:</label> <input type="number" id="sum-g2-min" step="any" class="sum-input">
                        <label>Median:</label> <input type="number" id="sum-g2-median" step="any" class="sum-input">
                        <label>Maximum:</label> <input type="number" id="sum-g2-max" step="any" class="sum-input">
                        <label>IQR:</label> <input type="number" id="sum-g2-iqr" step="any" class="sum-input">
                    </div>
                </div>
            </div>
            <style>
                .sum-input { width: 100%; padding: 0.6rem; margin-top: 0.3rem; margin-bottom: 1rem; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; }
                .sum-input:focus { border-color: #fbbf24; outline: none; }
            </style>
        `;
    } else if (testType === 'paired-t') {
        contextFormula.innerHTML = `
            t = d\u0304 / ( s\u2091 / \u221An )<br>
            <span style="font-size:0.8rem; color:#94a3b8;">where d\u0304 is mean of differences</span>
        `;
        contextExplain.innerHTML = `<strong>Paired (Dependent) T-Test:</strong><br><br>This compares two related groups, most commonly the exact same patients measured twice (e.g., Blood pressure "Before" and "After" a medication).<br><br>Instead of comparing the two group averages, the math matches up each pair, calculates the difference for that specific person, and then tests if the <em>average difference</em> is significantly far from zero.`;
        container.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; max-width: 500px;">
                <h4 style="color: #fbbf24; margin-bottom: 1rem;">Difference Scores (Post - Pre)</h4>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-bottom: 1rem;">For a paired test, you analyze the <em>differences</em> between the paired pairs.</p>
                <label>Label for Differences:</label> <input type="text" id="sum-diff-name" class="sum-input" placeholder="e.g. Treatment Effect (Post-Pre)"><br>
                <label>Mean of Differences:</label> <input type="number" id="sum-diff-mean" step="any" class="sum-input"><br>
                <label>Standard Deviation of Differences:</label> <input type="number" id="sum-diff-sd" step="any" class="sum-input"><br>
                <label>Number of Pairs (N):</label> <input type="number" id="sum-diff-n" step="1" min="2" class="sum-input"><br>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.2);">
                    <strong style="color: #cbd5e1; font-size: 0.85rem; display: block; margin-bottom: 0.5rem;">Optional (For Exact Box Plot):</strong>
                    <label>Minimum:</label> <input type="number" id="sum-diff-min" step="any" class="sum-input">
                    <label>Median:</label> <input type="number" id="sum-diff-median" step="any" class="sum-input">
                    <label>Maximum:</label> <input type="number" id="sum-diff-max" step="any" class="sum-input">
                    <label>IQR:</label> <input type="number" id="sum-diff-iqr" step="any" class="sum-input">
                </div>
            </div>
            <style>
                .sum-input { width: 100%; padding: 0.6rem; margin-top: 0.3rem; margin-bottom: 1rem; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; }
                .sum-input:focus { border-color: #fbbf24; outline: none; }
            </style>
        `;
    } else if (testType === 'chi-square') {
        contextFormula.innerHTML = `
            \u03C7\u00B2 = \u03A3 [ (O - E)\u00B2 / E ]<br>
            <span style="font-size:0.8rem; color:#94a3b8;">O = Observed, E = Expected frequency</span>
        `;
        contextExplain.innerHTML = `<strong>Chi-Square (\u03C7\u00B2) Test:</strong><br><br>Used for categorical data (e.g., Yes/No, Recovered/Dead). It tests if there is an association between two variables.<br><br>The math looks at your "Observed" counts in the table, calculates what the "Expected" counts would be if the groups were perfectly equal and random, and sees how far reality deviates from that perfectly random expectation.`;
        container.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; max-width: 600px;">
                <h4 style="color: #34d399; margin-bottom: 1rem;">2x2 Contingency Table (Counts)</h4>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-bottom: 1.5rem;">Enter the raw counting numbers (frequencies) for each quadrant.</p>
                
                <table style="width: 100%; border-collapse: separate; border-spacing: 0.5rem;">
                    <tr>
                        <td></td>
                        <td style="text-align:center; font-weight:600; color:#cbd5e1;">Outcome Positive</td>
                        <td style="text-align:center; font-weight:600; color:#cbd5e1;">Outcome Negative</td>
                    </tr>
                    <tr>
                        <td style="text-align:right; font-weight:600; color:#cbd5e1; padding-right:1rem;">Exposure Present</td>
                        <td><input type="number" id="sum-cell-a" class="sum-input" style="margin:0; text-align:center;" placeholder="A" min="0"></td>
                        <td><input type="number" id="sum-cell-b" class="sum-input" style="margin:0; text-align:center;" placeholder="B" min="0"></td>
                    </tr>
                    <tr>
                        <td style="text-align:right; font-weight:600; color:#cbd5e1; padding-right:1rem;">Exposure Absent</td>
                        <td><input type="number" id="sum-cell-c" class="sum-input" style="margin:0; text-align:center;" placeholder="C" min="0"></td>
                        <td><input type="number" id="sum-cell-d" class="sum-input" style="margin:0; text-align:center;" placeholder="D" min="0"></td>
                    </tr>
                </table>
            </div>
            <style>
                .sum-input { width: 100%; padding: 0.8rem; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 1.1rem; }
                .sum-input:focus { border-color: #fbbf24; outline: none; }
            </style>
        `;
    } else if (testType === 'fisher-exact') {
        contextFormula.innerHTML = `
            p = [ (a+b)! (c+d)! (a+c)! (b+d)! ] / [ a! b! c! d! n! ]<br>
            <span style="font-size:0.8rem; color:#94a3b8;">Hypergeometric distribution factorials</span>
        `;
        contextExplain.innerHTML = `<strong>Fisher's Exact Test:</strong><br><br>Similar to Chi-Square in that it looks for associations in a 2x2 categorical table, but Fisher's is the absolute gold standard when your sample size is small (e.g., any cell has fewer than 5 observations).<br><br>Unlike Chi-Square, which uses an approximation curve, Fisher's relies on factorial math to calculate the <em>exact mathematical probability</em> of obtaining the observed table (and any more extreme tables) purely by chance.`;
        container.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; max-width: 600px;">
                <h4 style="color: #60a5fa; margin-bottom: 1rem;">2x2 Contingency Table (Counts)</h4>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-bottom: 1.5rem;">Enter the exact raw number of occurrences for each cell.</p>
                
                <table style="width: 100%; border-collapse: separate; border-spacing: 0.5rem;">
                    <tr>
                        <td></td>
                        <td style="text-align:center; font-weight:600; color:#cbd5e1;">Outcome Positive</td>
                        <td style="text-align:center; font-weight:600; color:#cbd5e1;">Outcome Negative</td>
                    </tr>
                    <tr>
                        <td style="text-align:right; font-weight:600; color:#cbd5e1; padding-right:1rem;">Exposure Present</td>
                        <td><input type="number" id="sum-cell-a" class="sum-input" style="margin:0; text-align:center;" placeholder="A" min="0"></td>
                        <td><input type="number" id="sum-cell-b" class="sum-input" style="margin:0; text-align:center;" placeholder="B" min="0"></td>
                    </tr>
                    <tr>
                        <td style="text-align:right; font-weight:600; color:#cbd5e1; padding-right:1rem;">Exposure Absent</td>
                        <td><input type="number" id="sum-cell-c" class="sum-input" style="margin:0; text-align:center;" placeholder="C" min="0"></td>
                        <td><input type="number" id="sum-cell-d" class="sum-input" style="margin:0; text-align:center;" placeholder="D" min="0"></td>
                    </tr>
                </table>
            </div>
            <style>
                .sum-input { width: 100%; padding: 0.8rem; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 1.1rem; }
                .sum-input:focus { border-color: #fbbf24; outline: none; }
            </style>
        `;
    } else if (testType === 'anova') {
        contextFormula.innerHTML = `
            F = MS<sub>Between</sub> / MS<sub>Within</sub><br>
            <span style="font-size:0.8rem; color:#94a3b8;">Analysis of Variance (ANOVA)</span>
        `;
        contextExplain.innerHTML = `<strong>One-Way ANOVA:</strong><br><br>Compare 3 or more independent groups (e.g., Medication A vs B vs Placebo).<br><br>Instead of entering complex variance numbers, simply add your groups below with their Means and SDs. EpiSense will calculate the variance partitions and effect size (Eta-squared) automatically.`;
        container.innerHTML = `
            <div id="anova-groups-container" style="display: flex; flex-direction: column; gap: 1rem; max-width: 800px;">
                <!-- Groups will be added here -->
            </div>
            <button class="btn-primary" onclick="addAnovaGroup()" style="margin-top: 1rem; background: rgba(167, 139, 250, 0.2); color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.5); width: auto;">
                + Add Research Group
            </button>
        `;
        // Add initial 3 groups
        addAnovaGroup("Group A", "#60a5fa");
        addAnovaGroup("Group B", "#f472b6");
        addAnovaGroup("Group C", "#fbbf24");
    } else if (testType === 'correlation') {
        contextFormula.innerHTML = `
            t = r \u00D7 \u221A[ (n-2) / (1-r\u00B2) ]<br>
            <span style="font-size:0.8rem; color:#94a3b8;">Pearson's Relationship Strength</span>
        `;
        contextExplain.innerHTML = `<strong>Pearson Correlation:</strong><br><br>Measure the linear relationship between two continuous variables.<br><br>Enter the Correlation Coefficient (R) from -1.0 to +1.0 and the sample size (N). EpiSense will determine if the relationship is statistically significant and describe its magnitude according to medical reporting standards.`;
        container.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1.5rem; max-width: 500px;">
                <h4 style="color: #60a5fa; margin-bottom: 1rem;">Correlation Parameters</h4>
                <div class="grid-2" style="gap: 1.5rem;">
                    <div>
                        <label style="font-size: 0.8rem; color: #94a3b8;">Pearson's R (-1 to 1)</label>
                        <input type="number" id="sum-corr-r" step="0.01" min="-1" max="1" class="sum-input" placeholder="0.5">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; color: #94a3b8;">Sample Size (N)</label>
                        <input type="number" id="sum-corr-n" step="1" min="3" class="sum-input" placeholder="100">
                    </div>
                </div>
            </div>
        `;
    }
}

function addAnovaGroup(label = "", color = "#fff") {
    const container = document.getElementById('anova-groups-container');
    if (!container) return;
    const groupCount = container.children.length + 1;
    const groupDiv = document.createElement('div');
    groupDiv.className = 'anova-group-row';
    groupDiv.style = "background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 1rem; align-items: center;";
    groupDiv.innerHTML = `
        <div>
            <label style="font-size: 0.8rem; color: ${color || '#94a3b8'};">Group Name</label>
            <input type="text" class="sum-input anova-name" value="${label || 'Group ' + groupCount}" style="margin:0;">
        </div>
        <div>
            <label style="font-size: 0.8rem;">Mean</label>
            <input type="number" step="any" class="sum-input anova-mean" style="margin:0;">
        </div>
        <div>
            <label style="font-size: 0.8rem;">SD</label>
            <input type="number" step="any" class="sum-input anova-sd" style="margin:0;">
        </div>
        <div>
            <label style="font-size: 0.8rem;">N</label>
            <input type="number" step="1" min="2" class="sum-input anova-n" style="margin:0;">
        </div>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:1.2rem; margin-top:0.8rem;">\u00D7</button>
    `;
    container.appendChild(groupDiv);
}

/**
 * Universal helper to download any canvas as PNG
 */
function downloadCanvas(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function runSummaryCalculation() {
    const testType = document.getElementById('summary-test-select').value;
    const tail = document.getElementById('summary-test-tail')?.value || 'two';
    const resBanner = document.getElementById('summary-test-results-banner');
    const statBlock = document.getElementById('summary-stat-block');
    const verdictBadge = document.getElementById('summary-verdict-badge');

    resBanner.style.display = 'block';
    statBlock.innerHTML = '';

    try {
        if (testType === 'unpaired-t') {
            const name1 = document.getElementById('sum-g1-name').value || 'Group 1';
            const m1 = parseFloat(document.getElementById('sum-g1-mean').value);
            const med1 = parseFloat(document.getElementById('sum-g1-median').value);
            const iqr1 = parseFloat(document.getElementById('sum-g1-iqr').value);
            const min1 = parseFloat(document.getElementById('sum-g1-min').value);
            const max1 = parseFloat(document.getElementById('sum-g1-max').value);
            const s1 = parseFloat(document.getElementById('sum-g1-sd').value);
            const n1 = parseFloat(document.getElementById('sum-g1-n').value);

            const name2 = document.getElementById('sum-g2-name').value || 'Group 2';
            const m2 = parseFloat(document.getElementById('sum-g2-mean').value);
            const med2 = parseFloat(document.getElementById('sum-g2-median').value);
            const iqr2 = parseFloat(document.getElementById('sum-g2-iqr').value);
            const min2 = parseFloat(document.getElementById('sum-g2-min').value);
            const max2 = parseFloat(document.getElementById('sum-g2-max').value);
            const s2 = parseFloat(document.getElementById('sum-g2-sd').value);
            const n2 = parseFloat(document.getElementById('sum-g2-n').value);

            if ([m1, s1, n1, m2, s2, n2].some(isNaN) || n1 < 2 || n2 < 2) throw new Error("Invalid inputs.");

            // Welch's T-Test
            const v1 = (s1 * s1);
            const v2 = (s2 * s2);
            const se = Math.sqrt((v1 / n1) + (v2 / n2));
            const t = (m1 - m2) / se;

            // Degrees of Freedom (Welch-Satterthwaite)
            const dfNum = Math.pow((v1 / n1) + (v2 / n2), 2);
            const dfDen = (Math.pow(v1 / n1, 2) / (n1 - 1)) + (Math.pow(v2 / n2, 2) / (n2 - 1));
            const df = dfNum / dfDen;

            // P-value
            let p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
            if (tail === 'one') p = p / 2;

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">T-Statistic</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #60a5fa;">${t.toFixed(3)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Degrees of Freedom</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #a78bfa;">${df.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">P-Value (${tail === 'one' ? '1-Tailed' : '2-Tailed'})</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;
            setSummaryVerdict(p); // Legacy call helper
            const effectSize = Math.abs(m1 - m2) / Math.sqrt((v1 + v2) / 2); // Pooled Cohen's d
            verdictBadge.innerHTML = generateMedicalInterpretation(p, 't-test', { cohenD: effectSize });
            drawSummaryChart(testType, { name1, m1, s1, med1, iqr1, min1, max1, name2, m2, s2, med2, iqr2, min2, max2 });

        } else if (testType === 'paired-t') {
            const diffName = document.getElementById('sum-diff-name').value || 'Difference Scores';
            const meanDiff = parseFloat(document.getElementById('sum-diff-mean').value);
            const medDiff = parseFloat(document.getElementById('sum-diff-median').value);
            const iqrDiff = parseFloat(document.getElementById('sum-diff-iqr').value);
            const minDiff = parseFloat(document.getElementById('sum-diff-min').value);
            const maxDiff = parseFloat(document.getElementById('sum-diff-max').value);
            const sdDiff = parseFloat(document.getElementById('sum-diff-sd').value);
            const n = parseFloat(document.getElementById('sum-diff-n').value);

            if ([meanDiff, sdDiff, n].some(isNaN) || n < 2) throw new Error("Invalid inputs.");

            const se = sdDiff / Math.sqrt(n);
            const t = meanDiff / se;
            const df = n - 1;

            let p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
            if (tail === 'one') p = p / 2;

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">T-Statistic</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #fbbf24;">${t.toFixed(3)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Degrees of Freedom</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #a78bfa;">${df}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">P-Value (${tail === 'one' ? '1-Tailed' : '2-Tailed'})</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;
            const effectSize = Math.abs(meanDiff) / sdDiff; // Cohen's d for paired
            verdictBadge.innerHTML = generateMedicalInterpretation(p, 't-test', { cohenD: effectSize });
            drawSummaryChart(testType, { diffName, meanDiff, sdDiff, medDiff, iqrDiff, minDiff, maxDiff });

        } else if (testType === 'chi-square') {
            const a = parseFloat(document.getElementById('sum-cell-a').value);
            const b = parseFloat(document.getElementById('sum-cell-b').value);
            const c = parseFloat(document.getElementById('sum-cell-c').value);
            const d = parseFloat(document.getElementById('sum-cell-d').value);

            if ([a, b, c, d].some(isNaN)) throw new Error("Invalid inputs.");

            const total = a + b + c + d;
            const r1 = a + b;
            const r2 = c + d;
            const c1 = a + c;
            const c2 = b + d;

            const ea = (r1 * c1) / total;
            const eb = (r1 * c2) / total;
            const ec = (r2 * c1) / total;
            const ed = (r2 * c2) / total;

            const chi2 = Math.pow(a - ea, 2) / ea +
                Math.pow(b - eb, 2) / eb +
                Math.pow(c - ec, 2) / ec +
                Math.pow(d - ed, 2) / ed;

            const df = 1; // 2x2 table
            const p = 1 - jStat.chisquare.cdf(chi2, df);

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Chi-Square (\u03C7\u00B2)</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #34d399;">${chi2.toFixed(3)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Degrees of Freedom</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #a78bfa;">${df}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">P-Value</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;
            verdictBadge.innerHTML = generateMedicalInterpretation(p, 'categorical', {});
            drawSummaryChart(testType, { a, b, c, d });

        } else if (testType === 'fisher-exact') {
            const a = parseFloat(document.getElementById('sum-cell-a').value);
            const b = parseFloat(document.getElementById('sum-cell-b').value);
            const c = parseFloat(document.getElementById('sum-cell-c').value);
            const d = parseFloat(document.getElementById('sum-cell-d').value);

            // Must be integers >= 0
            if ([a, b, c, d].some(x => isNaN(x) || !Number.isInteger(x) || x < 0)) {
                throw new Error("Fisher's Exact Test requires non-negative integers.");
            }

            const n = a + b + c + d;

            // Helper function to calculate exact log(n!) to prevent infinity overloads
            function logFactorial(x) {
                if (x === 0 || x === 1) return 0;
                // Stirling's Approximation with Ramanujan's correction for high precision
                return x * Math.log(x) - x + (Math.log(x * (1 + 4 * x * (1 + 2 * x)))) / 6 + Math.log(Math.PI) / 2;
            }

            // Calculate exact probability of a specific table configuration
            function exactProb(a2, b2, c2, d2) {
                const n2 = a2 + b2 + c2 + d2;
                return Math.exp(
                    logFactorial(a2 + b2) + logFactorial(c2 + d2) +
                    logFactorial(a2 + c2) + logFactorial(b2 + d2) -
                    (logFactorial(a2) + logFactorial(b2) + logFactorial(c2) + logFactorial(d2) + logFactorial(n2))
                );
            }

            // Calculate the probability of the observed table
            const pObserved = exactProb(a, b, c, d);

            // To find the two-tailed p-value, we must generate all possible tables
            // with the same marginal totals, calculate their probabilities, 
            // and sum up the probabilities of those tables that are <= pObserved.
            let pTwoTailed = 0;
            const row1 = a + b;
            const col1 = a + c;

            // The value of 'a' can range from max(0, row1+col1-n) to min(row1, col1)
            const minA = Math.max(0, row1 + col1 - n);
            const maxA = Math.min(row1, col1);

            for (let i = minA; i <= maxA; i++) {
                const currentProb = exactProb(
                    i,              // new A
                    row1 - i,       // new B
                    col1 - i,       // new C
                    n - row1 - col1 + i // new D (total - row1 - col1 + a)
                );

                // Add to p-value if the probability is less than or equal to observed (accounting for floating point math)
                if (currentProb <= pObserved + 1e-9) {
                    pTwoTailed += currentProb;
                }
            }

            // Cap at 1.0 (sometimes floating point math gets slightly > 1)
            const p = Math.min(1.0, pTwoTailed);

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Sample Size (N)</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #a78bfa;">${n}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Exact P-Value</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;
            verdictBadge.innerHTML = generateMedicalInterpretation(p, 'categorical', {});
            drawSummaryChart(testType, { a, b, c, d });

        } else if (testType === 'anova') {
            const groupRows = document.querySelectorAll('.anova-group-row');
            const groups = [];
            groupRows.forEach(row => {
                const name = row.querySelector('.anova-name').value;
                const m = parseFloat(row.querySelector('.anova-mean').value);
                const s = parseFloat(row.querySelector('.anova-sd').value);
                const n = parseFloat(row.querySelector('.anova-n').value);
                if (!isNaN(m) && !isNaN(s) && !isNaN(n) && n > 1) {
                    groups.push({ name, m, s, n });
                }
            });

            if (groups.length < 2) throw new Error("At least 2 valid groups are required.");

            // Calculate Grand Mean
            let totalN = 0;
            let sumX = 0;
            groups.forEach(g => {
                totalN += g.n;
                sumX += g.m * g.n;
            });
            const grandMean = sumX / totalN;

            // SSB (Between)
            let ssb = 0;
            groups.forEach(g => {
                ssb += g.n * Math.pow(g.m - grandMean, 2);
            });
            const dfb = groups.length - 1;
            const msb = ssb / dfb;

            // SSW (Within)
            let ssw = 0;
            groups.forEach(g => {
                const groupVar = Math.pow(g.s, 2);
                ssw += (g.n - 1) * groupVar;
            });
            const dfw = totalN - groups.length;
            const msw = ssw / dfw;

            const f = msb / msw;
            const p = 1 - jStat.centralF.cdf(f, dfb, dfw);

            // Effect Size: Eta-squared = SSB / SSTotal
            const eta2 = ssb / (ssb + ssw);

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">F-Statistic</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #a78bfa;">${f.toFixed(3)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Groups (k)</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #60a5fa;">${groups.length}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">P-Value</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;

            const interpretation = generateMedicalInterpretation(p, 'anova', { eta2 });
            verdictBadge.innerHTML = interpretation;
            drawSummaryChart(testType, { groups });

        } else if (testType === 'correlation') {
            const r = parseFloat(document.getElementById('sum-corr-r').value);
            const n = parseFloat(document.getElementById('sum-corr-n').value);

            if (isNaN(r) || isNaN(n) || n < 3) throw new Error("Please enter valid R (-1 to 1) and N (>2).");
            if (Math.abs(r) >= 1) {
                // Perfect correlation
                const p = 0.0000;
                statBlock.innerHTML = `<div style="padding:1rem;"><strong>Perfect Correlation (p < 0.0001)</strong></div>`;
                verdictBadge.innerHTML = generateMedicalInterpretation(p, 'correlation', { r });
                drawSummaryChart(testType, { r });
                return;
            }

            const df = n - 2;
            const t = r * Math.sqrt(df / (1 - r * r));
            let p = jStat.ttest(t, df, 2);
            if (tail === 'one') p = p / 2;

            statBlock.innerHTML = `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">Correlation (R)</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: #fbbf24;">${r.toFixed(3)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem 2rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">P-Value (${tail === 'one' ? '1-Tailed' : '2-Tailed'})</div>
                    <div style="font-size: 1.8rem; font-weight: 700; color: ${p < 0.05 ? '#f472b6' : '#94a3b8'};">${p < 0.0001 ? '<0.0001' : p.toFixed(4)}</div>
                </div>
            `;
            verdictBadge.innerHTML = generateMedicalInterpretation(p, 'correlation', { r });
            drawSummaryChart(testType, { r });
        }
    } catch (e) {
        statBlock.innerHTML = `<div style="color: #f87171; padding: 1rem; border: 1px solid #f87171; border-radius: 8px; width: 100%;">Please fill out all input fields with valid numbers to calculate the result.</div>`;
        verdictBadge.innerText = "Awaiting Valid Data...";
        verdictBadge.style.background = "rgba(255,255,255,0.1)";
        verdictBadge.style.color = "#fff";
        verdictBadge.style.border = "none";
    }
}

function setSummaryVerdict(p) {
    // Keep for legacy callers if any, but routing to the new engine
    return p <= 0.05;
}

function generateMedicalInterpretation(p, testType, metrics = {}) {
    let title = "";
    let color = "";
    let border = "";
    let advice = "";
    let effectText = "";

    if (p <= 0.05) {
        title = "Statistically Significant Result (p \u2264 0.05)";
        color = "#f472b6";
        border = "1px solid rgba(244, 114, 182, 0.5)";
        advice = "The data suggests a statistically significant difference that is unlikely to be due to random chance.";
    } else {
        title = "Not Statistically Significant (p > 0.05)";
        color = "#cbd5e1";
        border = "1px solid rgba(148, 163, 184, 0.5)";
        advice = "We fail to reject the null hypothesis. The observed results could potentially arise from random sampling variability.";
    }

    // Effect Size Context
    if (testType === 't-test' && metrics.cohenD !== undefined) {
        const d = metrics.cohenD;
        let magnitude = d < 0.2 ? "Negligible" : d < 0.5 ? "Small" : d < 0.8 ? "Medium" : "Large";
        effectText = `<div style="margin-top:0.5rem; font-size:0.9rem; color:#94a3b8;">Effect Size (Cohen's d): <strong>${d.toFixed(3)}</strong> (${magnitude})</div>`;

        if (p <= 0.05 && d < 0.5) {
            advice += " <br><strong>Clinical Note:</strong> While statistically significant, the effect size is small. In a clinical setting, this may mean the treatment effect is not large enough to change standard patient care.";
        } else if (p <= 0.05 && d >= 0.8) {
            advice += " <br><strong>Clinical Note:</strong> Significant p-value combined with a large effect size suggests a highly impactful clinical finding.";
        }
    } else if (testType === 'anova' && metrics.eta2 !== undefined) {
        const eta = metrics.eta2;
        let magnitude = eta < 0.01 ? "Negligible" : eta < 0.06 ? "Small" : eta < 0.14 ? "Medium" : "Large";
        effectText = `<div style="margin-top:0.5rem; font-size:0.9rem; color:#94a3b8;">Effect Size (\u03B7\u00B2): <strong>${eta.toFixed(3)}</strong> (${magnitude})</div>`;
        advice += ` <br>This suggests that approximately <strong>${(eta * 100).toFixed(1)}%</strong> of the variance in the outcome is explained by the group assignment.`;
    } else if (testType === 'correlation' && metrics.r !== undefined) {
        const r = Math.abs(metrics.r);
        let magnitude = r < 0.1 ? "Negligible" : r < 0.3 ? "Small" : r < 0.5 ? "Medium" : "Large/Strong";
        effectText = `<div style="margin-top:0.5rem; font-size:0.9rem; color:#94a3b8;">Relationship Strength: <strong>${magnitude}</strong> (|r| = ${r.toFixed(2)})</div>`;

        if (p <= 0.05) {
            advice = `There is a statistically significant <strong>${metrics.r > 0 ? "positive" : "negative"}</strong> linear relationship between the variables.`;
        } else {
            advice = "The observed relationship is not statistically significant and could be due to chance factors.";
        }
    }

    return `
        <div style="text-align: left; padding: 0.5rem;">
            <strong style="color: ${color}; font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">${title}</strong>
            <span style="font-size: 1rem; font-weight: normal; opacity: 0.9;">${advice}</span>
            ${effectText}
        </div>
    `;
}

// ---------------------------------------------------------
// Summary Statistics Dynamic Plotting & Download
// ---------------------------------------------------------


function drawSummaryChart(testType, plotData) {
    const chartContainer = document.getElementById('summary-chart-container');
    const canvas = document.getElementById('summary-result-chart');

    // Show container
    chartContainer.style.display = 'block';

    if (summaryResultChart) {
        summaryResultChart.destroy();
    }

    let config = {};

    // 1. Bar Chart for Contingency Tables (Chi-Square & Fisher)
    if (testType === 'chi-square' || testType === 'fisher-exact') {
        config = {
            type: 'bar',
            data: {
                labels: ['Exposure Present', 'Exposure Absent'],
                datasets: [
                    {
                        label: 'Outcome Positive',
                        data: [plotData.a, plotData.c],
                        backgroundColor: 'rgba(96, 165, 250, 0.8)',
                    },
                    {
                        label: 'Outcome Negative',
                        data: [plotData.b, plotData.d],
                        backgroundColor: 'rgba(236, 72, 153, 0.8)', // Pink theme
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Contingency Table Counts', color: '#fff', font: { size: 16 } },
                    legend: { labels: { color: '#cbd5e1' } }
                },
                scales: {
                    x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Raw Counts', color: '#94a3b8' } }
                }
            }
        };
    } else if (testType === 'correlation') {
        const rVal = plotData.r;
        config = {
            type: 'bar',
            data: {
                labels: ['Relationship Strength'],
                datasets: [{
                    label: "Pearson's R",
                    data: [rVal],
                    backgroundColor: rVal > 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)',
                    borderColor: rVal > 0 ? '#34d399' : '#f87171',
                    borderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Linear Relationship Direction & Magnitude', color: '#fff' },
                    tooltip: { enabled: true }
                },
                scales: {
                    x: { min: -1.1, max: 1.1, ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { display: false } }
                }
            }
        };
    }
    // 2. Simulated Boxplot for Continuous Data Comparisons (T-Tests & ANOVA)
    else {
        // Function to build Box Plot array
        const generateBoxArray = (mean, sd, med, iqr, min, max) => {
            // First determine Whiskers (Min / Max)
            const finalMin = !isNaN(min) ? min : (mean - (3 * sd));
            const finalMax = !isNaN(max) ? max : (mean + (3 * sd));

            // If the user provided actual Median and IQR, use them for precise Q1/Median/Q3!
            if (!isNaN(med) && !isNaN(iqr) && iqr > 0) {
                return [
                    finalMin,            // Min Whiskers
                    med - (iqr / 2),     // Q1 (Precise)
                    med,                 // Median (Precise)
                    med + (iqr / 2),     // Q3 (Precise)
                    finalMax             // Max Whiskers
                ];
            } else {
                // Fallback simulation assuming normal distribution if they skipped the fields
                return [
                    finalMin,           // Min (Whiskers)
                    mean - (0.67 * sd), // Q1
                    mean,               // Median
                    mean + (0.67 * sd), // Q3
                    finalMax            // Max (Whiskers)
                ];
            }
        };

        const chartDatasets = [];

        if (testType === 'unpaired-t') {
            chartDatasets.push({
                label: plotData.name1 || 'Group 1',
                backgroundColor: 'rgba(96, 165, 250, 0.5)',
                borderColor: '#60a5fa',
                borderWidth: 2,
                data: [generateBoxArray(plotData.m1, plotData.s1, plotData.med1, plotData.iqr1, plotData.min1, plotData.max1)]
            });
            chartDatasets.push({
                label: plotData.name2 || 'Group 2',
                backgroundColor: 'rgba(236, 72, 153, 0.5)', // Pink theme
                borderColor: '#ec4899',
                borderWidth: 2,
                data: [generateBoxArray(plotData.m2, plotData.s2, plotData.med2, plotData.iqr2, plotData.min2, plotData.max2)]
            });
        } else if (testType === 'paired-t') {
            chartDatasets.push({
                label: plotData.diffName || 'Difference Scores',
                backgroundColor: 'rgba(251, 191, 36, 0.5)',
                borderColor: '#fbbf24',
                borderWidth: 2,
                data: [generateBoxArray(plotData.meanDiff, plotData.sdDiff, plotData.medDiff, plotData.iqrDiff, plotData.minDiff, plotData.maxDiff)]
            });
        } else if (testType === 'anova') {
            plotData.groups.forEach((g, idx) => {
                const colors = ['#60a5fa', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#f87171'];
                const color = colors[idx % colors.length];
                chartDatasets.push({
                    label: g.name,
                    backgroundColor: color + '80', // 50% opacity
                    borderColor: color,
                    borderWidth: 2,
                    data: [generateBoxArray(g.m, g.s, NaN, NaN, NaN, NaN)] // Summary ANOVA usually doesn't have median/min/max unless we add inputs
                });
            });
        }

        config = {
            type: 'boxplot',
            data: {
                labels: ['Distribution Overview'],
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: testType === 'anova' || testType === 'unpaired-t' || testType === 'paired-t' ? 'Box Plot Comparison' : 'Distribution Viewer', color: '#fff', font: { size: 16 } },
                    subtitle: { display: true, text: testType === 'anova' ? 'Summary-based Box Plot approximations (Mean \u00B1 3SD)' : 'Boxes show IQR. Whiskers show True Min/Max.', color: '#94a3b8' },
                    legend: { labels: { color: '#cbd5e1' } }
                },
                scales: {
                    x: { ticks: { color: '#cbd5e1' }, grid: { display: false } },
                    y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        };
    }

    // Render Request
    const ctx = canvas.getContext('2d');
    summaryResultChart = new Chart(ctx, config);
}

// Download Excel Template Function
function downloadExcelTemplate() {
    const data = [
        ["Group", "Age", "BloodPressure", "Outcome"],
        ["Treatment", 45, 120.5, "Recovered"],
        ["Control", 52, 135.2, "Not Recovered"],
        ["Treatment", 38, 118.0, "Recovered"],
        ["Control", 61, 142.8, "Not Recovered"],
        ["Treatment", 41, 122.1, "Not Recovered"],
        ["Control", 55, 138.5, "Recovered"],
        ["Treatment", 33, 115.4, "Recovered"],
        ["Control", 48, 129.0, "Recovered"]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, "EpiSense_Stats_Template.xlsx");
}
