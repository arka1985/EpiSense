// ==========================================
// VIEW SWITCHING LOGIC
// ==========================================
function switchThemeTab(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(viewId).style.display = 'block';

    // Find the button that called this and make active
    const targetBtn = Array.from(document.querySelectorAll('.main-tab-btn')).find(btn => btn.getAttribute('onclick').includes(viewId));
    if (targetBtn) targetBtn.classList.add('active');

    // Re-render plotly charts to fix size issues when display:none is toggled
    if (viewId === 'combination-view') {
        calculateAndRenderCombo();
    } else if (viewId === 'roc-curve-view') {
        renderROCorDistributions();
    }
}

// ==========================================
// 1. PPV / NPV MONTE CARLO SIMULATION LOGIC
// ==========================================
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateMean(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
}

function calculateStdDev(arr) {
    const mean = calculateMean(arr);
    const avgSquareDiff = calculateMean(arr.map(val => Math.pow(val - mean, 2)));
    return Math.sqrt(avgSquareDiff);
}

function runSimulation() {
    const senMin = parseInt(document.getElementById('sen-min').value);
    const senMax = parseInt(document.getElementById('sen-max').value);
    const spMin = parseInt(document.getElementById('sp-min').value);
    const spMax = parseInt(document.getElementById('sp-max').value);
    const prevMin = parseInt(document.getElementById('prev-min').value);
    const prevMax = parseInt(document.getElementById('prev-max').value);

    let numSimsInput = parseInt(document.getElementById('num-sims').value);
    const numSimulations = isNaN(numSimsInput) ? 100 : numSimsInput;
    const samplesPerSim = 100;

    let all_ppv_means = [];
    let all_npv_means = [];

    for (let i = 0; i < numSimulations; i++) {
        let ppv_sum = 0, npv_sum = 0;
        for (let j = 0; j < samplesPerSim; j++) {
            let s = getRandomInt(senMin, senMax) / 100;
            let sp = getRandomInt(spMin, spMax) / 100;
            let p = getRandomInt(prevMin, prevMax) / 100;

            let ppv_denom = (s * p) + ((1 - sp) * (1 - p));
            let ppv = ppv_denom === 0 ? 0 : (s * p) / ppv_denom;

            let npv_denom = ((1 - s) * p) + (sp * (1 - p));
            let npv = npv_denom === 0 ? 0 : (sp * (1 - p)) / npv_denom;

            ppv_sum += ppv; npv_sum += npv;
        }
        all_ppv_means.push(ppv_sum / samplesPerSim);
        all_npv_means.push(npv_sum / samplesPerSim);
    }

    const ppv_mean_total = calculateMean(all_ppv_means);
    const ppv_std_total = calculateStdDev(all_ppv_means);
    const npv_mean_total = calculateMean(all_npv_means);
    const npv_std_total = calculateStdDev(all_npv_means);

    document.getElementById('ppv-result').textContent = `${(ppv_mean_total * 100).toFixed(2)}% (SD ${(ppv_std_total * 100).toFixed(2)})`;
    document.getElementById('npv-result').textContent = `${(npv_mean_total * 100).toFixed(2)}% (SD ${(npv_std_total * 100).toFixed(2)})`;

    plotDistribution('chart-ppv', all_ppv_means, 'Positive Predictive Value (Mean)', '#00f3ff');
    plotDistribution('chart-npv', all_npv_means, 'Negative Predictive Value (Mean)', '#bc13fe');

    generateInterpretation(ppv_mean_total, npv_mean_total, senMin, senMax, spMin, spMax, prevMin, prevMax);
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

function generateInterpretation(ppv, npv, senMin, senMax, spMin, spMax, prevMin, prevMax) {
    const ppvPerc = (ppv * 100).toFixed(2);
    const npvPerc = (npv * 100).toFixed(2);

    document.getElementById('interpretation-content').innerHTML = `
        <p style="margin-bottom: 1rem;">
            Based on a Disease Prevalence of <strong>${prevMin}-${prevMax}%</strong>, Sensitivity of <strong>${senMin}-${senMax}%</strong>, and Specificity of <strong>${spMin}-${spMax}%</strong>:
        </p>
        <ul style="margin-left: 20px; list-style-type: disc;">
            <li style="margin-bottom: 0.5rem;">
                <strong style="color: var(--primary-neon);">Positive Predictive Value (${ppvPerc}%):</strong> 
                If a patient tests POSITIVE, there is a ${ppvPerc}% probability they truly have the disease. 
            </li>
            <li style="margin-bottom: 0.5rem;">
                <strong style="color: var(--danger-neon);">Negative Predictive Value (${npvPerc}%):</strong> 
                If a patient tests NEGATIVE, there is a ${npvPerc}% probability they are truly disease-free.
            </li>
        </ul>
    `;
}

// Basic KDE setup for Plotly graphs
function kernelDensityEstimator(kernel, X) {
    return function (V) { return X.map(x => kernel(x - V)).reduce((a, b) => a + b, 0) / X.length; };
}
function gaussianKernel(sigma) {
    return function (u) { return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow(u / sigma, 2)); };
}

