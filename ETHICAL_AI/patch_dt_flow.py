import re

file_path = r"C:\Users\arka\EpiSense\ETHICAL_AI\regression.html"
with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# Remove the old narrative grid and tree panel
regex_to_replace = r'<div class="narrative-grid">.*?</div>\n  </div>\n</div>\n\n<!-- ══ 4\. RANDOM FOREST'

new_ui = """
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-bottom:2rem;">
      <div class="essay-panel">
        <div style="font-weight:700;font-size:.9rem;margin-bottom:1.15rem;color:var(--c)">🎛️ Manually Adjust the Triage Rules</div>
        <div class="sr"><div class="sh"><span class="sl">Age Threshold Cut (Years)</span><span class="sv" id="v-dt-x">50</span></div><input type="range" id="s-dt-x" min="20" max="80" step="1" value="50" oninput="dtUpd()"></div>
        <div class="sr"><div class="sh"><span class="sl">Heart Rate Threshold Cut (bpm)</span><span class="sv" id="v-dt-y">100</span></div><input type="range" id="s-dt-y" min="60" max="140" step="1" value="100" oninput="dtUpd()"></div>
      </div>
      <div style="background:rgba(255,255,255,.02);border-left:3px solid #fcd34d;padding:1.5rem;border-radius:12px; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--t2);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:0.05em">Gini Impurity (Split Cleanliness)</div>
        <div class="eq" style="font-size:0.9rem;margin:0;text-align:left">G = 1 - Σ(p_i)²</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:2.2rem;color:#fcd34d;margin-top:.4rem;font-weight:900" id="dt-cg">0.320</div>
        <div style="font-size:0.75rem;color:var(--t3);margin-top:0.3rem">0 = Perfectly pure diagnostic groups. Lower is better.</div>
      </div>
    </div>
    
    <div class="dt-tree-area" id="dt-tree-area">
      <div id="dt-flowing-dots"></div>
      
      <div class="dt-tree" style="position:relative; z-index:2;">
        <div class="dt-row">
          <div class="dt-node" id="node-root" style="width:200px;">
            <div class="dt-n-title">All ER Patients</div>
            <div class="dt-n-stats" id="stat-root" style="border-top:none;border-bottom:1px solid var(--bd);">N=60</div>
            <div class="dt-node-space"></div>
          </div>
        </div>
        
        <div class="dt-split-label">Age &lt; <span id="dt-lbl-age">50</span> yr</div>
        
        <div class="dt-row has-children">
          <div class="dt-node" id="node-l1">
            <div class="dt-n-title id-left">Younger (<span id="sv-dt-xl1">50</span>)</div>
            <div class="dt-n-stats" id="stat-l1">N=0</div>
            <div class="dt-node-space"></div>
          </div>
          <div class="dt-node" id="node-r1">
            <div class="dt-n-title id-right">Older (&ge;<span id="sv-dt-xr1">50</span>)</div>
            <div class="dt-n-stats" id="stat-r1">N=0</div>
            <div class="dt-node-space"></div>
          </div>
        </div>

        <div class="dt-split-label">Heart Rate &lt; <span id="dt-lbl-hr">100</span> bpm</div>

        <div class="dt-row has-children wide-children">
          <div class="dt-node" id="node-ll">
            <div class="dt-n-title id-left">HR &lt; Cut</div>
            <div class="dt-n-stats" id="stat-ll">N=0</div>
            <div class="dt-node-space" style="height:60px;"></div>
          </div>
          <div class="dt-node" id="node-lr">
            <div class="dt-n-title id-right">HR &ge; Cut</div>
            <div class="dt-n-stats" id="stat-lr">N=0</div>
            <div class="dt-node-space" style="height:60px;"></div>
          </div>
          <div class="dt-node" id="node-rl">
            <div class="dt-n-title id-left">HR &lt; Cut</div>
            <div class="dt-n-stats" id="stat-rl">N=0</div>
            <div class="dt-node-space" style="height:60px;"></div>
          </div>
          <div class="dt-node" id="node-rr">
            <div class="dt-n-title id-right">HR &ge; Cut</div>
            <div class="dt-n-stats" id="stat-rr">N=0</div>
            <div class="dt-node-space" style="height:60px;"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="insight-grid" style="margin-top:2rem;">
      <div class="insight" style="display:block"><span class="insight-icon">🪓</span><div class="insight-h">Conditional Logic</div>The tree literally builds a mathematically pure set of IF-THEN clinical rules. Data points visually sort down the branches exactly like MLU-Explain.</div>
      <div class="insight" style="display:block"><span class="insight-icon">🧩</span><div class="insight-h">Explainability</div>Unlike neural networks, every patient physically drops into a transparent, explainable bucket based on distinct clinical thresholds.</div>
    </div>
  </div>
</div>

<!-- ══ 4. RANDOM FOREST"""

