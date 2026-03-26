import sys

file_path = r"C:\Users\arka\EpiSense\ETHICAL_AI\regression.html"
with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# REPLACE HTML AREA (587-646 approximately)
start_html = html.find('<div class="dt-tree-area" id="dt-tree-area">')
if start_html != -1:
    end_html = html.find('<div class="insight-grid"', start_html)
    if end_html != -1:
        new_html = """<div class="dt-vis-wrapper" style="width:100%; border:1px solid rgba(255,255,255,0.1); border-radius:20px; overflow:hidden; position:relative; background: radial-gradient(circle at center, rgba(30,30,40,1) 0%, rgba(10,10,15,1) 100%);">
      <svg id="dt-svg-bg" viewBox="0 0 1000 700" style="width:100%; height:auto; display:block;"></svg>
      <svg id="dt-svg-dots" viewBox="0 0 1000 700" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></svg>
    </div>
    
    """
        html = html[:start_html] + new_html + html[end_html:]

# REPLACE JS AREA (from /* ══ 3. DECISION TREES ══ */ to /* LINEAR REGRESSION */)
start_js = html.find('/* ══ 3. DECISION TREES ══ */')
if start_js != -1:
    end_js = html.find('/* LINEAR REGRESSION */', start_js)
    if end_js != -1:
        new_js = """/* ══ 3. DECISION TREES (MLU EXPLICIT) ══ */
const dtPts = Array.from({length: 60}, (_, i) => ({ x: 20 + Math.random()*60, y: 60 + Math.random()*80 }));
const dtLbls = dtPts.map(p => (p.x > 55 || p.y > 110) ? 1 : 0);
for(let i=0; i<10; i++) dtLbls[Math.floor(Math.random()*60)] = Math.random()>0.5?1:0; // Noise

let dtDotsInit = false;
function dtInitDots() {
    if(dtDotsInit) return;
    dtDotsInit = true;
    let html = '';
    for(let i=0; i<60; i++) {
        let fill = dtLbls[i]===1 ? '#ef4444' : '#22c55e';
        html += `<circle id="fdot-${i}" r="5" fill="${fill}" stroke="#1e293b" stroke-width="1.5" style="transition: cx 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), cy 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);"/>`;
    }
    const svgDots = document.getElementById('dt-svg-dots');
    if(svgDots) svgDots.innerHTML = html;
}

const getHexLattice = (n) => {
    if(n===0) return [];
    let pts = [{x:0, y:0}];
    let ring = 1;
    while(pts.length < n) {
        let r = ring * 12; // Hex spacing
        for(let i=0; i<6; i++) {
            for(let j=0; j<ring; j++) {
                let a1 = (i * Math.PI) / 3, a2 = ((i+1) * Math.PI) / 3;
                let f = j / ring;
                let x = r * Math.cos(a1)*(1-f) + r * Math.cos(a2)*f;
                let y = r * Math.sin(a1)*(1-f) + r * Math.sin(a2)*f;
                pts.push({x, y});
            }
        }
        ring++;
    }
    pts.sort((a,b) => (a.x*a.x+a.y*a.y) - (b.x*b.x+b.y*b.y));
    return pts.slice(0, n);
};

function dtUpd() {
    dtInitDots();
    const splitX = +document.getElementById('s-dt-x').value;
    const splitY = +document.getElementById('s-dt-y').value;
    
    document.getElementById('v-dt-x').textContent = splitX;
    document.getElementById('v-dt-y').textContent = splitY;

    const nodes = {
        root: { cx: 500, cy: 110, r: 75, dots: [], title: "All Patients", split: `Age < ${splitX} yr` },
        l1: { cx: 250, cy: 350, r: 60, dots: [], title: `Younger (<${splitX})`, split: `HR < ${splitY} bpm` },
        r1: { cx: 750, cy: 350, r: 60, dots: [], title: `Older (≥${splitX})`, split: `HR < ${splitY} bpm` },
        ll: { cx: 125, cy: 590, r: 45, dots: [], title: `HR < ${splitY}`, split: null },
        lr: { cx: 375, cy: 590, r: 45, dots: [], title: `HR ≥ ${splitY}`, split: null },
        rl: { cx: 625, cy: 590, r: 45, dots: [], title: `HR < ${splitY}`, split: null },
        rr: { cx: 875, cy: 590, r: 45, dots: [], title: `HR ≥ ${splitY}`, split: null }
    };

    const cQ=[0,0,0,0], tQ=[0,0,0,0];
    for(let i=0; i<60; i++) {
        let isHighRisk = dtLbls[i] === 1;
        let q = (dtPts[i].x<splitX?0:1) + (dtPts[i].y<splitY?2:0);
        cQ[q]++; tQ[q] += dtLbls[i];
        
        if (dtPts[i].x < splitX) {
            if (dtPts[i].y < splitY) nodes.ll.dots.push(i);
            else nodes.lr.dots.push(i);
        } else {
            if (dtPts[i].y < splitY) nodes.rl.dots.push(i);
            else nodes.rr.dots.push(i);
        }
    }

    nodes.root.dots = [...Array(60).keys()];
    nodes.l1.dots = [...nodes.ll.dots, ...nodes.lr.dots];
    nodes.r1.dots = [...nodes.rl.dots, ...nodes.rr.dots];

    const calcGini = (arr) => {
        if(arr.length===0) return 0;
        const p = arr.filter(i => dtLbls[i]===1).length / arr.length;
        return 1 - (p*p) - ((1-p)*(1-p));
    };

    let totalGini = 0;
    cQ.forEach((c,i)=>{ if(c>0){ const p = tQ[i]/c; totalGini += (c/60)*(1 - p*p - (1-p)*(1-p)); }});
    const cgEl = document.getElementById('dt-cg');
    if(cgEl) cgEl.textContent = totalGini.toFixed(3);

    let svg = `<defs>
        <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stop-color="rgba(192,132,252,0.15)"/>
            <stop offset="100%" stop-color="rgba(192,132,252,0.03)"/>
        </radialGradient>
        <radialGradient id="leafGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stop-color="rgba(56,189,248,0.15)"/>
            <stop offset="100%" stop-color="rgba(56,189,248,0.03)"/>
        </radialGradient>
    </defs>`;
    
    const drawLink = (n1, n2) => {
        let sy = n1.cy + n1.r + 5, ey = n2.cy - n2.r - 25;
        return `<path d="M ${n1.cx} ${sy} C ${n1.cx} ${(sy+ey)/2}, ${n2.cx} ${(sy+ey)/2}, ${n2.cx} ${ey}" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none"/>`;
    };
    svg += drawLink(nodes.root, nodes.l1) + drawLink(nodes.root, nodes.r1);
    svg += drawLink(nodes.l1, nodes.ll) + drawLink(nodes.l1, nodes.lr);
    svg += drawLink(nodes.r1, nodes.rl) + drawLink(nodes.r1, nodes.rr);

    for(const key in nodes) {
        let n = nodes[key];
        let isLeaf = key.length===2;
        svg += `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="url(${isLeaf?'#leafGrad':'#nodeGrad'})" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />`;
        // Title
        svg += `<rect x="${n.cx-45}" y="${n.cy-n.r-22}" width="90" height="20" rx="10" fill="rgba(255,255,255,0.1)" />`;
        svg += `<text x="${n.cx}" y="${n.cy-n.r-8}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${n.title}</text>`;
        // Bottom Text
        if(n.split) {
            svg += `<text x="${n.cx}" y="${n.cy+n.r+20}" fill="#fcd34d" font-size="12" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">Split: ${n.split}</text>`;
            svg += `<text x="${n.cx}" y="${n.cy+n.r+38}" fill="var(--t2)" font-size="11" text-anchor="middle" font-family="system-ui, sans-serif">Gini: ${calcGini(n.dots).toFixed(3)}</text>`;
        } else {
            svg += `<text x="${n.cx}" y="${n.cy+n.r+18}" fill="var(--t2)" font-size="11" text-anchor="middle" font-family="system-ui, sans-serif">Gini: ${calcGini(n.dots).toFixed(3)}</text>`;
        }
    }
    const svgBg = document.getElementById('dt-svg-bg');
    if(svgBg) svgBg.innerHTML = svg;

    // Tween dots to Leaf nodes
    for(const key of ['ll','lr','rl','rr']) {
        let n = nodes[key];
        let arr = n.dots;
        arr.sort((a,b) => dtLbls[a] - dtLbls[b]); // Green low-risk core, red exterior
        let hex = getHexLattice(arr.length);
        arr.forEach((dotIdx, k) => {
            let el = document.getElementById(`fdot-${dotIdx}`);
            if(el) {
                // Add tiny stagger strictly per dot index size for smooth swarm
                el.style.transitionDelay = `${k * 0.005}s`;
                el.setAttribute('cx', n.cx + hex[k].x);
                el.setAttribute('cy', n.cy + hex[k].y);
            }
        });
    }
}

"""
        html = html[:start_js] + new_js + '\n' + html[end_js:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("COMPLETED HEXAGONAL MLU DOT LAYOUT PATCH")
