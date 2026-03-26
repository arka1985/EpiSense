import re

file_path = "regression.html"
with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Inject HTML for the animated decision tree panel
tree_html = """
    </div>
  </div>
  
  <!-- MLU-EXPLAIN STYLE DECISION TREE -->
  <div class="dt-tree-panel">
    <div class="dt-tree-title">🔀 Decision Tree Node Flow & Patient Sorting</div>
    <div class="dt-tree">
      <div class="dt-row">
        <div class="dt-node" id="dt-node-root">
          <div class="dt-n-title">All ER Patients</div>
          <div class="dt-dots" id="dt-dots-root"></div>
          <div class="dt-n-stats" id="dt-stats-root">N=60</div>
        </div>
      </div>
      
      <div class="dt-split-label">Age &lt; <span id="dt-lbl-age">50</span> yr</div>
      
      <div class="dt-row has-children">
        <div class="dt-node" id="dt-node-l1">
          <div class="dt-n-title id-left">Younger (Age &lt; Cut)</div>
          <div class="dt-dots" id="dt-dots-l1"></div>
          <div class="dt-n-stats" id="dt-stats-l1">0%</div>
        </div>
        <div class="dt-node" id="dt-node-r1">
          <div class="dt-n-title id-right">Older (Age &ge; Cut)</div>
          <div class="dt-dots" id="dt-dots-r1"></div>
          <div class="dt-n-stats" id="dt-stats-r1">0%</div>
        </div>
      </div>

      <div class="dt-split-label">Heart Rate &lt; <span id="dt-lbl-hr">100</span> bpm</div>

      <div class="dt-row has-children wide-children">
        <div class="dt-node" id="dt-node-l2-1">
          <div class="dt-n-title id-left">HR &lt; Cut</div>
          <div class="dt-dots" id="dt-dots-l2-1"></div>
          <div class="dt-n-stats" id="dt-stats-l2-1"></div>
        </div>
        <div class="dt-node" id="dt-node-l2-2">
          <div class="dt-n-title id-right">HR &ge; Cut</div>
          <div class="dt-dots" id="dt-dots-l2-2"></div>
          <div class="dt-n-stats" id="dt-stats-l2-2"></div>
        </div>
        <div class="dt-node" id="dt-node-r2-1">
          <div class="dt-n-title id-left">HR &lt; Cut</div>
          <div class="dt-dots" id="dt-dots-r2-1"></div>
          <div class="dt-n-stats" id="dt-stats-r2-1"></div>
        </div>
        <div class="dt-node" id="dt-node-r2-2">
          <div class="dt-n-title id-right">HR &ge; Cut</div>
          <div class="dt-dots" id="dt-dots-r2-2"></div>
          <div class="dt-n-stats" id="dt-stats-r2-2"></div>
        </div>
      </div>
    </div>
  </div>
"""

html = html.replace('</div>\n  </div>\n</div>\n\n<!-- ══ 4. RANDOM FOREST (NARRATIVE) ══ -->', tree_html + '\n</div>\n\n<!-- ══ 4. RANDOM FOREST (NARRATIVE) ══ -->')

# 2. Inject CSS styling
css_code = """
.dt-tree-panel { background: rgba(0,0,0,0.2); border: 1px solid var(--bd); border-radius: 20px; padding: 2.5rem; margin-top: 2rem; }
.dt-tree-title { font-weight: 800; font-size: 1.15rem; color: var(--t1); margin-bottom: 2rem; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;}
.dt-tree { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
.dt-row { display: flex; justify-content: center; gap: 4rem; width: 100%; position: relative; }
.dt-row.has-children::before { content: ''; position: absolute; top: -1.5rem; left: calc(50% - 70px - 2rem); width: calc(140px + 4rem); height: 2px; background: var(--bd); }
.dt-row.wide-children { gap: 1rem; }
.dt-row.wide-children::before { left: calc(50% - 210px - 1.5rem); width: calc(420px + 3rem); }
.dt-split-label { background: rgba(0,212,255,0.1); border: 1px solid var(--c); color: var(--c); padding: 0.3rem 1rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; z-index: 2; position: relative; text-transform: uppercase; letter-spacing: 0.05em; }
.dt-split-label::before, .dt-split-label::after { content: ''; position: absolute; left: 50%; width: 2px; height: 0.75rem; background: var(--bd); }
.dt-split-label::before { top: -0.75rem; }
.dt-split-label::after { bottom: -0.75rem; }

.dt-node { background: rgba(255,255,255,0.03); border: 1px solid var(--bd); border-radius: 12px; width: 140px; text-align: center; position: relative; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
.dt-node:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2); }
.dt-node::before { content: ''; position: absolute; top: -1.5rem; left: 50%; width: 2px; height: 1.5rem; background: var(--bd); }
#dt-node-root::before { display: none; }
.dt-n-title { font-size: 0.75rem; font-weight: 700; color: var(--t1); padding: 0.5rem; border-bottom: 2px solid var(--bd); background: rgba(255,255,255,0.05); }
.dt-n-title.id-left { border-bottom-color: rgba(0,212,255,0.4); }
.dt-n-title.id-right { border-bottom-color: rgba(139,92,246,0.4); }
.dt-dots { display: flex; flex-wrap: wrap; gap: 4px; padding: 0.8rem; justify-content: center; min-height: 60px; align-content: flex-start; }
.dt-dot { width: 8px; height: 8px; border-radius: 50%; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
.dt-dot:hover { transform: scale(1.5); }
.dt-dot.risk-0 { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.5); }
.dt-dot.risk-1 { background: #ef4444; box-shadow: 0 0 5px rgba(239,68,68,0.5); }
.dt-n-stats { font-size: 0.72rem; color: var(--t2); padding: 0.4rem; border-top: 1px solid var(--bd); background: rgba(0,0,0,0.2); font-weight: 600; }
"""
html = html.replace('</style>', css_code + '\n</style>', 1)

