import os
import glob

files = glob.glob('*.html') + glob.glob('Sample_Size/*.html') + glob.glob('Predictive_Value/*.html')
target = '<link rel="apple-touch-icon" href="icons/icon-192.png">'
replacement = '''<link rel="apple-touch-icon" href="icons/icon-192.png">
    <link rel="icon" href="logo.svg" type="image/svg+xml">
    <link rel="icon" href="logo.png" type="image/png">'''

for f in files:
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if target in content and '<link rel="icon" href="logo.svg"' not in content:
            new_content = content.replace(target, replacement)
            open(f, 'w', encoding='utf-8').write(new_content)
            print(f"Updated {f}")
    except Exception as e:
        print(f"Error processing {f}: {e}")