html = re.sub(regex_to_replace, new_ui, html, flags=re.DOTALL)

new_css = """
.dt-tree-area { background: rgba(0,0,0,0.2); border: 1px solid var(--bd); border-radius: 20px; padding: 2.5rem; position: relative; overflow: hidden; }
.dt-tree { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
.dt-row { display: flex; justify-content: center; gap: 3rem; width: 100%; position: relative; }
.dt-row.has-children::before { content: ''; position: absolute; top: -1.5rem; left: calc(50% - 70px - 1.5rem); width: calc(140px + 3rem); height: 2px; background: rgba(255,255,255,0.2); }
.dt-row.wide-children { gap: 1rem; }
.dt-row.wide-children::before { left: calc(50% - 210px - 1.5rem); width: calc(420px + 3rem); }
.dt-split-label { background: rgba(0,212,255,0.1); border: 1px solid var(--c); color: var(--c); padding: 0.4rem 1.2rem; border-radius: 100px; font-size: 0.8rem; font-weight: 800; z-index: 2; position: relative; text-transform: uppercase; letter-spacing: 0.08em; text-align: center;}
.dt-split-label::before, .dt-split-label::after { content: ''; position: absolute; left: 50%; width: 2px; height: 1.5rem; background: rgba(255,255,255,0.2); }
.dt-split-label::before { top: -1.5rem; }
.dt-split-label::after { bottom: -1.5rem; }

.dt-node { background: rgba(255,255,255,0.02); border: 1px solid var(--bd); border-radius: 12px; width: 140px; text-align: center; position: relative; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.2); backdrop-filter: blur(8px); }
.dt-node::before { content: ''; position: absolute; top: -1.5rem; left: 50%; width: 2px; height: 1.5rem; background: rgba(255,255,255,0.2); }
#node-root::before { display: none; }
.dt-n-title { font-size: 0.75rem; font-weight: 700; color: var(--t1); padding: 0.6rem; border-bottom: 2px solid var(--bd); background: rgba(255,255,255,0.06); }
.dt-n-title.id-left { border-bottom-color: rgba(34,197,94,0.5); }
.dt-n-title.id-right { border-bottom-color: rgba(239,68,68,0.5); }

.dt-node-space { height: 95px; width: 100%; border-radius: 0 0 12px 12px; }
.dt-n-stats { font-size: 0.72rem; color: var(--t1); padding: 0.45rem; border-bottom: 1px solid var(--bd); background: rgba(0,0,0,0.4); font-weight: 700; letter-spacing: 0.05em;}

#dt-flowing-dots { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
.dt-flow-dot { width: 11px; height: 11px; border-radius: 50%; position: absolute; transition: transform 0.75s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dt-flow-dot.risk-0 { background: #22c55e; border: 2px solid #16a34a; box-shadow: 0 0 8px rgba(34,197,94,0.8); }
.dt-flow-dot.risk-1 { background: #ef4444; border: 2px solid #dc2626; box-shadow: 0 0 8px rgba(239,68,68,0.8); }
"""
html = html.replace('</style>', new_css + '\n</style>', 1)

old_js_regex = r"function dtUpd\(\)\s*\{[\s\S]*?if(?:\s*\(dtCh\))?\s*\{\s*dtCh\.destroy\(\);\s*dtCh\s*=\s*null;\s*\}(?:\s*})?\s*(?:\}\s*\}\]\s*\}\);)?"

