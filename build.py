# 把 index.html + style.css + js/*.js 合并成一个独立的单文件 HTML
import hashlib, pathlib, re
root = pathlib.Path(__file__).parent
index_path = root / 'index.html'
html = index_path.read_text(encoding='utf-8')
script_tag = r'<script src="(js/[^"?]+)(?:\?v=[0-9a-f]+)?"></script>'

def version_script(match):
    path = match.group(1)
    version = hashlib.sha256((root / path).read_bytes()).hexdigest()[:12]
    return f'<script src="{path}?v={version}"></script>'

html = re.sub(script_tag, version_script, html)
css = (root / 'style.css').read_text(encoding='utf-8')
css_hash = hashlib.sha256(css.encode()).hexdigest()[:12]
html = re.sub(r'href="style\.css(?:\?v=[0-9a-f]+)?"', f'href="style.css?v={css_hash}"', html)
index_path.write_text(html, encoding='utf-8')
test_html = html.replace('<body>', '<body data-mode="test">').replace(
    '<title>像素小屋</title>', '<title>像素小屋 · 测试模式</title>'
).replace('<h1>像素小屋</h1>', '<h1>像素小屋 <small class="test-badge">测试模式</small></h1>')
(root / 'dev.html').write_text(test_html, encoding='utf-8')
html = html.replace(f'<link rel="stylesheet" href="style.css?v={css_hash}">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>'
html = re.sub(script_tag, inline, html)
(root / 'pixel-dollhouse.html').write_text(html, encoding='utf-8')
print('wrote pixel-dollhouse.html', len(html.encode()), 'bytes')
