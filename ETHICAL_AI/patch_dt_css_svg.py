import sys

file_path = r"C:\Users\arka\EpiSense\ETHICAL_AI\regression.html"
with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

new_css = """
.dt-tree-area { background: rgba(0,0,0,0.2); border: 1px solid var(--bd); border-radius: 20px; padding: 2.5rem; position: relative; overflow: hidden; }
.dt-tree { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
.dt-row { display: flex; justify-content: center; gap: 3rem; width: 100%; position: relative; z-index: 2; }
.dt-row.wide-children { gap: 1rem; }

.dt-split-label { background: rgba(0,212,255,0.1); border: 1px solid var(--c); color: var(--c); padding: 0.4rem 1.2rem; border-radius: 100px; font-size: 0.8rem; font-weight: 800; z-index: 3; position: relative; text-transform: uppercase; letter-spacing: 0.08em; text-align: center; box-shadow: 0 0 10px rgba(0,212,255,0.2); }

.dt-node { background: rgba(255,255,255,0.02); border: 1px solid var(--bd); border-radius: 12px; width: 140px; text-align: center; position: relative; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(8px); }
.dt-n-title { font-size: 0.75rem; font-weight: 700; color: var(--t1); padding: 0.6rem; border-bottom: 2px solid var(--bd); background: rgba(255,255,255,0.06); }
.dt-n-title.id-left { border-bottom-color: rgba(34,197,94,0.5); }
.dt-n-title.id-right { border-bottom-color: rgba(239,68,68,0.5); }

.dt-node-space { height: 95px; width: 100%; border-radius: 0 0 12px 12px; }
.dt-n-stats { font-size: 0.72rem; color: var(--t1); padding: 0.45rem; border-bottom: 1px solid var(--bd); background: rgba(0,0,0,0.4); font-weight: 700; letter-spacing: 0.05em;}

#dt-flowing-dots { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; }
.dt-flow-dot { width: 12px; height: 12px; border-radius: 50%; position: absolute; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dt-flow-dot.risk-0 { background: #22c55e; border: 2px solid #16a34a; box-shadow: 0 0 8px rgba(34,197,94,0.8); }
.dt-flow-dot.risk-1 { background: #ef4444; border: 2px solid #dc2626; box-shadow: 0 0 8px rgba(239,68,68,0.8); }

.tree-link { stroke-dasharray: 6 4; animation: dt-flow-anim 2s linear infinite; }
@keyframes dt-flow-anim { to { stroke-dashoffset: -20; } }
"""

if ".dt-tree-area {" not in html:
    idx = html.rfind('</style>')
    if idx != -1:
        html = html[:idx] + new_css + '\n' + html[idx:]
    else:
        # If absolutely no style tag, put it directly before head
        idx = html.find('</head>')
        if idx != -1:
            html = html[:idx] + '<style>\n' + new_css + '\n</style>\n' + html[idx:]


js_target = "    let totalGini = 0;"
if js_target in html:
    new_svg_logic = """
    const getRB = (id) => {
        const el = document.getElementById(id);
        if(!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.left - treeArea.left + rect.width/2, t: rect.top - treeArea.top, b: rect.bottom - treeArea.top };
    };
    
    let svg = document.getElementById('dt-svg-links');
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "dt-svg-links";
        svg.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;";
        treeAreaEl.insertBefore(svg, treeAreaEl.firstChild);
    }
    
    let svgHtml = '';
    const connect = (id1, id2) => {
        let b1 = getRB(id1), b2 = getRB(id2);
        if(!b1 || !b2) return;
        svgHtml += `<path d="M${b1.x},${b1.b} C${b1.x},${(b1.b+b2.t)/2} ${b2.x},${(b1.b+b2.t)/2} ${b2.x},${b2.t}" stroke="rgba(255,255,255,0.18)" stroke-width="3" fill="none" class="tree-link" />`;
    };
    
    connect('node-root', 'node-l1'); connect('node-root', 'node-r1');
    connect('node-l1', 'node-ll'); connect('node-l1', 'node-lr');
    connect('node-r1', 'node-rl'); connect('node-r1', 'node-rr');
    svg.innerHTML = svgHtml;

"""
    html = html.replace(js_target, new_svg_logic + js_target)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)
print("SUCCESSFULLY INJECTED CSS AND SVG LOGIC!")
