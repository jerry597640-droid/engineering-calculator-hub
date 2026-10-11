"""Rebuild the distributed offline archive without dropping its existing assets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess, sys

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, '-X', 'utf8', str(root / 'build.py')], check=True)
archive = root / 'slope-offline-v1.1.zip'
temporary = archive.with_suffix('.tmp.zip')
with ZipFile(archive) as old, ZipFile(temporary, 'w', ZIP_DEFLATED) as new:
    names = set()
    for item in old.infolist():
        relative = item.filename.removeprefix('slope-stability/')
        local = root / relative
        data = local.read_bytes() if local.is_file() else old.read(item)
        new.writestr(item, data)
        names.add(item.filename)
    prefix = 'slope-stability/' if any(n.startswith('slope-stability/') for n in names) else ''
    for relative in ['tests/verify-live.cjs', 'tests/verify-regression.cjs', 'tests/verify-offline.cjs', 'tests/build-offline.py']:
        if prefix + relative not in names:
            new.write(root / relative, prefix + relative)
temporary.replace(archive)
print('Rebuilt', archive.name)