# 3. Patch dtUpd function in JS
js_regex = r"function dtUpd\(\)\s*\{[\s\S]*?\}\s*\}\]\s*\}\);"

new_js = r"""function dtUpd() {
    const splitX = +document.getElementById('s-dt-x').value;
    const splitY = +document.getElementById('s-dt-y').value;
    document.getElementById('v-dt-x').textContent = splitX;
    document.getElementById('v-dt-y').textContent = splitY;
    document.getElementById('dt-lbl-age').textContent = splitX;
    document.getElementById('dt-lbl-hr').textContent = splitY;
    
    const cQ = [0,0,0,0], tQ = [0,0,0,0];
    const nodes = { root: [], l1: [], r1: [], l2_1: [], l2_2: [], r2_1: [], r2_2: [] };
    
    for(let i=0; i<60; i++) {
        let q = (dtPts[i].x<splitX?0:1) + (dtPts[i].y<splitY?2:0);
        cQ[q]++; tQ[q] += dtLbls[i];
        
        let dot = `<div class="dt-dot risk-${dtLbls[i]}"></div>`;
        nodes.root.push(dot);
        
        if (dtPts[i].x < splitX) {
            nodes.l1.push(dot);
            if (dtPts[i].y < splitY) nodes.l2_1.push(dot);
            else nodes.l2_2.push(dot);
        } else {
            nodes.r1.push(dot);
            if (dtPts[i].y < splitY) nodes.r2_1.push(dot);
            else nodes.r2_2.push(dot);
        }
    }
    
    let totalGini = 0;
    cQ.forEach((c,i)=>{
        if(c>0){ const p = tQ[i]/c; totalGini += (c/60)*(1 - p*p - (1-p)*(1-p)); }
    });
    document.getElementById('dt-cg').textContent = totalGini.toFixed(3);
    
    // Update DOM tree points
    const renderNode = (id, dotsArr) => {
        const elDots = document.getElementById(`dt-dots-${id}`);
        const elStats = document.getElementById(`dt-stats-${id}`);
        if(elDots && elStats) {
            elDots.innerHTML = dotsArr.join('');
            if(dotsArr.length === 0) { elStats.textContent = 'Empty'; return; }
            let riskCount = dotsArr.filter(d=>d.includes('risk-1')).length;
            let pureText = riskCount > dotsArr.length/2 ? `${Math.round(riskCount/dotsArr.length*100)}% High Risk` : `${Math.round((dotsArr.length-riskCount)/dotsArr.length*100)}% Low Risk`;
            elStats.textContent = `N=${dotsArr.length} · ${pureText}`;
        }
    };
    
    renderNode('root', nodes.root);
    renderNode('l1', nodes.l1);
    renderNode('r1', nodes.r1);
    renderNode('l2-1', nodes.l2_1);
    renderNode('l2-2', nodes.l2_2);
    renderNode('r2-1', nodes.r2_1);
    renderNode('r2-2', nodes.r2_2);
    
    if(dtCh) dtCh.destroy();
    dtCh = new Chart(document.getElementById('dtChart').getContext('2d'), {
        data: {
            datasets: [
                {type:'scatter', data: dtPts.filter((_,i)=>dtLbls[i]===0), backgroundColor:'#22c55e', label:'Low Risk'},
                {type:'scatter', data: dtPts.filter((_,i)=>dtLbls[i]===1), backgroundColor:'#ef4444', label:'High Risk'}
            ]
        },
        options: { responsive:true, maintainAspectRatio:false, scales: {x:{type:'linear', min:20,max:80}, y:{type:'linear', min:60,max:140}} },
        plugins: [{
            id:'dt-bg',
            beforeDraw: chart => {
                const ctx = chart.canvas.getContext('2d'), xA = chart.scales.x, yA = chart.scales.y;
                const px = xA.getPixelForValue(splitX), py = yA.getPixelForValue(splitY);
                ctx.save();
                const drawRect=(x,y,w,h,c,t)=>{ ctx.fillStyle=(c>0&&(t/c)>0.5)?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.15)'; ctx.fillRect(x,y,w,h); };
                drawRect(xA.left, yA.top, px-xA.left, py-yA.top, cQ[2], tQ[2]);
                drawRect(px, yA.top, xA.right-px, py-yA.top, cQ[3], tQ[3]);
                drawRect(xA.left, py, px-xA.left, yA.bottom-py, cQ[0], tQ[0]);
                drawRect(px, py, xA.right-px, yA.bottom-py, cQ[1], tQ[1]);
                ctx.strokeStyle='rgba(0,212,255,0.7)'; ctx.lineWidth=2;
                ctx.beginPath(); ctx.moveTo(xA.left,py); ctx.lineTo(xA.right,py); ctx.stroke();
                ctx.strokeStyle='rgba(139,92,246,0.7)';
                ctx.beginPath(); ctx.moveTo(px,yA.top); ctx.lineTo(px,yA.bottom); ctx.stroke();
                ctx.restore();
            }
        }]
    });"""

html = re.sub(js_regex, new_js, html)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Decision tree patched!")
