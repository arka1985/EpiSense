
        let normalChart, zChart, morphChart, cltChart;
        let skewnessChart, kurtosisChart;

        // Custom Plugin for drawing vertical lines on charts
        const verticalLinePlugin = {
            id: 'verticalLine',
            beforeDraw: (chart, args, options) => {
                if (!options.lines || options.lines.length === 0) return;

                const { ctx, chartArea: { top, bottom, left, right, width, height }, scales: { x, y } } = chart;

                options.lines.forEach(line => {
                    if (line.xIndex < 0 || line.xIndex >= x.ticks.length || !x.ticks[line.xIndex]) return;

                    const xCoord = x.getPixelForValue(x.ticks[line.xIndex].value);
                    if (xCoord < left || xCoord > right) return;

                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = line.color || 'red';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.moveTo(xCoord, top);
                    ctx.lineTo(xCoord, bottom);
                    ctx.stroke();

                    if (line.label) {
                        ctx.fillStyle = line.color || 'red';
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(line.label, xCoord, top - 10);
                    }
                    ctx.restore();
                });
            }
        };

        Chart.register(verticalLinePlugin);



        function normalPDF(x, mean, sd) {
            return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
        }

        // Error Function Approximation (for Skew Normal)
        function erf(x) {
            var sign = (x >= 0) ? 1 : -1;
            x = Math.abs(x);
            var a1 = 0.254829592;
            var a2 = -0.284496736;
            var a3 = 1.421413741;
            var a4 = -1.453152027;
            var a5 = 1.061405429;
            var p = 0.3275911;
            var t = 1.0 / (1.0 + p * x);
            var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return sign * y;
        }

        // Standard Normal CDF
        function normalCDF(x) {
            return 0.5 * (1 + erf(x / Math.sqrt(2)));
        }

        // Skew Normal PDF: 2 * phi(x) * PHI(alpha * x)
        // where phi is standard normal pdf, PHI is standard normal cdf


        // Generalized Normal (for Kurtosis): f(x) = (beta / (2 * alpha * Gamma(1/beta))) * exp(-(|x - mu| / alpha)^beta)
        // simplifed: mu=0, alpha=1. 
        // beta=2 -> Normal. beta < 2 -> Leptokurtic (Peaked). beta > 2 -> Platykurtic (Flat)
        // Gamma function approximation needed or simple simulation? 
        // Let's use simplified Generalized Error Distribution (GED) logic or T-distribution for Kurtosis.
        // Actually, T-distribution is easier for "Heavy Tails" (Leptokurtic). 
        // But Generalized Normal is better for shape control. Let's implement Gamma approximation.

        function gamma(z) {
            const g = 7;
            const p = [
                0.99999999999980993,
                676.5203681218851,
                -1259.1392167224028,
                771.32342877765313,
                -176.61502916214059,
                12.507343278686905,
                -0.13857109526572012,
                9.9843695780195716e-6,
                1.5056327351493116e-7
            ];
            if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
            z -= 1;
            let x = p[0];
            for (let i = 1; i < 9; i++) x += p[i] / (z + i);
            let t = z + g + 0.5;
            return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
        }





        // --- Sampling & CLT Logic ---
        let populationValues = [];
        let populationDots = []; // Store {x, y, id} for visualization
        let cltMeans = [];
        let ciHistory = []; // Stores { mean, lower, upper, hit }
        let currentPopMean = 0;
        let currentPopSD = 0;
        let ciChart;

        function generatePopulation() {
            const min = parseInt(document.getElementById('pop-min').value);
            const max = parseInt(document.getElementById('pop-max').value);
            const size = parseInt(document.getElementById('pop-size').value);

            populationValues = [];
            populationDots = [];

            // Generate normal-ish distribution
            const mean = (max + min) / 2;
            const sd = (max - min) / 6;

            for (let i = 0; i < size; i++) {
                const u = 1 - Math.random();
                const v = Math.random();
                const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                let val = mean + z * sd;
                // Add some noise/bumps to make it interesting
                if (Math.random() > 0.8) val += (Math.random() - 0.5) * sd;

                val = Math.round(val);
                if (val < min) val = min;
                if (val > max) val = max;
                populationValues.push(val);

                // Jitter Y: 0 to 1
                populationDots.push({ x: val, y: Math.random() });
            }

            // Stats
            const sum = populationValues.reduce((a, b) => a + b, 0);
            currentPopMean = sum / size;
            const popVar = populationValues.reduce((a, b) => a + Math.pow(b - currentPopMean, 2), 0) / size;
            currentPopSD = Math.sqrt(popVar);

            document.getElementById('pop-mean').innerText = currentPopMean.toFixed(2);
            document.getElementById('pop-sd').innerText = currentPopSD.toFixed(2);

            // Update Glossary Examples
            document.getElementById('ex-pop-mean').innerHTML = `ΣX=${sum.toFixed(0)}, N=${size} → <b>${currentPopMean.toFixed(2)}</b>`;
            document.getElementById('ex-pop-sd').innerHTML = `Var=${popVar.toFixed(2)} → <b>${currentPopSD.toFixed(2)}</b>`;

            // Clear previous sampling history
            resetSampling(false);

            // Reset Drawing Examples
            document.getElementById('ex-sample-mean').innerText = 'Waiting for draw...';
            document.getElementById('ex-sample-sd').innerText = 'Waiting for draw...';
            document.getElementById('ex-se').innerText = 'Waiting for draw...';
            document.getElementById('ex-ci').innerText = 'Waiting for draw...';

            // Plot Population
            plotPopulation();
        }

        function plotPopulation() {
            const ctx = document.getElementById('popChart').getContext('2d');
            const min = Math.floor(Math.min(...populationValues));
            const max = Math.ceil(Math.max(...populationValues));

            // Generate Normal Curve for Overlay (Normalized to 0-1 range)
            const curveData = [];
            // Max Density for scaling
            const maxDensity = 1 / (currentPopSD * Math.sqrt(2 * Math.PI));
            const scaleFactor = 0.9 / maxDensity; // Scale peak to 0.9

            // Generate curve points
            for (let x = min; x <= max; x += (max - min) / 100) {
                const pdf = normalPDF(x, currentPopMean, currentPopSD);
                curveData.push({ x: x, y: pdf * scaleFactor });
            }

            if (popChart) popChart.destroy();
            popChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            type: 'line',
                            label: 'Distribution Curve',
                            data: curveData,
                            borderColor: '#00e5ff',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointStyle: 'dash', // Dash for curve
                            tension: 0.4,
                            fill: false,
                            order: 0,
                            yAxisID: 'y' // Use the same axis
                        },
                        {
                            type: 'scatter',
                            label: 'Population',
                            data: populationDots,
                            backgroundColor: 'rgba(96, 165, 250, 0.3)', // Translucent blue
                            borderColor: 'transparent',
                            pointRadius: 2,
                            pointStyle: 'circle',
                            order: 2,
                            yAxisID: 'y'
                        },
                        {
                            type: 'scatter',
                            label: 'Sample Highlight',
                            data: [], // Filled during sampling
                            backgroundColor: '#ff1744', // Red
                            pointRadius: 5,
                            pointStyle: 'circle',
                            order: 1,
                            yAxisID: 'y'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { usePointStyle: true, color: '#94a3b8' }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `${context.dataset.label}: ${Math.round(context.raw.x)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            min: min,
                            max: max,
                            grid: { display: false },
                            ticks: { color: '#94a3b8', precision: 0 }
                        },
                        y: {
                            display: false,
                            min: 0,
                            max: 1 // Normalize both to 0-1
                        }
                    },
                    animation: { duration: 500 }
                }
            });
        }

        function resetSampling(redraw = true) {
            cltMeans = [];
            ciHistory = [];
            document.getElementById('sample-mean').innerText = '-';
            document.getElementById('sample-sd').innerText = '-';
            document.getElementById('se-theo').innerText = '-';
            document.getElementById('se-sim').innerText = '-';
            document.getElementById('sample-values-display').value = '';
            document.getElementById('ci-bounds-display').innerHTML = '<span style="opacity: 0.5;">No samples drawn yet.</span>';

            const historyContainer = document.getElementById('sample-history-tiles');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; opacity: 0.5;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Waiting for first sample draw...
                    </div>`;
            }

            if (redraw) {
                if (cltChart) {
                    cltChart.data.labels = [];
                    cltChart.data.datasets.forEach(dst => dst.data = []);
                    cltChart.update();
                }
                if (ciChart) {
                    ciChart.destroy();
                    ciChart = null;
                    initCIChart();
                }
            }
        }

        function masterReset() {
            populationValues = [];
            populationDots = [];
            currentPopMean = 0;
            currentPopSD = 0;

            document.getElementById('pop-mean').innerText = '-';
            document.getElementById('pop-sd').innerText = '-';

            if (popChart) {
                popChart.destroy();
                popChart = null;
                const canvas = document.getElementById('popChart');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            resetSampling(true);
        }

        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

        async function drawRepeatedSamples() {
            if (populationValues.length === 0) generatePopulation();

            const button = document.querySelector('button[onclick="drawRepeatedSamples()"]');
            if (button) button.disabled = true;

            const n = parseInt(document.getElementById('sample-n-slider').value);
            const k = parseInt(document.getElementById('num-samples').value);

            if (k === 1) {
                await animateSingleSample(n);
                if (button) button.disabled = false;
                return;
            }

            // Batch Mode (Fast)
            let lastSample = [];
            let lastMean = 0;
            let lastSD = 0;
            let lastIndices = [];

            for (let i = 0; i < k; i++) {
                // Draw Sample
                const sample = [];
                const indices = [];
                for (let j = 0; j < n; j++) {
                    const idx = Math.floor(Math.random() * populationValues.length);
                    sample.push(populationValues[idx]);
                    indices.push(idx);
                }

                // Stats
                const stats = calculateSampleStats(sample, n);
                lastMean = stats.mean;
                lastSD = stats.sd;
                lastSample = sample;
                lastIndices = indices;
            }

            // Highlight Last Sample
            highlightSample(lastIndices);
            updateUI(lastSample, lastMean, lastSD, n, k);
            if (button) button.disabled = false;
        }

        async function animateSingleSample(n) {
            const sample = [];
            const indices = [];
            for (let j = 0; j < n; j++) {
                const idx = Math.floor(Math.random() * populationValues.length);
                sample.push(populationValues[idx]);
                indices.push(idx);
            }

            // 1. Highlight
            highlightSample(indices);

            // 2. Wait
            await sleep(400);

            // 3. Stats & Update
            const stats = calculateSampleStats(sample, n);
            updateUI(sample, stats.mean, stats.sd, n, 1);
        }

        function highlightSample(indices) {
            if (!popChart) return;
            const highlightData = indices.map(i => populationDots[i]);
            popChart.data.datasets[2].data = highlightData;
            popChart.update('none'); // 'none' for performance? No, we want animation maybe?
            popChart.update();
        }

        function calculateSampleStats(sample, n) {
            const sum = sample.reduce((a, b) => a + b, 0);
            const mean = sum / n;
            const variance = sample.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const sd = Math.sqrt(variance);

            cltMeans.push(mean);

            // CI Calculation for 90%, 95%, 99%
            const se = sd / Math.sqrt(n);

            // Critical values (Approx Z-distribution)
            const z90 = 1.645;
            const z95 = 1.96;
            const z99 = 2.576;

            const ci90 = { lower: mean - z90 * se, upper: mean + z90 * se };
            const ci95 = { lower: mean - z95 * se, upper: mean + z95 * se };
            const ci99 = { lower: mean - z99 * se, upper: mean + z99 * se };

            const hit95 = (currentPopMean >= ci95.lower && currentPopMean <= ci95.upper);

            ciHistory.push({
                mean,
                sd,
                ci90, ci95, ci99,
                hit: hit95,
                id: ciHistory.length + 1,
                sampleValues: [...sample] // Store raw values
            });

            return { mean, sd, ci90, ci95, ci99 };
        }

        function updateUI(lastSample, lastMean, lastSD, n, k) {
            document.getElementById('sample-mean').innerText = lastMean.toFixed(2);
            document.getElementById('sample-sd').innerText = lastSD.toFixed(2);

            const lastEntry = ciHistory[ciHistory.length - 1];
            const sampleId = lastEntry ? lastEntry.id : '-';

            // Update Text History (Optional, keeping as fallback/reference if still in DOM)
            const displayBox = document.getElementById('sample-values-display');

            // Show history of last 30 samples in premium tiles
            const historyCount = 30;
            const history = ciHistory.slice(-historyCount).reverse();

            if (displayBox && lastEntry) {
                const vals = lastEntry.sampleValues.map(v => Math.round(v)).join(', ');
                displayBox.value = `Sample S${lastEntry.id} (n=${n}, mean=${lastEntry.mean.toFixed(2)}):\n[${vals}]`;
            }

            const historyContainer = document.getElementById('sample-history-tiles');
            if (historyContainer) {
                historyContainer.innerHTML = history.map(h => {
                    const vals = h.sampleValues.map(v => Math.round(v)).join(', ');
                    const hit = h.hit ? '<span style="color: #00e676;"><i class="fas fa-check-circle"></i> Hit</span>' : '<span style="color: #ff5252;"><i class="fas fa-times-circle"></i> Miss</span>';
                    return `
                        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; border-left: 4px solid ${h.hit ? '#00e676' : '#ff5252'}; display: flex; flex-direction: column; gap: 5px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: var(--primary-blue);">Sample S${h.id}</strong>
                                <span style="font-size: 0.8rem; opacity: 0.7;">Mean: ${h.mean.toFixed(2)} | n: ${n}</span>
                                ${hit}
                            </div>
                            <div style="font-family: monospace; font-size: 0.75rem; opacity: 0.8; word-break: break-all;">
                                [${vals}]
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Display CI Bounds
            const boundsBox = document.getElementById('ci-bounds-display');
            if (boundsBox && lastEntry) {
                boundsBox.innerHTML = `
                    <div style="font-weight: bold; color: var(--primary-pink); margin-bottom: 5px;">Sample S${sampleId} Bounds:</div>
                    <div style="color: #60a5fa;">90% CI: [${lastEntry.ci90.lower.toFixed(2)}, ${lastEntry.ci90.upper.toFixed(2)}]</div>
                    <div style="color: #00e676;">95% CI: [${lastEntry.ci95.lower.toFixed(2)}, ${lastEntry.ci95.upper.toFixed(2)}]</div>
                    <div style="color: #f472b6;">99% CI: [${lastEntry.ci99.lower.toFixed(2)}, ${lastEntry.ci99.upper.toFixed(2)}]</div>
                `;
            }

            // Calculate SEs
            const theoreticalSE = currentPopSD / Math.sqrt(n);
            document.getElementById('se-theo').innerText = theoreticalSE.toFixed(2);

            if (cltMeans.length > 1) {
                const meanOfMeans = cltMeans.reduce((a, b) => a + b, 0) / cltMeans.length;
                const varOfMeans = cltMeans.reduce((a, b) => a + Math.pow(b - meanOfMeans, 2), 0) / (cltMeans.length - 1);
                const simSE = Math.sqrt(varOfMeans);
                document.getElementById('se-sim').innerText = simSE.toFixed(2);

                // Update Glossary Examples (Dynamic)
                if (lastEntry) {
                    const seVal = lastSD / Math.sqrt(n);
                    document.getElementById('ex-sample-mean').innerHTML = `Σx=${lastSample.reduce((a, b) => a + b, 0).toFixed(0)}, n=${n} → <b>${lastMean.toFixed(2)}</b>`;
                    document.getElementById('ex-sample-sd').innerHTML = `df=${n - 1} → <b>${lastSD.toFixed(2)}</b>`;
                    document.getElementById('ex-se').innerHTML = `σ=${currentPopSD.toFixed(2)}, √n=${Math.sqrt(n).toFixed(2)} → <b>${theoreticalSE.toFixed(2)}</b>`;
                    syncCITile();
                }
            }

            updateCLTChart();
            updateCIChart();
        }

        function syncCITile() {
            const is90 = document.getElementById('show-ci-90').checked;
            const is95 = document.getElementById('show-ci-95').checked;
            const is99 = document.getElementById('show-ci-99').checked;

            const titleEl = document.getElementById('ci-tile-title');
            const formulaEl = document.getElementById('ci-tile-formula');
            const exCiEl = document.getElementById('ex-ci');

            if (!titleEl || !formulaEl) return;

            let level = "95%";
            let z = 1.96;
            let color = "#00e676"; // Green for 95%

            // Priority: 99 > 95 > 90
            if (is99) { level = "99%"; z = 2.576; color = "#f472b6"; }
            else if (is95) { level = "95%"; z = 1.96; color = "#00e676"; }
            else if (is90) { level = "90%"; z = 1.645; color = "#60a5fa"; }
            else {
                titleEl.innerText = "Confidence Interval (Select Level)";
                formulaEl.innerText = "CI = x̄ ± (Z * SE)";
                return;
            }

            titleEl.innerText = `${level} Confidence Interval (CI)`;
            titleEl.style.color = color;
            formulaEl.innerText = `CI = x̄ ± (${z} * SE)`;

            // Update example if we have data
            if (ciHistory.length > 0) {
                const lastEntry = ciHistory[ciHistory.length - 1];
                const n = parseInt(document.getElementById('sample-n-slider').value);
                const se = lastEntry.sd / Math.sqrt(n);
                let lower, upper;
                if (level === "99%") { lower = lastEntry.ci99.lower; upper = lastEntry.ci99.upper; }
                else if (level === "95%") { lower = lastEntry.ci95.lower; upper = lastEntry.ci95.upper; }
                else { lower = lastEntry.ci90.lower; upper = lastEntry.ci90.upper; }

                exCiEl.innerHTML = `${lastEntry.mean.toFixed(2)} ± (${z} * ${se.toFixed(2)}) → <b>[${lower.toFixed(2)}, ${upper.toFixed(2)}]</b>`;
            }
        }

        function updateCLTChart() {
            const ctx = document.getElementById('cltChart').getContext('2d');
            const n = parseInt(document.getElementById('sample-n-slider').value);

            const min = Math.floor(Math.min(...populationValues));
            const max = Math.ceil(Math.max(...populationValues));

            // For a Dot Plot, we can use a scatter chart where Y is the stack height.
            // We'll bin the means slightly so they stack even if not identical.
            const binSize = (max - min) / 50;
            const stacks = {};
            const dotData = cltMeans.map((m, i) => {
                const bin = Math.round(m / binSize) * binSize;
                stacks[bin] = (stacks[bin] || 0) + 1;
                return { x: m, y: stacks[bin], id: i + 1 };
            });

            // Theoretical Normal Curve for Sampling Distribution
            const se = currentPopSD / Math.sqrt(n);
            const curveData = [];

            // Normalize curve to fit the dot stack heights
            const maxPointsInBin = Math.max(...Object.values(stacks), 0);
            const maxPDF = normalPDF(currentPopMean, currentPopMean, se);
            const curveScale = maxPointsInBin > 0 ? (maxPointsInBin / maxPDF) * 0.8 : 1;

            for (let x = min; x <= max; x += (max - min) / 100) {
                const y = normalPDF(x, currentPopMean, se);
                curveData.push({ x: x, y: y * curveScale });
            }

            if (cltChart) cltChart.destroy();

            cltChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            type: 'line',
                            label: 'Sampling Distribution Curve',
                            data: curveData,
                            borderColor: '#00e676',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointStyle: 'dash',
                            tension: 0.4,
                            fill: false,
                            order: 0
                        },
                        {
                            type: 'scatter',
                            label: 'Sample Means (Dots)',
                            data: dotData,
                            backgroundColor: 'rgba(232, 62, 140, 0.7)',
                            borderColor: '#e83e8c',
                            borderWidth: 1,
                            pointRadius: 6,
                            pointStyle: 'circle',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { usePointStyle: true, color: '#94a3b8' }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const d = context.raw;
                                    if (d.id) return `Sample S${d.id}: Mean ${d.x.toFixed(2)}`;
                                    return `Mean: ${d.x.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear', min: min, max: max,
                            ticks: { color: '#94a3b8' },
                            grid: { display: false }
                        },
                        y: {
                            ticks: { color: '#94a3b8', stepSize: 1, precision: 0 },
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Frequency (Stacked Samples)', color: '#94a3b8' }
                        }
                    },
                    animation: false
                }
            });
        }

        function initCIChart() {
            const ctx = document.getElementById('ciChart').getContext('2d');
            ciChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: '99% CI',
                            data: [],
                            backgroundColor: 'rgba(244, 114, 182, 0.2)', // Pink (Generalized Normal color range)
                            borderColor: 'rgba(244, 114, 182, 0.4)',
                            borderWidth: 1,
                            barThickness: 15,
                            hidden: !document.getElementById('show-ci-99').checked
                        },
                        {
                            label: '95% CI',
                            data: [],
                            backgroundColor: 'rgba(0, 230, 118, 0.4)', // Green
                            borderColor: 'rgba(0, 230, 118, 0.6)',
                            borderWidth: 1,
                            barThickness: 10,
                            hidden: !document.getElementById('show-ci-95').checked
                        },
                        {
                            label: '90% CI',
                            data: [],
                            backgroundColor: 'rgba(96, 165, 250, 0.6)', // Blue
                            borderColor: 'rgba(96, 165, 250, 0.8)',
                            borderWidth: 1,
                            barThickness: 5,
                            hidden: !document.getElementById('show-ci-90').checked
                        },
                        {
                            type: 'line',
                            label: 'True Mean',
                            data: [],
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            z: 10 // Ensure it's on top
                        },
                        {
                            type: 'scatter',
                            label: 'Sample Means',
                            data: [],
                            backgroundColor: '#fff',
                            borderColor: '#000',
                            borderWidth: 1,
                            pointRadius: 4,
                            pointStyle: 'circle',
                            z: 20
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { usePointStyle: true, color: '#94a3b8' }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const val = context.raw;
                                    if (Array.isArray(val)) return `${context.dataset.label}: [${val[0].toFixed(2)}, ${val[1].toFixed(2)}]`;
                                    return `${context.dataset.label}: ${val.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        y: {
                            ticks: { color: '#94a3b8', precision: 0 },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        function updateCIChart() {
            if (!ciChart) initCIChart();

            const showCount = 30; // History increased per user request
            const recentCI = ciHistory.slice(-showCount);

            const labels = recentCI.map(d => 'S' + d.id);

            // Check visibility
            ciChart.data.datasets[0].hidden = !document.getElementById('show-ci-99').checked;
            ciChart.data.datasets[1].hidden = !document.getElementById('show-ci-95').checked;
            ciChart.data.datasets[2].hidden = !document.getElementById('show-ci-90').checked;

            // Fill data
            ciChart.data.labels = labels;
            ciChart.data.datasets[0].data = recentCI.map(d => [d.ci99.lower, d.ci99.upper]);
            ciChart.data.datasets[1].data = recentCI.map(d => [d.ci95.lower, d.ci95.upper]);
            ciChart.data.datasets[2].data = recentCI.map(d => [d.ci90.lower, d.ci90.upper]);

            // True Mean line
            const meanLineData = recentCI.map((_, i) => currentPopMean);
            ciChart.data.datasets[3].data = meanLineData;

            // Sample Mean dots
            ciChart.data.datasets[4].data = recentCI.map((d, i) => ({ x: d.mean, y: i }));

            // Update color based on hit/miss for 95% (as primary)
            ciChart.data.datasets[1].backgroundColor = recentCI.map(d => d.hit ? 'rgba(0, 230, 118, 0.6)' : 'rgba(255, 23, 68, 0.6)');

            // Adjust X axis to current population range
            const minVal = Math.floor(Math.min(...populationValues));
            const maxVal = Math.ceil(Math.max(...populationValues));
            ciChart.options.scales.x.min = minVal;
            ciChart.options.scales.x.max = maxVal;

            ciChart.update();
            syncCITile();
        }

        function initZChart() {
            const ctx = document.getElementById('zChart').getContext('2d');
            const labels = [];
            const dataPDF = [];

            // Generate data from -4 to 4 (Standard Normal)
            for (let i = -40; i <= 40; i++) {
                const x = i / 10; // -4.0, -3.9 ...
                labels.push(x);
                dataPDF.push(normalPDF(x, 0, 1)); // Mean 0, SD 1
            }

            zChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { // Base Curve
                            label: 'Standard Normal Distribution',
                            data: dataPDF,
                            borderColor: '#60a5fa',
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            order: 1
                        },
                        { // 1 SD Area
                            label: '±1σ',
                            data: [],
                            backgroundColor: 'rgba(232, 62, 140, 0.4)', // Pinker
                            pointRadius: 0,
                            fill: true,
                            borderWidth: 0,
                            order: 2
                        },
                        { // 2 SD Area
                            label: '±2σ',
                            data: [],
                            backgroundColor: 'rgba(232, 62, 140, 0.25)',
                            pointRadius: 0,
                            fill: true,
                            borderWidth: 0,
                            order: 3
                        },
                        { // 3 SD Area
                            label: '±3σ',
                            data: [],
                            backgroundColor: 'rgba(232, 62, 140, 0.1)',
                            pointRadius: 0,
                            fill: true,
                            borderWidth: 0,
                            order: 4
                        },
                        { // Z-Score Line
                            label: 'Z-Score',
                            data: [],
                            borderColor: '#ff0000',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false,
                            order: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Z-Score (Standard Deviations)', color: '#94a3b8' },
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: {
                                color: '#94a3b8', callback: function (val, index) {
                                    // Show integer ticks from label array
                                    const v = this.getLabelForValue(val);
                                    return (v % 1 === 0) ? v : '';
                                }
                            }
                        },
                        y: { display: false }
                    },
                    plugins: { legend: { display: false } }
                }
            });
            updateZChart();
        }

        function updateZChart() {
            const zVal = parseFloat(document.getElementById('z-slider').value);
            document.getElementById('z-val').innerText = zVal;

            const show1 = document.getElementById('show-1sd').checked;
            const show2 = document.getElementById('show-2sd').checked;
            const show3 = document.getElementById('show-3sd').checked;

            const data1 = [];
            const data2 = [];
            const data3 = [];

            // Re-generate shading data
            for (let i = -40; i <= 40; i++) {
                const x = i / 10;
                const y = normalPDF(x, 0, 1);

                // 1SD: -1 to 1
                if (show1 && x >= -1 && x <= 1) data1.push(y); else data1.push(null);

                // 2SD: -2 to 2
                if (show2 && x >= -2 && x <= 2) data2.push(y); else data2.push(null);

                // 3SD: -3 to 3
                if (show3 && x >= -3 && x <= 3) data3.push(y); else data3.push(null);
            }
            const datasets = zChart.data.datasets;
            datasets[1].data = data1;
            datasets[2].data = data2;
            datasets[3].data = data3;

            // Clear Z-line dataset
            const emptyZ = new Array(81).fill(null); // -40 to 40 is 81 points
            // Find index
            const zIndex = Math.round((zVal + 4) * 10);
            if (zIndex >= 0 && zIndex <= 80) {
                emptyZ[zIndex] = normalPDF(zVal, 0, 1);
            }
            datasets[4].data = emptyZ;
            datasets[4].pointRadius = 5; // Make the Z-point visible
            datasets[4].pointHoverRadius = 7;
            datasets[4].borderWidth = 0; // It's just a point now
            datasets[4].backgroundColor = '#ff0000';

            zChart.update();
        }

        function initShapeChart() {
            const ctx = document.getElementById('shapeChart').getContext('2d');
            const labels = [];
            const normalData = [];

            for (let i = -50; i <= 50; i++) {
                const x = i / 10;
                labels.push(x.toFixed(1));
                normalData.push(normalPDF(x, 0, 1));
            }

            shapeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Standard Normal (Baseline)',
                            data: normalData,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            fill: false,
                            tension: 0.4,
                            order: 1
                        },
                        {
                            label: 'Dynamic Distribution',
                            data: [],
                            borderColor: '#a855f7', // Purple
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            borderWidth: 3,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.4,
                            order: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, labels: { color: '#cbd5e1' } }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Values', color: '#94a3b8' },
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                callback: function (val, index) {
                                    return (index % 10 === 0) ? this.getLabelForValue(val) : '';
                                }
                            }
                        },
                        y: { display: false }
                    },
                    animation: { duration: 300 }
                }
            });
            updateShapeChart();
        }

        function updateShapeChart() {
            const skewAlpha = parseFloat(document.getElementById('skew-slider').value);
            const kurtBeta = parseFloat(document.getElementById('kurt-slider').value);

            document.getElementById('skew-val').innerText = skewAlpha.toFixed(1);
            document.getElementById('kurt-val').innerText = kurtBeta.toFixed(1);

            let skewDesc = "Symmetric";
            let skewColor = "#fff";
            if (skewAlpha < -0.5) { skewDesc = "Left Skewed (Negative)"; skewColor = "#60a5fa"; }
            else if (skewAlpha > 0.5) { skewDesc = "Right Skewed (Positive)"; skewColor = "#f472b6"; }

            let kurtDesc = "Mesokurtic (Normal)";
            let kurtColor = "#fff";
            if (kurtBeta < 1.9) { kurtDesc = "Leptokurtic (Peaked, Heavy Tails)"; kurtColor = "#f472b6"; }
            else if (kurtBeta > 2.1) { kurtDesc = "Platykurtic (Flat, Light Tails)"; kurtColor = "#60a5fa"; }

            document.getElementById('skew-desc').innerText = skewDesc;
            document.getElementById('skew-desc').style.color = skewColor;

            document.getElementById('kurt-desc').innerText = kurtDesc;
            document.getElementById('kurt-desc').style.color = kurtColor;

            const dynamicData = [];

            // X Range
            for (let i = -50; i <= 50; i++) {
                const x = i / 10;

                // Combine effects for the visualizer. 
                // Skew is applied via normalCDF modifier.
                // Kurtosis is simulated using generalized normal base instead of standard normal base.
                // Formula: 2 * generalizedNormalPDF(x, beta) * normalCDF(alpha * x, 0, 1)

                // standard gen normal with alpha=1 scale handling:
                const coeff = kurtBeta / (2 * gamma(1 / kurtBeta));
                const exponent = -Math.pow(Math.abs(x), kurtBeta);
                const gPdf = coeff * Math.exp(exponent);

                // Skew modifier
                const modifier = normalCDF(skewAlpha * x);
                const combined = 2 * gPdf * modifier;

                dynamicData.push(combined);
            }

            if (shapeChart) {
                shapeChart.data.datasets[1].data = dynamicData;

                // Adjust colors based on dominant shape properties for flair
                let mainColor = '#a855f7'; // purple base
                if (Math.abs(skewAlpha) > 3) mainColor = (skewAlpha > 0) ? '#f472b6' : '#60a5fa'; // more pink/blue if heavily skewed
                else if (Math.abs(kurtBeta - 2) > 1) mainColor = (kurtBeta < 2) ? '#ff5252' : '#00e676'; // red/green if heavy kurtosis

                shapeChart.data.datasets[1].borderColor = mainColor;
                shapeChart.data.datasets[1].backgroundColor = mainColor + '33'; // 20% opacity hex

                shapeChart.update();
            }
        }

        function initMorphChart() {
            const ctx = document.getElementById('morphChart').getContext('2d');
            morphChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Distribution',
                        data: [],
                        borderColor: '#f472b6', // Pink
                        backgroundColor: 'rgba(244, 114, 182, 0.2)',
                        borderWidth: 3,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: {
                        x: { type: 'linear', min: -10, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                        y: { display: false, min: 0 }
                    },
                    animation: { duration: 0 }
                }
            });
            updateMorphChart();
        }

        function updateMorphChart() {
            const initMean = parseFloat(document.getElementById('morph-mean-slider').value);
            const initSD = parseFloat(document.getElementById('morph-sd-slider').value);
            const progress = parseFloat(document.getElementById('morph-slider').value) / 100;

            document.getElementById('morph-mean-val').innerText = initMean;
            document.getElementById('morph-sd-val').innerText = initSD;

            // Interpolate
            const currMean = initMean + (0 - initMean) * progress;
            const currSD = initSD + (1 - initSD) * progress;

            document.getElementById('curr-mean').innerText = currMean.toFixed(2);
            document.getElementById('curr-mean').style.color = (Math.abs(currMean) < 0.1) ? '#00e676' : '#fff'; // Green when close to 0

            document.getElementById('curr-sd').innerText = currSD.toFixed(2);
            document.getElementById('curr-sd').style.color = (Math.abs(currSD - 1) < 0.1) ? '#00e676' : '#fff'; // Green when close to 1

            const data = [];

            // We use scatter data format {x, y} since X axis is linear/continuous
            // Range -20 to 120
            for (let x = -20; x <= 120; x += 0.5) {
                const y = normalPDF(x, currMean, currSD);
                data.push({ x: x, y: y });
            }

            if (morphChart) {
                morphChart.data.datasets[0].data = data;
                morphChart.update();
            }
        }

        // --- Distribution Logic (Normal, T, Chi-Square, Skew, Gen) ---

        // --- Math Models for Common Distributions ---

        function logBinomialCoef(n, k) {
            let res = 0;
            for (let i = 1; i <= k; i++) res += Math.log(n - i + 1) - Math.log(i);
            return res;
        }

        function binomialPMF(k, n, p) {
            if (p === 0) return k === 0 ? 1 : 0;
            if (p === 1) return k === n ? 1 : 0;
            if (k < 0 || k > n) return 0;
            const logComb = logBinomialCoef(n, k);
            return Math.exp(logComb + k * Math.log(p) + (n - k) * Math.log(1 - p));
        }

        function poissonPMF(k, lambda) {
            if (k < 0) return 0;
            let logFact = 0;
            for (let i = 1; i <= k; i++) logFact += Math.log(i);
            return Math.exp(k * Math.log(lambda) - lambda - logFact);
        }

        function lognormalPDF(x, mu, sigma) {
            if (x <= 0) return 0;
            const exponent = -Math.pow(Math.log(x) - mu, 2) / (2 * sigma * sigma);
            return (1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
        }

        function exponentialPDF(x, lambda) {
            if (x < 0) return 0;
            return lambda * Math.exp(-lambda * x);
        }

        function initNormalChart() {
            const ctx = document.getElementById('normalChart').getContext('2d');

            normalChart = new Chart(ctx, {
                data: {
                    labels: [],
                    datasets: [{
                        type: 'line',
                        label: 'Probability / Density',
                        data: [],
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: true, labels: { color: '#cbd5e1' } },
                        tooltip: { enabled: true }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8' }
                        },
                        y: {
                            display: true,
                            min: 0,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8' },
                            title: { display: true, text: 'Probability / Density', color: '#94a3b8' }
                        }
                    }
                }
            });
            updateDistChart();
        }

        function updateDistChart() {
            const distType = document.getElementById('dist-selector').value;

            // Manage UI visibility
            document.querySelectorAll('.dist-params').forEach(el => el.style.display = 'none');
            const activeParamPanel = document.getElementById(`params-dist-${distType}`);
            if (activeParamPanel) activeParamPanel.style.display = 'block';

            let labels = [];
            let data = [];
            let chartType = 'line';
            let contextText = "";
            let color = "";
            let formulaHTML = "";

            if (distType === 'normal') {
                const mean = parseFloat(document.getElementById('norm-mean-slider').value);
                const sd = parseFloat(document.getElementById('norm-sd-slider').value);
                document.getElementById('norm-mean-val').innerText = mean;
                document.getElementById('norm-sd-val').innerText = sd;

                contextText = "Used for continuous, naturally symmetric traits like blood pressure, height, or normally distributed measurement errors.";
                color = "#00e5ff"; // Cyan
                chartType = 'line';
                formulaHTML = "f(x) = (1 / (σ√(2π))) · e<sup>-½((x-μ)/σ)²</sup>";

                for (let x = -20; x <= 20; x += 0.5) {
                    labels.push(x.toFixed(1));
                    data.push(normalPDF(x, mean, sd));
                }
            } else if (distType === 'binomial') {
                const n = parseInt(document.getElementById('binom-n-slider').value);
                const p = parseFloat(document.getElementById('binom-p-slider').value);
                document.getElementById('binom-n-val').innerText = n;
                document.getElementById('binom-p-val').innerText = p.toFixed(2);

                contextText = `Used for discrete, binary outcomes over N trials. E.g., modeling how many patients out of ${n} will experience a side effect given a ${(p * 100).toFixed(0)}% risk.`;
                color = "#f472b6"; // Pink
                chartType = 'bar';
                formulaHTML = "P(X = k) = C(n, k) · p<sup>k</sup>(1-p)<sup>n-k</sup>";

                for (let k = 0; k <= n; k++) {
                    labels.push(k);
                    data.push(binomialPMF(k, n, p));
                }
            } else if (distType === 'poisson') {
                const l = parseInt(document.getElementById('pois-l-slider').value);
                document.getElementById('pois-l-val').innerText = l;

                contextText = `Used for counting rare discrete events over time/space. E.g., modeling if an average of ${l} patients arrive per hour, what is the probability of exactly k arriving.`;
                color = "#ffeb3b"; // Yellow
                chartType = 'bar';
                formulaHTML = "P(X = k) = (λ<sup>k</sup>e<sup>-λ</sup>) / k!";

                const maxK = Math.max(l * 3, 15);
                for (let k = 0; k <= maxK; k++) {
                    labels.push(k);
                    data.push(poissonPMF(k, l));
                }
            } else if (distType === 'lognormal') {
                const mu = parseFloat(document.getElementById('log-mu-slider').value);
                const sigma = parseFloat(document.getElementById('log-sigma-slider').value);
                document.getElementById('log-mu-val').innerText = mu.toFixed(1);
                document.getElementById('log-sigma-val').innerText = sigma.toFixed(2);

                contextText = "Used for positively skewed continuous biological data that cannot be negative, such as viral incubation periods or serum biomarker concentrations.";
                color = "#a855f7"; // Purple
                chartType = 'line';
                formulaHTML = "f(x) = (1 / (xσ√(2π))) · e<sup>-(ln(x)-μ)² / 2σ²</sup>";

                for (let x = 0.1; x <= 15; x += 0.1) {
                    labels.push(x.toFixed(1));
                    data.push(lognormalPDF(x, mu, sigma));
                }
            } else if (distType === 'exponential') {
                const l = parseFloat(document.getElementById('exp-l-slider').value);
                document.getElementById('exp-l-val').innerText = l.toFixed(1);

                contextText = "Used in survival analysis to model the continuous time until a specific event occurs (e.g., time to recovery or infection) given a constant hazard rate λ.";
                color = "#00e676"; // Green
                chartType = 'line';
                formulaHTML = "f(x) = λe<sup>-λx</sup>";

                for (let x = 0; x <= 10; x += 0.1) {
                    labels.push(x.toFixed(1));
                    data.push(exponentialPDF(x, l));
                }
            } else if (distType === 't') {
                const v = parseInt(document.getElementById('t-df-slider').value);
                document.getElementById('t-df-val').innerText = v;

                contextText = "Used to model continuous data when the sample size is small and the population standard deviation is unknown.";
                color = "#fb923c"; // Orange
                chartType = 'line';
                formulaHTML = "f(t) = Γ((ν+1)/2) / [√(νπ)Γ(ν/2)] (1+t²/ν)<sup>-(ν+1)/2</sup>";

                // Function definitions inside update for simplicity if not global
                const gamma = (z) => {
                    return Math.sqrt(2 * Math.PI / z) * Math.pow((1 / Math.E) * (z + 1 / (12 * z - 1 / (10 * z))), z);
                };
                for (let x = -5; x <= 5; x += 0.1) {
                    labels.push(x.toFixed(1));
                    const num = gamma((v + 1) / 2);
                    const den = Math.sqrt(v * Math.PI) * gamma(v / 2);
                    const poly = Math.pow(1 + (x * x) / v, -(v + 1) / 2);
                    data.push((num / den) * poly);
                }
            } else if (distType === 'chi') {
                const k = parseInt(document.getElementById('chi-df-slider').value);
                document.getElementById('chi-df-val').innerText = k;

                contextText = "Used primarily in hypothesis testing, such as the Chi-square test for independence or goodness of fit.";
                color = "#facc15"; // Gold
                chartType = 'line';
                formulaHTML = "f(x) = (1/(2<sup>k/2</sup>Γ(k/2))) x<sup>k/2 - 1</sup> e<sup>-x/2</sup>";

                const gamma = (z) => {
                    return Math.sqrt(2 * Math.PI / z) * Math.pow((1 / Math.E) * (z + 1 / (12 * z - 1 / (10 * z))), z);
                };
                for (let x = 0; x <= 30; x += 0.2) {
                    labels.push(x.toFixed(1));
                    if (x === 0 && k < 2) { data.push(0); continue; }
                    if (x === 0 && k === 2) { data.push(0.5); continue; }
                    if (x === 0 && k > 2) { data.push(0); continue; }
                    const num = Math.pow(x, k / 2 - 1) * Math.exp(-x / 2);
                    const den = Math.pow(2, k / 2) * gamma(k / 2);
                    data.push(num / den);
                }
            }

            // Update UI text
            document.getElementById('dist-context-text').innerText = contextText;
            document.getElementById('dist-context-box').style.borderLeftColor = color;
            document.getElementById('formula-display').innerHTML = `<div style="color: ${color}; font-weight: bold; font-family: monospace; font-size: 1.5rem;">${formulaHTML}</div>`;

            // Update Chart
            if (normalChart) {
                normalChart.data.labels = labels;

                const dataset = normalChart.data.datasets[0];
                dataset.type = chartType;
                dataset.data = data;
                dataset.borderColor = color;
                dataset.backgroundColor = color + '44'; // Add transparency
                dataset.borderWidth = (chartType === 'line') ? 3 : 1;
                dataset.tension = (chartType === 'line') ? 0.4 : 0;

                normalChart.update();
            }
        }

        // --- NEW SHAPE ANALYSIS (SKEWNESS & KURTOSIS) LOGIC ---

        // Probability Density Function for Skew-Normal Distribution
        function skewNormalPDF(x, alpha) {
            // Standard Normal PDF
            const phi = (t) => Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI);

            // Standard Normal CDF approximation
            const Phi = (t) => {
                const z = t / Math.sqrt(2);
                const t_approx = 1 / (1 + 0.3275911 * Math.abs(z));
                const a1 = 0.254829592;
                const a2 = -0.284496736;
                const a3 = 1.421413741;
                const a4 = -1.453152027;
                const a5 = 1.061405429;
                const erf = 1 - ((((a5 * t_approx + a4) * t_approx + a3) * t_approx + a2) * t_approx + a1) * t_approx * Math.exp(-z * z);
                return 0.5 * (1 + (z >= 0 ? erf : -erf));
            };

            return 2 * phi(x) * Phi(alpha * x);
        }

        // Generalized Normal Distribution PDF (for kurtosis)
        function genNormalPDF(x, beta) {
            const alpha = Math.sqrt(Math.max(0.0001, (Date.now() % 1) + 1)); // Dummy scalar, we'll parameterize purely via beta
            // To isolate kurtosis visually without scaling issues, beta (shape) is the main driver.
            // beta = 2 is standard normal. beta > 2 is platykurtic (thin tails). beta < 2 is leptokurtic (fat tails).
            // Formula: beta / (2 * alpha * Gamma(1/beta)) * exp(-(|x|/alpha)^beta)
            // Simplified for visual scaling

            // Gamma function approximation
            const gamma = (z) => {
                return Math.sqrt(2 * Math.PI / z) * Math.pow((1 / Math.E) * (z + 1 / (12 * z - 1 / (10 * z))), z);
            };

            const g1_beta = gamma(1 / beta);
            const scale = Math.sqrt(gamma(3 / beta) / g1_beta); // To maintain variance ~1

            const coeff = beta / (2 * scale * g1_beta);
            const exponent = -Math.pow(Math.abs(x / scale), beta);

            return coeff * Math.exp(exponent);
        }

        function calculateSkewnessStats(labels, data) {
            let sumVal = 0;
            let sumProb = 0;
            let cumProb = [];

            for (let i = 0; i < labels.length; i++) {
                sumVal += labels[i] * data[i];
                sumProb += data[i];
                cumProb.push(sumProb);
            }

            const mean = sumVal / sumProb;

            let median = 0;
            const halfProb = sumProb / 2;
            for (let i = 0; i < cumProb.length; i++) {
                if (cumProb[i] >= halfProb) {
                    median = labels[i];
                    break;
                }
            }

            return { mean, median: parseFloat(median) };
        }

        function initSkewnessChart() {
            const ctx = document.getElementById('skewnessChart').getContext('2d');

            skewnessChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Density',
                        data: [],
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                        verticalLine: {
                            lines: [] // Managed by plugin
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Value', color: '#94a3b8' },
                            ticks: {
                                callback: function (val, index) {
                                    return index % 10 === 0 ? this.getLabelForValue(val) : '';
                                }
                            }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Density', color: '#94a3b8' },
                            suggestedMax: 0.6
                        }
                    }
                },
                plugins: [verticalLinePlugin]
            });

            updateTrueShapeChart(); // Populate initial data
        }

        function initKurtosisChart() {
            const ctx = document.getElementById('kurtosisChart').getContext('2d');

            // Baseline Standard Normal
            const baselineData = [];
            for (let x = -5; x <= 5; x += 0.1) {
                baselineData.push(Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI));
            }

            kurtosisChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [], // Populated in update
                    datasets: [
                        {
                            label: 'Dynamic Kurtosis',
                            data: [],
                            borderColor: '#e83e8c',
                            backgroundColor: 'rgba(232, 62, 140, 0.2)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0
                        },
                        {
                            label: 'Standard Normal Baseline',
                            data: baselineData,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            pointRadius: 0,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#cbd5e1' }
                        },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Value', color: '#94a3b8' },
                            ticks: {
                                callback: function (val, index) {
                                    return index % 10 === 0 ? this.getLabelForValue(val) : '';
                                }
                            }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Density', color: '#94a3b8' },
                            suggestedMax: 0.8
                        }
                    }
                }
            });

            updateTrueShapeChart();
        }

        function updateTrueShapeChart() {
            // --- Update Skewness Chart ---
            const skewSlider = document.getElementById('true-skew-slider');
            const skewVal = parseFloat(skewSlider.value);
            document.getElementById('true-skew-val').innerText = skewVal.toFixed(1);

            let skewDesc = "Symmetric";
            if (skewVal > 0.5) skewDesc = "Positive Skew (Right Tail)";
            if (skewVal < -0.5) skewDesc = "Negative Skew (Left Tail)";
            document.getElementById('true-skew-desc').innerText = skewDesc;

            // Create an intuitive, thematic dataset for "Wage Distribution"
            let sLabels = [];
            let sData = [];

            // Generate a basic log-normal shaped wage distribution morphed slightly by the slider
            // X-axis will represent Income in thousands 
            // 0 to 200 thousand (typical), up to 500k+ (outliers)

            // Adjust slider domain into something intuitive:
            // Slider value -5 to 5. Let's make it represent the "Extreme Wealth Outlier Range"
            // -5 = heavy left tail (everyone is rich, some are very poor)
            // 0 = symmetric normal distribution of wealth (utopia)
            // 5 = extreme right tail (Jeff Bezos walks in)

            const wageMean = 50; // $50k center
            const wageSD = 15 + Math.abs(skewVal) * 2; // spreads out when skewed

            for (let x = 0; x <= 250; x += 2) {
                sLabels.push(x.toString());

                // Construct a custom shape blending a normal curve with an extreme tail
                let baseProb = normalPDF(x, wageMean, wageSD);

                if (skewVal > 0) {
                    // Pull right tail (Jeff Bezos effect)
                    if (x > wageMean) {
                        baseProb += (skewVal * 0.005) * Math.exp(-Math.pow(x - (wageMean + skewVal * 30), 2) / (2 * Math.pow(20 * skewVal, 2)));
                    }
                } else if (skewVal < 0) {
                    // Pull left tail
                    if (x < wageMean) {
                        baseProb += (Math.abs(skewVal) * 0.005) * Math.exp(-Math.pow(x - (wageMean + skewVal * 10), 2) / (2 * 100));
                    }
                }
                sData.push(Math.max(0, baseProb)); // No negative probs
            }

            const stats = calculateSkewnessStats(sLabels, sData);

            // Convert to intuitive currency strings
            const meanWage = "₹" + (stats.mean * 1000).toLocaleString('en-IN', { maximumFractionDigits: 0 });
            const medianWage = "₹" + (stats.median * 1000).toLocaleString('en-IN', { maximumFractionDigits: 0 });

            document.getElementById('skew-stat-mean').innerText = meanWage;
            document.getElementById('skew-stat-median').innerText = medianWage;

            if (skewnessChart) {
                skewnessChart.data.labels = sLabels;
                skewnessChart.data.datasets[0].data = sData;

                // Safely find closest index mapping the label value
                const findIndexForX = (val) => {
                    let minDiff = Infinity;
                    let bestIdx = 0;
                    sLabels.forEach((l, idx) => {
                        const diff = Math.abs(parseFloat(l) - val);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestIdx = idx;
                        }
                    });
                    return bestIdx;
                };

                // Add vertical markers via dedicated annotations or chart.js standard plugin if available,
                // But since verticalLinePlugin had tick-matching flaws, we'll map absolute chart coordinates or use a second dataset.
                // To guarantee it renders perfectly, we provide it as a separate Bar dataset overlapping the line!

                let meanData = Array(sLabels.length).fill(null);
                let medianData = Array(sLabels.length).fill(null);

                const meanIdx = findIndexForX(stats.mean);
                const medianIdx = findIndexForX(stats.median);

                // Find max Y for drawing the full vertical line
                const maxY = Math.max(...sData);

                meanData[meanIdx] = maxY;
                medianData[medianIdx] = maxY;

                skewnessChart.data.datasets = [
                    {
                        label: 'Wage Frequency',
                        type: 'line',
                        data: sData,
                        borderColor: '#00e5ff',
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Mean (Average)',
                        type: 'bar',
                        data: meanData,
                        backgroundColor: '#ff1744',
                        barThickness: 3
                    },
                    {
                        label: 'Median (Middle)',
                        type: 'bar',
                        data: medianData,
                        backgroundColor: '#00e676',
                        barThickness: 3
                    }
                ];

                skewnessChart.options.plugins.verticalLine.lines = []; // Disable broken plugin
                skewnessChart.options.plugins.legend.display = true; // Show legend so they see Mean vs Median
                skewnessChart.options.scales.x.title.text = "Income (in Thousands ₹)";
                skewnessChart.options.scales.y.title.text = "Number of People";
                skewnessChart.options.scales.x.ticks = { callback: function (val, index) { return index % 20 === 0 ? "₹" + this.getLabelForValue(val) + "k" : ''; } };

                skewnessChart.update();
            }

            // --- Update Kurtosis Chart ---
            const kurtSlider = document.getElementById('true-kurt-slider');
            // Inverse the slider for intuition: higher slider = more fat-tailed (leptokurtic), which means smaller beta in genNormal
            // beta = 2 -> normal. beta < 2 -> fat tails. beta > 2 -> thin tails.
            const rawVal = parseFloat(kurtSlider.value);
            // Map rawVal [0.5, 3.5] -> beta [4.0, 1.0] (roughly) so higher slider = fatter tails
            const beta = 4.5 - rawVal;

            document.getElementById('true-kurt-val').innerText = rawVal.toFixed(1);

            let kurtDesc = "Mesokurtic (Normal Tails)";
            if (rawVal > 2.2) kurtDesc = "Leptokurtic (Fat Tails / Extreme Risk)";
            if (rawVal < 1.8) kurtDesc = "Platykurtic (Thin Tails)";
            document.getElementById('true-kurt-desc').innerText = kurtDesc;

            let kLabels = [];
            let kData = [];

            for (let x = -5; x <= 5; x += 0.1) {
                kLabels.push(x.toFixed(1));
                kData.push(genNormalPDF(x, beta));
            }

            if (kurtosisChart) {
                kurtosisChart.data.labels = kLabels;
                kurtosisChart.data.datasets[0].data = kData;

                // Update coloring logic based on fat tails
                kurtosisChart.update();
            }
        }

        function switchTab(tab) {
            // Update Tab UI
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            const tabs = document.querySelectorAll('.tab');

            // Tab indices: 0: Sampling, 1: Normal, 2: Shape, 3: Z
            if (tab === 'sampling') tabs[0].classList.add('active');
            if (tab === 'normal') tabs[1].classList.add('active');
            if (tab === 'shape') tabs[2].classList.add('active');
            if (tab === 'z') tabs[3].classList.add('active');

            // Hide all viz cards
            document.querySelectorAll('.viz-card').forEach(c => c.style.display = 'none');

            // Stop Galton Animation if defined (unless we are on normal tab)
            if (tab !== 'normal' && tab !== 'shape') {
                if (typeof isRunning !== 'undefined') isRunning = false;
            }

            // Show selected
            if (tab === 'normal') {
                document.getElementById('normal-viz').style.display = 'block';
                if (!normalChart) initNormalChart();
            } else if (tab === 'shape') {
                document.getElementById('shape-viz').style.display = 'block';
                if (!skewnessChart) initSkewnessChart();
                if (!kurtosisChart) initKurtosisChart();
            } else if (tab === 'z') {
                document.getElementById('z-viz').style.display = 'block';
                if (!zChart) initZChart();
                if (!morphChart) initMorphChart();
            } else if (tab === 'sampling') {
                document.getElementById('sampling-viz').style.display = 'block';
                if (!cltChart) {
                    plotPopulation();
                    updateCLTChart();
                }
            } else if (tab === 'clt') {
                switchTab('sampling');
            }
        }

        // sample-n-slider handled inline or via specific function if needed, but oninput covers it

        window.onload = () => {
            // First Module: Sampling & CLT
            switchTab('sampling');
        };
    