new_js = """let dtDotsInit = false;
function dtInitDots() {
    if(dtDotsInit) return;
    dtDotsInit = true;
    const container = document.getElementById('dt-flowing-dots');
    if(!container) return;
    let dotHtml = '';
    for(let i=0; i<60; i++) {
        dotHtml += `<div class="dt-flow-dot risk-${dtLbls[i]}" id="fdot-${i}"></div>`;
    }
    container.innerHTML = dotHtml;
}

function dtUpd() {
    dtInitDots();
    const splitX = +document.getElementById('s-dt-x').value;
    const splitY = +document.getElementById('s-dt-y').value;
    document.getElementById('v-dt-x').textContent = splitX;
    document.getElementById('v-dt-y').textContent = splitY;
    document.getElementById('dt-lbl-age').textContent = splitX;
    document.getElementById('sv-dt-xl1').textContent = splitX;
    document.getElementById('sv-dt-xr1').textContent = splitX;
    document.getElementById('dt-lbl-hr').textContent = splitY;
    
    // We must wait for exactly one frame if the display just un-hid, so DOM bounds are correct.
    // Assuming dtUpd runs automatically, getBoundingClientRect requires active display.
    const treeArea = document.getElementById('dt-tree-area').getBoundingClientRect();
    if(treeArea.width === 0) return; // Tab is hidden
    
    const getNodeBox = (id) => {
        const el = document.getElementById(id);
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left - treeArea.left + 15,
            top: rect.top - treeArea.top + rect.height - 85,
            width: rect.width - 30,
            height: 70
        };
    };
    
    const boxes = {
        root: getNodeBox('node-root'),
        l1: getNodeBox('node-l1'),
        r1: getNodeBox('node-r1'),
        ll: getNodeBox('node-ll'),
        lr: getNodeBox('node-lr'),
        rl: getNodeBox('node-rl'),
        rr: getNodeBox('node-rr')
    };
    
    const cQ = [0,0,0,0], tQ = [0,0,0,0];
    const stats = { root: [60, dtLbls.filter(l=>l===1).length], l1: [0,0], r1: [0,0], ll: [0,0], lr: [0,0], rl: [0,0], rr: [0,0] };
    
    for(let i=0; i<60; i++) {
        let dot = document.getElementById(`fdot-${i}`);
        let isHighRisk = dtLbls[i] === 1;
        let tbox;
        
        let q = (dtPts[i].x<splitX?0:1) + (dtPts[i].y<splitY?2:0);
        cQ[q]++; tQ[q] += dtLbls[i];
        
        if (dtPts[i].x < splitX) {
            stats.l1[0]++; if(isHighRisk) stats.l1[1]++;
            if (dtPts[i].y < splitY) {
                stats.ll[0]++; if(isHighRisk) stats.ll[1]++;
                tbox = boxes.ll;
            } else {
                stats.lr[0]++; if(isHighRisk) stats.lr[1]++;
                tbox = boxes.lr;
            }
        } else {
            stats.r1[0]++; if(isHighRisk) stats.r1[1]++;
            if (dtPts[i].y < splitY) {
                stats.rl[0]++; if(isHighRisk) stats.rl[1]++;
                tbox = boxes.rl;
            } else {
                stats.rr[0]++; if(isHighRisk) stats.rr[1]++;
                tbox = boxes.rr;
            }
        }
        
        let seed1 = Math.abs(Math.sin(i*12.345));
        let seed2 = Math.abs(Math.cos(i*67.890));
        let px = tbox.left + seed1 * (tbox.width - 12);
        let py = tbox.top + seed2 * (tbox.height - 12);
        
        if(dot) dot.style.transform = `translate(${px}px, ${py}px)`;
    }
    
    let totalGini = 0;
    cQ.forEach((c,i)=>{
        if(c>0){ const p = tQ[i]/c; totalGini += (c/60)*(1 - p*p - (1-p)*(1-p)); }
    });
    document.getElementById('dt-cg').textContent = totalGini.toFixed(3);
    
    const updateStat = (id, total, risk) => {
        let el = document.getElementById(`stat-${id}`);
        if(!el) return;
        if(total === 0) { el.textContent = 'Empty Node'; el.style.color = 'var(--t3)'; return; }
        let pure = risk > total/2 ? Math.round(risk/total*100)+'% High Risk' : Math.round((total-risk)/total*100)+'% Low Risk';
        el.textContent = `N=${total} · ${pure}`;
        el.style.color = pure.includes('High') ? '#fca5a5' : (pure.includes('Low') ? '#86efac' : 'var(--t1)');
    };
    
    updateStat('root', stats.root[0], stats.root[1]);
    updateStat('l1', stats.l1[0], stats.l1[1]);
    updateStat('r1', stats.r1[0], stats.r1[1]);
    updateStat('ll', stats.ll[0], stats.ll[1]);
    updateStat('lr', stats.lr[0], stats.lr[1]);
    updateStat('rl', stats.rl[0], stats.rl[1]);
    updateStat('rr', stats.rr[0], stats.rr[1]);
    
    if(typeof dtCh !== 'undefined' && dtCh) { dtCh.destroy(); dtCh=null; }
}

// Add a resize listener so dots reposition correctly
window.addEventListener('resize', () => { if(document.getElementById('tab-dt').classList.contains('act')) dtUpd(); });
"""

html = re.sub(old_js_regex, new_js, html, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Complete MLU Flow Tree Installed!")
