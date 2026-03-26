import urllib.request
import re

url = 'https://translation-plugin.bhashini.co.in/v3/website_translation_utility.js'
content = urllib.request.urlopen(url).read().decode('utf-8')
svgs = re.findall(r'<svg.*?</svg>', content, re.IGNORECASE)

with open('bhashini_svgs.txt', 'w', encoding='utf-8') as f:
    for svg in set(svgs):
        f.write(svg + '\n')
