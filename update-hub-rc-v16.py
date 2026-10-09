from pathlib import Path
import sys

src, dest = map(Path, sys.argv[1:3])
text = src.read_text()
old = '矩形RC柱軸力、雙向彎矩、剪力、長細與耐震圍束檢核；含配筋搜尋、操作說明、驗算與離線版。'
new = 'RC柱軸彎與剪力檢核、主筋拖曳與多層配置、3D P–Mx–My工作台；依112規範含113勘誤，附52項參數說明、中文操作影片與完整離線版。'
assert text.count(old) == 1, 'Expected the current RC column seed description once'
text = text.replace(old, new)
anchor = "const VIEW_KEY='engineering-calculator-hub.view.v1';"
assert text.count(anchor) == 1
migration = "try{const marker='engineering-calculator-hub.rc-column.v16';if(!localStorage.getItem(marker)){const addon=SEED.find(t=>t.id==='rc-column');if(addon){tools=tools.map(t=>t.id===addon.id&&t.url===addon.url&&t.description===" + repr(old) + "?{...t,description:addon.description}:t);localStorage.setItem(KEY,JSON.stringify({version:1,tools}));}localStorage.setItem(marker,'1');}}catch{startupWarning='RC柱教學已更新；可由工具卡開啟新版。';}\n"
text = text.replace(anchor, migration + anchor)
dest.write_text(text)
print('Updated only the RC column seed description and a guarded description migration')
