# 把 index.html + style.css + js/*.js 合并成一个独立的单文件 HTML
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
test_html = html.replace('<body>', '<body data-mode="test">').replace(
    '<title>像素小屋</title>', '<title>像素小屋 · 测试模式</title>'
).replace('<h1>像素小屋</h1>', '<h1>像素小屋 <small class="test-badge">测试模式</small></h1>')
(root / 'dev.html').write_text(test_html, encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
(root / 'pixel-dollhouse.html').write_text(html, encoding='utf-8')
print('wrote pixel-dollhouse.html', len(html.encode()), 'bytes')
