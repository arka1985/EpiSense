import re

file_path = "regression.html"
with open(file_path, "r", encoding="utf-8") as f:
    html = f.read()

# CSS Replacements
html = re.sub(
    r"\.tnav\{[^\}]+\}",
    r".tnav{display:flex;justify-content:center;align-items:center;gap:1rem;margin-bottom:2.5rem;background:rgba(255,255,255,0.03);padding:0.75rem;border-radius:20px;border:1px solid rgba(255,255,255,0.08);flex-wrap:wrap;text-align:center;max-width:1200px;margin:0 auto 2.5rem;}",
    html
)
html = re.sub(
    r"\.tbtn\{[^\}]+\}",
    r".tbtn{padding:0.8rem 1.5rem;border-radius:14px;cursor:pointer;font-weight:600;color:var(--t2);transition:all 0.3s cubic-bezier(0.4,0,0.2,1);user-select:none;border:1px solid transparent;background:transparent;font-family:'Inter',sans-serif;font-size:0.9rem;} .tbtn:hover{color:var(--t1);background:rgba(255,255,255,0.05);}",
    html
)
html = re.sub(
    r"\.tbtn\.act\{[^\}]+\}",
    r".tbtn.act{color:#fff;background:linear-gradient(135deg,var(--c),var(--p));box-shadow:0 4px 15px rgba(0,212,255,0.3);border-color:rgba(255,255,255,0.2);}",
    html
)
html = re.sub(
    r"\.g2\{[^\}]+\}",
    r".g2{display:grid;grid-template-columns:320px 1fr;gap:2.5rem;align-items:start;}",
    html
)
html = re.sub(
    r"\.card\{[^\}]+\}",
    r".card,.controls-panel{background:rgba(255,255,255,0.03);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:28px;padding:2rem;box-shadow:0 10px 40px rgba(0,0,0,0.3);transition:all 0.3s ease;} .card:hover{border-color:rgba(255,255,255,0.12);}",
    html
)
html = re.sub(
    r"input\[type=range\]\{[^\}]+\}",
    r"input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;background:rgba(255,255,255,0.08);border-radius:10px;outline:none;transition:background 0.3s;} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;background:linear-gradient(135deg,var(--c),#ff1744);border-radius:50%;cursor:pointer;border:3px solid rgba(255,255,255,0.9);box-shadow:0 0 15px rgba(0,212,255,0.4);transition:transform 0.2s;}",
    html
)
html = re.sub(
    r"\.btn\{[^\}]+\}",
    r".btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:0.8rem 1.5rem;border-radius:50px;cursor:pointer;font-weight:600;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);display:inline-flex;align-items:center;justify-content:center;gap:0.8rem;font-size:0.95rem;}",
    html
)
html = re.sub(
    r"\.bc\{[^\}]+\}",
    r".bc{background:linear-gradient(135deg,var(--c),var(--p));border:none;box-shadow:0 4px 15px rgba(0,212,255,0.3);}",
    html
)
html = re.sub(
    r"\.bo\{[^\}]+\}",
    r".bo{background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;}",
    html
)

html = html.replace('.card" style="margin-bottom:1rem"', '.controls-panel" style="margin-bottom:1rem;background:rgba(0,0,0,0.2);box-shadow:inset 0 0 20px rgba(0,0,0,0.1);padding:1.8rem;border-radius:20px;"')

# Added chart-wrapper equivalent styling to canvas containers
html = html.replace('.card" style="margin-bottom:1rem">\n        <div class="ch">📊', '.card" style="margin-bottom:1rem;background:rgba(0,0,0,0.3);position:relative;overflow:hidden;padding:1.5rem;">\n        <div class="ch">📊')

# Rewrite specific styling for "pb" to make it pop like the stat_viz placeholder blocks
html = html.replace('.pb{text-align:center;padding:.9rem;border-radius:12px;margin:.65rem 0}', '.pb{text-align:center;padding:1.5rem;border-radius:20px;margin:1rem 0;background:rgba(0,0,0,0.3);border:1px dashed rgba(255,255,255,0.1);}')

# Make .sh (slider headers) match labels in stat_viz
html = html.replace('.sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:.22rem}', '.sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;text-transform:uppercase;letter-spacing:0.8px;}')


with open(file_path, "w", encoding="utf-8") as f:
    f.write(html)

print("regression.html heavily patched!")
