#!/usr/bin/env python3
"""In-memory browser regression tests. Not a physical iPhone Safari test."""
from pathlib import Path
import argparse,json,hashlib
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,required=True);args=ap.parse_args();root=args.root
report={'version':'1.2.1','scope':'In-memory HTML documents; mocked storage for denied/corrupt cases; no physical iPhone test.','checks':[],'engines':['Chromium','WebKit (Linux; not physical iOS Safari)']}
def check(name,value,detail=None):
    rec={'name':name,'passed':bool(value)}
    if detail is not None:rec['detail']=detail
    report['checks'].append(rec)
    if not value:print('FAILED',name,detail)
def new(browser,js=True,storage='normal'):
    c=browser.new_context(java_script_enabled=js,viewport={'width':390,'height':844})
    if storage=='denied':c.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('storage denied','SecurityError')}})")
    else:
        seed={}
        if storage=='malformed-v1':seed={'steel-sections.custom.v1':'[null,{"id":"bad","name":4}]'}
        if storage=='malformed-v2':seed={'steel-sections.custom.v2':'[null]'}
        c.add_init_script('window.__testStorage='+json.dumps(seed)+";Object.defineProperty(window,'localStorage',{value:{getItem(k){return Object.hasOwn(__testStorage,k)?__testStorage[k]:null},setItem(k,v){__testStorage[k]=String(v)},removeItem(k){delete __testStorage[k]},clear(){__testStorage={}}}})")
    p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));return c,p,errors