function plotDistribution(elementId, data, title, color) {
    const dataPercent = data.map(v => v * 100);
    const minVal = Math.min(...dataPercent), maxVal = Math.max(...dataPercent);

    const histogramTrace = {
        x: dataPercent,
        type: 'histogram',
        histnorm: 'probability',
        name: 'Probability',
        yaxis: 'y2',
        marker: { color: color, opacity: 0.5, line: { color: '#fff', width: 1 } },
        xbins: { start: minVal, end: maxVal, size: (maxVal - minVal) / 20 }
    };

    const std = calculateStdDev(dataPercent);
    let bandwidth = 1.06 * std * Math.pow(dataPercent.length, -0.2);
    if (bandwidth === 0) bandwidth = 1;

    const kde = kernelDensityEstimator(gaussianKernel(bandwidth), dataPercent);
    const xRange = maxVal - minVal;
    let xPoints = [], yPoints = [];

    for (let x = minVal - (xRange * 0.1); x <= maxVal + (xRange * 0.1); x += (maxVal - minVal + xRange * 0.2) / 100) {
        xPoints.push(x); yPoints.push(kde(x));
    }

    const kdeTrace = {
        x: xPoints, y: yPoints,
        mode: 'lines', name: 'Distribution (Density)', yaxis: 'y',
        line: { color: color === '#00f3ff' ? '#ccffff' : '#ffccff', width: 3, shape: 'spline' }
    };

    const layout = {
        title: { text: title, font: { color: '#fff' } },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'Value (%)', color: '#ccc', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Density', color: '#ccc', gridcolor: 'rgba(255,255,255,0.1)', side: 'left' },
        yaxis2: { title: 'Probability', color: '#ccc', overlaying: 'y', side: 'right' },
        margin: { t: 40, b: 40, l: 50, r: 50 },
        showlegend: false
    };

    Plotly.newPlot(elementId, [histogramTrace, kdeTrace], layout, { responsive: true, displayModeBar: false });
}

// Dual Slider Setup for Simulation
function setupDualSlider(minId, maxId, trackId, updateLabelId) {
    const minSlider = document.getElementById(minId);
    const maxSlider = document.getElementById(maxId);
    const track = document.getElementById(trackId);
    const label = document.getElementById(updateLabelId);

    function enforceConstraints() {
        let v1 = parseInt(minSlider.value);
        let v2 = parseInt(maxSlider.value);
        if (v1 >= v2 - 5) {
            if (this === minSlider) minSlider.value = v2 - 5;
            else maxSlider.value = v1 + 5;
        }
        renderTrack();
    }

    function renderTrack() {
        let v1 = parseInt(minSlider.value), v2 = parseInt(maxSlider.value);
        label.textContent = `(${v1}, ${v2})`;
        track.style.left = v1 + "%";
        track.style.width = (v2 - v1) + "%";
    }

    minSlider.addEventListener('input', enforceConstraints);
    maxSlider.addEventListener('input', enforceConstraints);
    renderTrack();
}


