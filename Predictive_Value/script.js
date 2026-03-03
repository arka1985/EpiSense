// Helper to get random integer between min and max (inclusive)
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Stats helper
function calculateMean(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
}

function calculateStdDev(arr) {
    const mean = calculateMean(arr);
    const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

function runSimulation() {
    // 1. Get Inputs
    const senMin = parseInt(document.getElementById('sen-min').value);
    const senMax = parseInt(document.getElementById('sen-max').value);

    const spMin = parseInt(document.getElementById('sp-min').value);
    const spMax = parseInt(document.getElementById('sp-max').value);

    const prevMin = parseInt(document.getElementById('prev-min').value);
    const prevMax = parseInt(document.getElementById('prev-max').value);

    // Get number of simulations from input, default to 100 if invalid
    let numSimsInput = parseInt(document.getElementById('num-sims').value);
    const numSimulations = isNaN(numSimsInput) ? 100 : numSimsInput;

    const samplesPerSim = 100;

    let all_ppv_means = [];
    let all_npv_means = [];

    for (let i = 0; i < numSimulations; i++) {
        let sen_arr = [];
        let sp_arr = [];
        let prv_arr = [];

        for (let j = 0; j < samplesPerSim; j++) {
            sen_arr.push(getRandomInt(senMin, senMax) / 100);
            sp_arr.push(getRandomInt(spMin, spMax) / 100);
            prv_arr.push(getRandomInt(prevMin, prevMax) / 100);
        }

        let ppv_sum = 0;
        let npv_sum = 0;

        for (let j = 0; j < samplesPerSim; j++) {
            let s = sen_arr[j];
            let p = prv_arr[j];
            let sp = sp_arr[j];

            let ppv_denom = (s * p) + ((1 - sp) * (1 - p));
            let ppv = ppv_denom === 0 ? 0 : (s * p) / ppv_denom;

            let npv_denom = ((1 - s) * p) + (sp * (1 - p));
            let npv = npv_denom === 0 ? 0 : (sp * (1 - p)) / npv_denom;

            ppv_sum += ppv;
            npv_sum += npv;
        }

        all_ppv_means.push(ppv_sum / samplesPerSim);
        all_npv_means.push(npv_sum / samplesPerSim);
    }

    // Calculate Final Stats of the Means
    const ppv_mean_total = calculateMean(all_ppv_means);
    const ppv_std_total = calculateStdDev(all_ppv_means);

    const npv_mean_total = calculateMean(all_npv_means);
    const npv_std_total = calculateStdDev(all_npv_means);

    // Update UI - Format: Mean% (SD)
    const ppv_mean_str = (ppv_mean_total * 100).toFixed(2);
    const ppv_std_str = (ppv_std_total * 100).toFixed(2);
    document.getElementById('ppv-result').textContent = `${ppv_mean_str}% (SD ${ppv_std_str})`;

    const npv_mean_str = (npv_mean_total * 100).toFixed(2);
    const npv_std_str = (npv_std_total * 100).toFixed(2);
    document.getElementById('npv-result').textContent = `${npv_mean_str}% (SD ${npv_std_str})`;

    // Plotting with Plotly
    // PPV Color -> Blue (#00f3ff)
    plotDistribution('chart-ppv', all_ppv_means, 'Positive Predictive Value (Mean of Simulations)', '#00f3ff');
    plotDistribution('chart-npv', all_npv_means, 'Negative Predictive Value (Mean of Simulations)', '#ff0055');

    // Generate Interpretation
    generateInterpretation(
        ppv_mean_total, npv_mean_total,
        senMin, senMax,
        spMin, spMax,
        prevMin, prevMax
    );

    // Scroll to results
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

function generateInterpretation(ppv, npv, senMin, senMax, spMin, spMax, prevMin, prevMax) {
    const ppvPerc = (ppv * 100).toFixed(2);
    const npvPerc = (npv * 100).toFixed(2);

    let interpretationHTML = `
        <p style="margin-bottom: 1rem;">
            Based on the input parameters, with a <strong>Disease Prevalence of ${prevMin}-${prevMax}%</strong>, 
            <strong>Sensitivity of ${senMin}-${senMax}%</strong>, and <strong>Specificity of ${spMin}-${spMax}%</strong>:
        </p>
        <ul style="margin-left: 20px; list-style-type: disc;">
            <li style="margin-bottom: 0.5rem;">
                <strong style="color: var(--primary-neon);">Positive Predictive Value (${ppvPerc}%):</strong> 
                This indicates that if a patient tests <strong>POSITIVE</strong>, there is a ${ppvPerc}% probability that they 
                <span style="color: #fff; text-decoration: underline;">truly have the disease</span>. 
            </li>
            <li style="margin-bottom: 0.5rem;">
                <strong style="color: #ff0055;">Negative Predictive Value (${npvPerc}%):</strong> 
                This indicates that if a patient tests <strong>NEGATIVE</strong>, there is a ${npvPerc}% probability that they are 
                <span style="color: #fff; text-decoration: underline;">truly disease-free</span>.
            </li>
        </ul>
    `;

    document.getElementById('interpretation-content').innerHTML = interpretationHTML;
}

// Simple Gaussian Kernel Density Estimation
function kernelDensityEstimator(kernel, X) {
    return function (V) {
        return X.map(function (x) {
            return kernel(x - V);
        }).reduce(function (a, b) {
            return a + b;
        }, 0) / X.length;
    };
}

function gaussianKernel(sigma) {
    return function (u) {
        return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow(u / sigma, 2));
    };
}

function plotDistribution(elementId, data, title, color) {
    const dataPercent = data.map(v => v * 100);
    const minVal = Math.min(...dataPercent);
    const maxVal = Math.max(...dataPercent);

    // 1. Histogram Trace (Probability)
    // Plotted on Secondary Y Axis (Right) -> Probability
    const histogramTrace = {
        x: dataPercent,
        type: 'histogram',
        histnorm: 'probability',
        name: 'Probability',
        yaxis: 'y2', // Use secondary axis
        marker: {
            color: color,
            opacity: 0.5,
            line: {
                color: '#fff',
                width: 1
            }
        },
        xbins: {
            start: minVal,
            end: maxVal,
            size: (maxVal - minVal) / 20
        }
    };

    // 2. KDE Trace (Density)
    // Plotted on Primary Y Axis (Left) -> Density
    const std = calculateStdDev(dataPercent);
    const n = dataPercent.length;
    let bandwidth = 1.06 * std * Math.pow(n, -0.2);
    if (bandwidth === 0) bandwidth = 1; // fallback if no variance

    const kde = kernelDensityEstimator(gaussianKernel(bandwidth), dataPercent);

    // Generate x points for the line
    const xRange = maxVal - minVal;
    let xPoints = [];
    let yPoints = [];

    // Extend range slightly for better curve visuals
    const plotMin = minVal - (xRange * 0.1);
    const plotMax = maxVal + (xRange * 0.1);

    for (let x = plotMin; x <= plotMax; x += (plotMax - plotMin) / 100) {
        xPoints.push(x);
        yPoints.push(kde(x));
    }

    const kdeTrace = {
        x: xPoints,
        y: yPoints,
        mode: 'lines',
        name: 'Distribution (Density)',
        yaxis: 'y', // Primary axis
        line: {
            color: color === '#00f3ff' ? '#ccffff' : '#ffcccc', // Lighter shade for visibility
            width: 3,
            shape: 'spline'
        }
    };

    const layout = {
        title: {
            text: title,
            font: { color: '#fff' }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            title: 'Value (%)',
            color: '#ccc',
            gridcolor: '#333'
        },
        yaxis: {
            title: 'Density',
            color: '#ccc',
            gridcolor: '#333',
            side: 'left'
        },
        yaxis2: {
            title: 'Probability',
            color: '#ccc',
            gridcolor: 'rgba(255,255,255,0.1)',
            overlaying: 'y',
            side: 'right'
        },
        margin: { t: 40, b: 40, l: 50, r: 50 },
        showlegend: true,
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1,
            font: { color: "#ccc" }
        }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot(elementId, [histogramTrace, kdeTrace], layout, config);
}


// Slider Logic for Dual Handles
function setupDualSlider(minId, maxId, trackId, updateLabelId) {
    const minSlider = document.getElementById(minId);
    const maxSlider = document.getElementById(maxId);
    const track = document.getElementById(trackId);
    const label = document.getElementById(updateLabelId);

    function updateTrack() {
        const minVal = parseInt(minSlider.value);
        const maxVal = parseInt(maxSlider.value);

        // Enforce min <= max
        if (minVal > maxVal) {
            // Determine which one was moved most recently or logic to push
            // Simple logic: if this call triggered by min, push max. 
            // Since we can't easily know who triggered without event arg, 
            // we'll just swap or clamp. 
            // A common HTML dual slider trick is needed usually, 
            // but here we can just clamp relative to each other.
        }
    }

    // We need a better dual slider implementation or just handle constraints
    minSlider.addEventListener('input', () => {
        let v1 = parseInt(minSlider.value);
        let v2 = parseInt(maxSlider.value);
        if (v1 >= v2) {
            minSlider.value = v2 - 5; // maintain gap
        }
        renderTrack();
    });

    maxSlider.addEventListener('input', () => {
        let v1 = parseInt(minSlider.value);
        let v2 = parseInt(maxSlider.value);
        if (v2 <= v1) {
            maxSlider.value = v1 + 5;
        }
        renderTrack();
    });

    function renderTrack() {
        let v1 = parseInt(minSlider.value);
        let v2 = parseInt(maxSlider.value);

        // Update label
        label.textContent = `(${v1}, ${v2})`;

        // Update highlight track
        // Assuming range 0-100
        track.style.left = v1 + "%";
        track.style.width = (v2 - v1) + "%";
    }

    renderTrack();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDualSlider('sen-min', 'sen-max', 'sen-track', 'sen-val');
    setupDualSlider('sp-min', 'sp-max', 'sp-track', 'sp-val');
    setupDualSlider('prev-min', 'prev-max', 'prev-track', 'prev-val');

    // Add click listener
    document.getElementById('run-btn').addEventListener('click', runSimulation);
});
