"""Check release identity, generated HTML and optional offline archive."""
from pathlib import Path
from zipfile import ZipFile
import argparse

root = Path(__file__).resolve().parents[1]
version = "1.1.4"
checks = {
    "README.md": f"工作台 {version}",
    "template.html": f"v{version} / CI VERIFIED",
    "app.js": f"離線版_v{version}.html",
    "engine.js": f"version:'{version}'",
    "example-project.json": f'"version": "{version}"',
}
for name, marker in checks.items():
    assert marker in (root / name).read_text(), f"{name} does not contain {marker}"

index = (root / "index.html").read_text()
assert f"v{version} / CI VERIFIED" in index
assert "@STYLE" not in index and "@ENGINE" not in index and "@APP" not in index

parser = argparse.ArgumentParser()
parser.add_argument("--check-archive", action="store_true")
args = parser.parse_args()
if args.check_archive:
    with ZipFile(root / "slope-offline-v1.1.zip") as archive:
        assert archive.testzip() is None
        for name in ("index.html", "app.js", "engine.js", "template.html", "README.md", "example-project.json"):
            assert archive.read(name) == (root / name).read_bytes(), f"archive mismatch: {name}"
        assert archive.getinfo("assets/operation-tw-female.mp4").file_size > 1000
print(f"Slope Workbench {version} release identity and artifacts verified.")