online=(root/'index.html').read_text();offline=(root/'steel-sections-v1.2.1-offline.html').read_text()
with sync_playwright() as pw:
    for engine in ['chromium','webkit']:
        browser=getattr(pw,engine).launch(headless=True)
        c,p,errors=new(browser);p.set_content(online,wait_until='domcontentloaded');p.wait_for_timeout(200)
        check(engine+' startup displays 129 records',p.locator('#resultCount').inner_text()=='顯示 129 / 129 筆資料',errors)
        check(engine+' ready state',p.evaluate('window.STEEL_BOOT.ready') is True)
        check(engine+' no startup exceptions',not errors,errors)
        check(engine+' custom module 1.2.1',p.evaluate('STEEL_V12.version')=='1.2.1')
        p.select_option('#family','C');check(engine+' C returns five records',p.locator('#mobilelist button').count()==5)
        p.locator('#mobilelist button').first.click();check(engine+' C selection opens properties','C-' in p.locator('#detail').inner_text())
        p.select_option('#sourceFilter','catalog');check(engine+' no C catalog explains scope','未收錄原廠 C 型鋼型錄' in p.locator('#mobilelist').inner_text())
        p.locator('#reset').click();check(engine+' reset restores all records','129 / 129' in p.locator('#resultCount').inner_text())
        p.locator('#q').fill('H-300x150x6.5x9');check(engine+' exact dimension search returns one','顯示 1 / 129' in p.locator('#resultCount').inner_text())
        p.locator('#example').click();check(engine+' catalog A and W unchanged',p.evaluate('get(state.selected).A===46.78&&get(state.selected).W===36.7'))
        check(engine+' catalog consistency',p.evaluate('selfTest().length')==0)
        p.locator('#customShortcut').click();check(engine+' H theoretical A45.33',abs(p.evaluate('STEEL_V12.getDraft().A')-45.33)<1e-8)
        for key,value in {'H':'200','B':'100','tw':'6','tf':'9'}.items():p.locator('#cust-'+key).fill(value)
        check(engine+' edited dimensions A28.92',abs(p.evaluate('STEEL_V12.getDraft().A')-28.92)<1e-8)
        p.select_option('#customUnit','cm');check(engine+' mm cm equivalence',p.locator('#cust-H').input_value()=='20' and abs(p.evaluate('STEEL_V12.getDraft().A')-28.92)<1e-8)
        p.locator('#customName').fill('載入修復測試');p.locator('#saveCustom').click();check(engine+' custom form saves data',p.evaluate('ALL.length')==130 and len(p.evaluate("JSON.parse(localStorage.getItem('steel-sections.custom.v2'))"))==1)
        p.locator('#cust-H').fill('');check(engine+' empty dimension blocks save',p.locator('#saveCustom').is_disabled())
        p.evaluate("setTab('lookup')");p.locator('#steel-open-reader').click();check(engine+' reading mode has 129 built-ins',p.locator('#steel-reader').is_visible() and p.locator('[data-static-id]').count()==129)
        p.locator('#steel-resume').click();check(engine+' reading mode returns to app',p.locator('.app').is_visible())
        for width in [360,390,768,1440]:
            p.set_viewport_size({'width':width,'height':844});check(engine+f' interactive layout fits {width}',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if engine=='chromium':
            p.screenshot(path=str(root/'fixed-desktop.png'));p.set_viewport_size({'width':390,'height':844});p.select_option('#family','C');p.locator('#mobilelist').scroll_into_view_if_needed();p.screenshot(path=str(root/'fixed-mobile.png'))
        c.close()
        for mode in ['denied','malformed-v1','malformed-v2']:
            c,p,errors=new(browser,storage=mode);p.set_content(online,wait_until='domcontentloaded')
            check(engine+' '+mode+' still displays data',p.locator('.app').is_visible() and '129 / 129' in p.locator('#resultCount').inner_text(),errors)
            check(engine+' '+mode+' no exception',not errors,errors);c.close()
        c,p,errors=new(browser,js=False);p.set_content(online,wait_until='domcontentloaded')
        check(engine+' JavaScript disabled shows 129 data rows',p.locator('#steel-reader').is_visible() and p.locator('[data-static-id]').count()==129)
        check(engine+' JavaScript disabled hides nonworking controls',not p.locator('.app').is_visible())
        check(engine+' JavaScript disabled C shows 5 rows',p.locator('#static-C [data-static-id]').count()==5)
        check(engine+' JavaScript disabled no loading message','載入中' not in p.locator('body').inner_text())
        p.locator('#static-H summary').click();check(engine+' native details work without JavaScript',p.locator('#static-H .static-scroll').is_visible())
        for width in [360,390,768,1440]:
            p.set_viewport_size({'width':width,'height':844});check(engine+f' no-script layout fits {width}',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if engine=='chromium':
            p.set_viewport_size({'width':390,'height':844});p.screenshot(path=str(root/'fixed-noscript-mobile.png'))
        c.close()
        c,p,errors=new(browser);broken=online.replace('const OFFICIAL=','throw new Error("TEST: core failed");const OFFICIAL=',1);p.set_content(broken,wait_until='domcontentloaded')
        check(engine+' startup exception preserves readable data',p.locator('#steel-reader').is_visible() and p.locator('[data-static-id]').count()==129)
        check(engine+' startup exception shows diagnosis','啟動' in p.locator('#steel-boot-message').inner_text() and p.locator('#steel-diagnostic').is_visible());c.close()
        c,p,errors=new(browser);p.set_content(offline,wait_until='domcontentloaded');check(engine+' full offline page starts',p.evaluate('STEEL_BOOT.ready') is True,errors)
        p.evaluate('saveFile=function(text,name,mime){window.__downloaded=text};downloadOffline();');snap=p.evaluate('window.__downloaded');check(engine+' offline export contains video',bool(snap) and 'data:video/mp4;base64,' in snap)
        c2,p2,e2=new(browser);p2.set_content(snap,wait_until='domcontentloaded')
        check(engine+' exported copy starts cleanly',p2.evaluate('STEEL_BOOT.ready') is True and '129 / 129' in p2.locator('#resultCount').inner_text(),e2)
        check(engine+' exported copy has no duplicate ids',p2.evaluate("(()=>{const a=Array.from(document.querySelectorAll('[id]'),n=>n.id);return a.length===new Set(a).size})()"));c2.close()
        p.evaluate("setTab('tutorial');const v=document.getElementById('v11-video');v.muted=true;v.load();")
        try:
            p.wait_for_function("document.getElementById('v11-video').readyState>=1",timeout=15000)
            check(engine+' video decodes original duration',abs(p.evaluate("document.getElementById('v11-video').duration")-157.675)<1)
        except Exception as e:check(engine+' video decodes original duration',False,str(e)[:400])
        p.evaluate("const v=document.getElementById('v11-video');v.dispatchEvent(new Event('error'));setTab('lookup');")
        check(engine+' media error does not block queries',p.locator('.app').is_visible() and '129 / 129' in p.locator('#resultCount').inner_text());c.close();browser.close()
report['passed']=sum(x['passed'] for x in report['checks']);report['failed']=len(report['checks'])-report['passed']
report['artifacts']={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['index.html','steel-sections-v1.2.1-offline.html','reference-no-script.html','media/tutorial-zh-TW.mp4']}
(root/'verification-v121.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed'],'engines':report['engines']},ensure_ascii=False))
if report['failed']:raise SystemExit(1)
