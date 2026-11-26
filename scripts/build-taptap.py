#!/usr/bin/env python3
"""Build the TapTap H5 package: only the files the game loads, in one zip.

    python3 scripts/build-taptap.py                  # dist/taptap/dollhouse-h5-V1.0.0.zip
    python3 scripts/build-taptap.py --version 1.0.1

TapTap wants one ASCII-named folder at the zip root with index.html directly inside
it. dev.html, the offline pixel-dollhouse.html, README images, docs, tests and scripts
stay out of the package. Run build.py first so the ?v= cache keys are current.
"""
import argparse, json, re, shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = 'dollhouse'
LIMIT = 20 * 1024 * 1024


def local_refs(html):
    """Scripts and stylesheets index.html loads, without their ?v= cache keys."""
    refs = re.findall(r'<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+)"', html)
    return [r.split('?')[0] for r in refs if not re.match(r'[a-z]+:', r)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='1.0.0')
    args = ap.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        sys.exit('version must look like 1.0.0')

    out_dir = ROOT / 'dist/taptap'
    stage = out_dir / FOLDER
    shutil.rmtree(stage, ignore_errors=True)
    stage.mkdir(parents=True)

    html = (ROOT / 'index.html').read_text('utf8')
    files = ['index.html', *local_refs(html)]
    missing = [f for f in files if not (ROOT / f).is_file()]
    if missing:
        sys.exit('index.html loads missing files: ' + ', '.join(missing))
    for name in files:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    (stage / 'version.json').write_text(json.dumps({'version': args.version}) + '\n', 'utf8')

    # The game draws everything on canvas; any other local URL would be a broken file.
    stray = set()
    for name in files:
        body = (stage / name).read_text('utf8')
        for ref in re.findall(r'''(?:src|href|url\()\s*=?\s*["']?((?:\./)?(?:js|assets|img|images)/[^"')\s?]+)''', body):
            if not (stage / ref.removeprefix('./')).is_file():
                stray.add(f'{name}: {ref}')
    if stray:
        sys.exit('unresolved references:\n' + '\n'.join(sorted(stray)))

    zip_path = out_dir / f'dollhouse-h5-V{args.version}.zip'
    zip_path.unlink(missing_ok=True)
    packed = sorted(p for p in stage.rglob('*') if p.is_file())
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in packed:
            z.write(p, p.relative_to(out_dir).as_posix())

    with zipfile.ZipFile(zip_path) as z:
        tops = {n.split('/')[0] for n in z.namelist()}
        assert tops == {FOLDER} and f'{FOLDER}/index.html' in z.namelist(), tops

    unpacked = sum(p.stat().st_size for p in packed)
    kb = lambda n: f'{n / 1024:.0f}KB'
    print(f'TapTap H5 V{args.version}  ->  {zip_path.relative_to(ROOT)}')
    for p in packed:
        print(f'  {p.relative_to(stage).as_posix():<28}{kb(p.stat().st_size):>8}')
    print(f'  {len(packed)} files, unpacked {kb(unpacked)}, zip {kb(zip_path.stat().st_size)}')
    if zip_path.stat().st_size > LIMIT:
        sys.exit('package is over 20MB')


if __name__ == '__main__':
    main()