// ==========================================
// 2. TEST COMBINATIONS & HEATMAP LOGIC
// ==========================================

let comboMode = 'parallel';

function switchComboMode(mode) {
    comboMode = mode;
    document.querySelectorAll('.combo-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    calculateAndRenderCombo();
}

function calculateAndRenderCombo() {
    const senA = parseFloat(document.getElementById('testa-sen').value) / 100;
    const spA = parseFloat(document.getElementById('testa-sp').value) / 100;
    const senB = parseFloat(document.getElementById('testb-sen').value) / 100;
    const spB = parseFloat(document.getElementById('testb-sp').value) / 100;
    const prev = parseFloat(document.getElementById('prev-combo').value) / 100;

    let netSen, netSp;

    if (comboMode === 'parallel') {
        netSen = senA + senB - (senA * senB);
        netSp = spA * spB;
    } else {
        netSen = senA * senB;
        netSp = spA + spB - (spA * spB);
    }

    const N = 1000;
    const actualSick = Math.round(N * prev);
    const actualHealthy = N - actualSick;

    const tp = Math.round(actualSick * netSen);
    const fn = actualSick - tp;

    const tn = Math.round(actualHealthy * netSp);
    const fp = actualHealthy - tn;

    const allPos = tp + fp, allNeg = tn + fn;
    const ppv = allPos > 0 ? (tp / allPos) : 0;
    const npv = allNeg > 0 ? (tn / allNeg) : 0;

    animateValue("res-sen", netSen * 100, "%");
    animateValue("res-sp", netSp * 100, "%");
    animateValue("res-ppv", ppv * 100, "%");
    animateValue("res-npv", npv * 100, "%");

    renderConfusionHeatmap(tp, fp, tn, fn);
}

function animateValue(id, value, suffix) {
    const el = document.getElementById(id);
    if (el) el.innerText = value.toFixed(1) + suffix;
}

// Plotly UI for Confusion Matrix Heatmap
function renderConfusionHeatmap(tp, fp, tn, fn) {
    // Redesigned plotting logic for 2D confusion matrix:
    // User asked to start with TP and end with TN.
    // 1st Row: Actual Sick -> TP (Screen +), FN (Screen -)
    // 2nd Row: Actual Healthy -> FP (Screen +), TN (Screen -)

    const zData = [
        [fp, tn], // Row 0 (bottom visual row): FP, TN
        [tp, fn]  // Row 1 (top visual row): TP, FN
    ];

    const textData = [
        [`False Positives (FP): ${fp}<br>Type I Error`, `True Negatives (TN): ${tn}<br>Healthy & Correct`],
        [`True Positives (TP): ${tp}<br>Sick & Correct`, `False Negatives (FN): ${fn}<br>Type II Error`]
    ];

    const data = [{
        z: zData,
        x: ['Screen Positive (+)', 'Screen Negative (-)'],
        y: ['Actually Healthy (-)', 'Actually Sick (+)'],
        type: 'heatmap',
        hoverinfo: 'text',
        text: textData,
        texttemplate: "%{text}",
        textfont: {
            family: 'Outfit, sans-serif',
            size: 16,
            color: '#ffffff'
        },
        colorscale: [
            ['0.0', 'rgba(0, 243, 255, 0.1)'], // Dark/transparent blue
            ['0.5', '#bc13fe'],                // Purple mid
            ['1.0', '#34d399']                 // Neon Green high 
        ],
        showscale: false
    }];

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 20, l: 150, r: 20, b: 50 }, // Increased left padding (l: 150)
        font: { color: '#ccc', size: 14, family: 'Outfit, sans-serif' },
        xaxis: { title: 'Test Result Given', autorange: true, showgrid: false },
        yaxis: { title: 'Actual Patient Status', tickangle: 0, tickpad: 15, autorange: true, showgrid: false }, // Added tickpad
        height: 350
    };

    Plotly.newPlot('heatmap-chart', data, layout, { responsive: true, displayModeBar: false });
}

