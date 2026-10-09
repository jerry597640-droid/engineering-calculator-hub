"""Package the verified single-page calculator and its offline tutorial assets."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent
app = root / 'rc-column'
output = root / 'RC-column-offline-v1.6-PRO.zip'
required = ['rc-column-tutorial-v1.6.mp4', 'tutorial-poster.jpg', 'tutorial-zh-TW.vtt']
for name in required:
    assert (app / 'dist/assets' / name).is_file(), name

sources = ['README.md','VALIDATION.md','core.js','page.html','audit-ui.js','layers-ui.js','drag-ui.js',
           'surface-core.js','surface-ui.js','trace-core.js','report-ui.js','tutorial-ui.js','build.py',
           'verify.cjs','custom-verify.cjs','layers-verify.cjs','audit-verify.cjs','surface-verify.cjs',
           'surface-pro-verify.cjs','surface-pro-ui-test.cjs','surface-ui-test.cjs','drag-ui-test.cjs',
           'tutorial-ui-test.cjs','v16-regression-test.cjs','regulation-verify.cjs',
           'regulation-review-20261009.json','regulation-review-20261009.md','parameter-review-20261009.json',
           'tutorial-chapters.json','example-project.json','custom-example-project.json','layers-example-project.json']
sources += sorted(p.name for p in app.glob('*validation*.json'))
sources += ['validation-results.json']
sources = list(dict.fromkeys(sources))
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in sources:
        p = app / name
        assert p.is_file(), name
        archive.write(p, 'RC-column/' + name)
    for p in sorted((app / 'dist').rglob('*')):
        if p.is_file(): archive.write(p, 'RC-column/' + p.relative_to(app / 'dist').as_posix())
    for name in ['vendor/docx/docx-9.6.1.iife.js','vendor/docx/LICENSE','shared/calculation-docx.js']:
        archive.write(root / name, name)
    for src, dest in [('rc-column-tutorial/SCRIPT.md', 'RC-column/教學旁白與章節.md'),
                      ('rc-column-tutorial/audio-validation.json', 'RC-column/tutorial-audio-validation.json'),
                      ('rc-column-tutorial/video-validation.json', 'RC-column/tutorial-video-validation.json')]:
        archive.write(root / src, dest)
    archive.writestr('開始使用.txt', 'RC 柱配筋設計工作台 v1.6 PRO\n\n1. 完整解壓縮此 ZIP，保持 RC-column/assets 子資料夾。\n2. 開啟 RC-column/index.html，即可離線計算、查參數與觀看操作影片。\n3. 點「載入範例」照著影片練習，再依工程資料替換尺寸、材料、配筋及設計內力。\n4. 開啟 RC-column/manual.html，可閱讀完整參數定義、單位、來源、範例與規範對照。\n5. 影片也可直接播放 RC-column/assets/rc-column-tutorial-v1.6.mp4。\n6. 「儲存專案」保留主筋與載重；從網頁下載的單一離線HTML不含影片，影片離線須使用本完整包。\n\n規範：臺灣112年建築物混凝土結構設計規範，含113年2月19日勘誤，查核日期2026-10-09。\n已實作範圍與仍須外部完成的二階／整體耐震設計見操作說明。\n')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    count = len(archive.namelist())
print(json.dumps({'path': str(output), 'bytes': output.stat().st_size, 'files': count}, ensure_ascii=False))
