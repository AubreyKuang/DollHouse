# 把 index.html + style.css + js/*.js 合并成一个独立的单文件 HTML
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
(root / 'pixel-dollhouse.html').write_text(html, encoding='utf-8')
print('wrote pixel-dollhouse.html', len(html.encode()), 'bytes')