// ==========================================
// 3. CUSTOM 2X2 TABLE LOGIC
// ==========================================
function calculateCustomTable() {
    const tp = parseInt(document.getElementById('input-tp').value) || 0;
    const fp = parseInt(document.getElementById('input-fp').value) || 0;
    const fn = parseInt(document.getElementById('input-fn').value) || 0;
    const tn = parseInt(document.getElementById('input-tn').value) || 0;

    const actualSick = tp + fn;
    const actualHealthy = fp + tn;
    const screenPos = tp + fp;
    const screenNeg = fn + tn;
    const total = tp + fp + fn + tn;

    const sen = actualSick > 0 ? (tp / actualSick) : 0;
    const sp = actualHealthy > 0 ? (tn / actualHealthy) : 0;
    const ppv = screenPos > 0 ? (tp / screenPos) : 0;
    const npv = screenNeg > 0 ? (tn / screenNeg) : 0;
    const acc = total > 0 ? ((tp + tn) / total) : 0;
    const prev = total > 0 ? (actualSick / total) : 0;

    animateValue('calc-sen', Math.round(sen * 1000) / 10, "%");
    animateValue('calc-sp', Math.round(sp * 1000) / 10, "%");
    animateValue('calc-ppv', Math.round(ppv * 1000) / 10, "%");
    animateValue('calc-npv', Math.round(npv * 1000) / 10, "%");
    animateValue('calc-acc', Math.round(acc * 1000) / 10, "%");
    animateValue('calc-prev', Math.round(prev * 1000) / 10, "%");
}


// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Simulation Dual Sliders
    setupDualSlider('sen-min', 'sen-max', 'sen-track', 'sen-val');
    setupDualSlider('sp-min', 'sp-max', 'sp-track', 'sp-val');
    setupDualSlider('prev-min', 'prev-max', 'prev-track', 'prev-val');
    document.getElementById('run-btn').addEventListener('click', runSimulation);

    // 2. Setup Combination Single Sliders
    ['testa-sen', 'testa-sp', 'testb-sen', 'testb-sp', 'prev-combo'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            document.getElementById(id + '-val').innerText = e.target.value + '%';
            calculateAndRenderCombo();
        });
    });

    // Run combo calculation immediately
    calculateAndRenderCombo();

    // 3. Setup Custom Table Inputs
    ['input-tp', 'input-fp', 'input-fn', 'input-tn'].forEach(id => {
        document.getElementById(id).addEventListener('input', calculateCustomTable);
    });

    // Run custom table immediately
    calculateCustomTable();

    // 4. Setup ROC Curve
    document.getElementById('roc-threshold').addEventListener('input', (e) => {
        document.getElementById('roc-threshold-val').innerText = e.target.value;
        renderROCorDistributions();
    });
    renderROCorDistributions();
});

// ==========================================
// 4. ROC CURVE ANALYSIS
// ==========================================
function normalPDF(x, mean, std) {
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function normalCDF(x, mean, std) {
    let z = (x - mean) / Math.sqrt(2 * std * std);
    let t = 1 / (1 + 0.3275911 * Math.abs(z));
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    let sign = (z < 0) ? -1 : 1;
    return 0.5 * (1 + sign * erf);
}

function renderROCorDistributions() {
    const thresholdElem = document.getElementById('roc-threshold');
    if (!thresholdElem) return;
    const threshold = parseInt(thresholdElem.value);

    // Hardcoded distributions for demonstration
    const hMean = 35, hStd = 15;
    const dMean = 65, dStd = 15;

    // Calculate rates
    // Positive test means value > threshold
    const fpr = 1 - normalCDF(threshold, hMean, hStd);
    const tpr = 1 - normalCDF(threshold, dMean, dStd);

    // Update metric boxes
    document.getElementById('roc-sen-val').innerText = (tpr * 100).toFixed(1) + '%';
    document.getElementById('roc-fpr-val').innerText = (fpr * 100).toFixed(1) + '%';

    // 1. Plotly Distribution Chart (PDFs)
    let xVals = [], hVals = [], dVals = [];
    for (let i = 0; i <= 100; i++) {
        xVals.push(i);
        hVals.push(normalPDF(i, hMean, hStd));
        dVals.push(normalPDF(i, dMean, dStd));
    }

    const traceH = {
        x: xVals, y: hVals,
        type: 'scatter', mode: 'lines',
        name: 'Healthy', line: { color: '#00f3ff', width: 2 },
        fill: 'tozeroy', fillcolor: 'rgba(0, 243, 255, 0.1)'
    };
    const traceD = {
        x: xVals, y: dVals,
        type: 'scatter', mode: 'lines',
        name: 'Diseased', line: { color: '#ff0055', width: 2 },
        fill: 'tozeroy', fillcolor: 'rgba(255, 0, 85, 0.1)'
    };

    const layoutDist = {
        title: { text: "Population Distributions", font: { color: "#fff", size: 16 } },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { t: 40, b: 40, l: 30, r: 20 },
        font: { color: '#fff' },
        xaxis: { title: 'Test Score / Value', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { showticklabels: false, gridcolor: 'rgba(255,255,255,0.1)', zeroline: false },
        showlegend: true,
        legend: { x: 0.5, y: -0.2, xanchor: 'center', orientation: 'h' },
        shapes: [{
            type: 'line', x0: threshold, x1: threshold, y0: 0, y1: Math.max(...hVals, ...dVals) * 1.1,
            line: { color: '#ffaa00', width: 3, dash: 'dash' }
        }],
        annotations: [{
            x: threshold, y: Math.max(...hVals, ...dVals) * 1.05, text: 'Cutoff', showarrow: false, yshift: 10, font: { color: '#ffaa00' }
        }]
    };

    Plotly.newPlot('roc-distribution-chart', [traceH, traceD], layoutDist, { responsive: true, displayModeBar: false });

    // 2. Plotly ROC Curve (FPR vs TPR across all thresholds 0-100)
    let rocFpr = [], rocTpr = [];
    for (let t = 100; t >= 0; t--) {
        rocFpr.push(1 - normalCDF(t, hMean, hStd));
        rocTpr.push(1 - normalCDF(t, dMean, dStd));
    }

    // Calculate AUC using trapezoidal rule
    let auc = 0;
    for (let i = 0; i < rocFpr.length - 1; i++) {
        auc += (rocFpr[i + 1] - rocFpr[i]) * (rocTpr[i + 1] + rocTpr[i]) / 2;
    }
    const aucElem = document.getElementById('roc-auc-val');
    if (aucElem) aucElem.innerText = auc.toFixed(3);

    const traceRoc = {
        x: rocFpr, y: rocTpr,
        type: 'scatter', mode: 'lines',
        name: 'ROC Curve', line: { color: '#00f3ff', width: 3 },
        fill: 'tozeroy', fillcolor: 'rgba(0, 243, 255, 0.15)'
    };
    const traceRandom = {
        x: [0, 1], y: [0, 1],
        type: 'scatter', mode: 'lines',
        name: 'Random Guess', line: { color: '#888', width: 2, dash: 'dash' },
        hoverinfo: 'none'
    };
    const traceCurrentPoint = {
        x: [fpr], y: [tpr],
        type: 'scatter', mode: 'markers',
        name: 'Current Threshold',
        marker: { color: '#ffaa00', size: 12, line: { color: '#fff', width: 2 } }
    };

    const layoutRoc = {
        title: { text: "ROC Curve", font: { color: "#fff", size: 16 } },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { t: 40, b: 40, l: 50, r: 20 },
        font: { color: '#fff' },
        xaxis: { title: 'False Positive Rate (1 - Specificity)', range: [-0.05, 1.05], gridcolor: 'rgba(255,255,255,0.1)', tickformat: '.0%' },
        yaxis: { title: 'True Positive Rate (Sensitivity)', range: [-0.05, 1.05], gridcolor: 'rgba(255,255,255,0.1)', tickformat: '.0%' },
        showlegend: false
    };

    Plotly.newPlot('roc-curve-chart', [traceRoc, traceRandom, traceCurrentPoint], layoutRoc, { responsive: true, displayModeBar: false });
}
