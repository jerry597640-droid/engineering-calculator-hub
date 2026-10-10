"""Reproducible v1.2 build. Never overwrite catalog numbers; synthesize real zh-TW audio.
The historical filename is retained for the existing workflow entry point.
"""
from pathlib import Path
import asyncio, base64, hashlib, json, math, re, subprocess, time, zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'steel-sections'; OUT.mkdir(exist_ok=True)
MEDIA=OUT/'media'; MEDIA.mkdir(exist_ok=True)
WORK=OUT/'.media-work'; WORK.mkdir(exist_ok=True)
HOME='https://jerry597640-droid.github.io/engineering-calculator-hub/'
VOICE='zh-TW-HsiaoChenNeural'
CHAPTERS=[
 ['工作區與返回入口','歡迎使用台灣型鋼斷面資料庫。上方的回到工程工具按鈕會另開入口，保留原本查詢。手機底部也有固定按鈕。資料查詢與自訂尺寸，是兩個不同的工作區。','home'],
 ['查詢並複製尺寸','按載入範例，查詢高三百、寬一百五十、腹板厚六點五、翼板厚九毫米的 H 型鋼。按以此尺寸建立自訂，就能用相同外尺寸修改，不會更動原廠型錄。','copy'],
 ['自由設定斷面尺寸','在自訂尺寸工作台，可選 H 型、I 型、槽鋼、角鋼、C 型、方矩管、圓管及 T 型。現在將高度改為兩百、寬度一百、腹板厚六、翼板厚九。斷面圖和截面性質會即時更新。','custom'],
 ['單位與錯誤防護','輸入單位可以切換毫米或公分，切換時會等值換算，不改變實際尺寸。方管的寬度會隨高度同步。板厚過大或尺寸留白時，會清除舊結果並停止儲存，避免誤用。','units'],
 ['儲存、命名與備份','可替斷面命名，例如屋頂支撐梁。按儲存後，會出現在我的自訂斷面。可再次編輯、查詢或刪除。備份採用 JSON，匯入時依尺寸重新計算；資料只存目前瀏覽器，不會跨裝置自動同步。','save'],
 ['參數、比較與重量','在查詢頁可加入最多四筆比較。重量估算輸入六公尺、四支，原廠型錄每公尺三十六點七公斤，總重量為八百八十點八公斤。自訂理論值不含圓角，因此不會完全等於原廠型錄值。','weight'],
 ['公式與參數說明','自訂頁可展開計算過程，查看各板件面積、重心與平行軸定理。欄位旁的問號有定義與來源，參數辭典也可搜尋。請分清楚迴轉半徑、圓角半徑，以及彈性和塑性斷面模數。','params'],
 ['規範與離線使用','規範頁分別列出熱軋尺寸標準、鋼結構及冷軋型鋼設計規範。本工具不執行構件耐力或安全簽證。下載完整離線版本即可保留查詢與本段台灣女性旁白影片；開啟線上入口仍需要網路。','codes']]
def run(args): return subprocess.run(args,check=True)
def probe(path): return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
# Pinned to the originally reviewed 98-row catalog, not an uncertain future app file.
BASE=subprocess.check_output(['git','show','1cefa04ea20551175c15aa2906ab6774e8887503:steel-sections/index.html'],cwd=ROOT).decode('utf-8')
UX=(ROOT/'.automation/steel-ui-v12.js').read_text(encoding='utf-8')
CUSTOM=(ROOT/'.automation/custom-v12.js').read_text(encoding='utf-8')
CUSTOM=CUSTOM.replace("clone.querySelectorAll('.v11-help,.v11-hint,#v12-style')", "clone.querySelector('#v11-video')?.removeAttribute('src');clone.querySelectorAll('.v11-help,.v11-hint,#v12-style')")
def assemble(media=None):
    s=re.sub(r'Version 1\.0(?:\.1)?','Version 1.2.0',BASE)
    s=s.replace('斷面重心主軸 x、y 的二次面積矩（慣性矩）','通過重心且平行外框的二次面積矩；非對稱截面不一定是主軸')
    s=s.replace('供保守的初步估算','不取代非對稱彎曲分析')
    payload='<script>window.STEEL_CHAPTERS='+json.dumps(CHAPTERS,ensure_ascii=False)+';window.STEEL_MEDIA='+json.dumps(media or {},ensure_ascii=False)+';</script>'
    payload+='<script id="v12-ux">'+UX+'</script><script id="v12-custom">'+CUSTOM+'</script>'
    i=s.rfind('</body>'); assert i>0
    path=OUT/'index.html';path.write_text(s[:i]+payload+s[i:],encoding='utf-8');return path
REPORT={'version':'1.2.0','checked':'2026-10-10','checks':[],'scope':'Chromium on GitHub Actions. No physical iOS Safari test. Geometry checks are not structural certification.'}
def check(name,ok):
    REPORT['checks'].append({'name':name,'passed':bool(ok)})
    (OUT/'verification-v12.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
    if not ok: raise AssertionError(name)
def tests(path):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page(viewport={'width':1440,'height':1000});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto(path.as_uri());check('version 1.2.0',pg.evaluate('STEEL_V12.version')=='1.2.0');check('98 catalog rows preserved',pg.evaluate('CATALOG.length')==98);check('31 theoretical examples preserved',pg.evaluate('ESTIMATES.length')==31);check('catalog consistency self tests',pg.evaluate('selfTest().length')==0)
        check('fixed home URL',pg.locator('#goHome').get_attribute('href')==HOME);check('home preserves original tab',pg.locator('#goHome').get_attribute('target')=='_blank');check('noopener', 'noopener' in pg.locator('#goHome').get_attribute('rel'))
        pg.locator('#minIx').fill('10000000');pg.locator('#example').click();check('example resets filters',pg.evaluate('state.minIx===0&&state.maxW===0'));check('catalog weight 880.8kg','880.8' in pg.locator('#totalWeight').inner_text())
        pg.locator('#length').fill('8');pg.locator('#quantity').fill('3');pg.locator('#dimUnit').select_option('cm');check('display unit keeps weight inputs',pg.locator('#length').input_value()=='8' and pg.locator('#quantity').input_value()=='3');pg.locator('#quantity').fill('1.5');check('fractional quantity rejected','正整數' in pg.locator('#totalWeight').inner_text())
        pg.locator('#customShortcut').click();check('live H area 45.33',pg.evaluate('Math.abs(STEEL_V12.getDraft().A-45.33)<1e-9'));pg.locator('#customUnit').select_option('cm');check('300mm converts to 30cm',pg.locator('#cust-H').input_value()=='30');check('unit conversion preserves geometry',pg.evaluate('Math.abs(STEEL_V12.getDraft().A-45.33)<1e-9'));pg.locator('#customUnit').select_option('mm')
        cases=[({'type':'H','H':300,'B':150,'tw':6.5,'tf':9},45.33),({'type':'I','H':200,'B':100,'tw':7,'tf':10},32.6),({'type':'U','H':200,'B':80,'tw':7.5,'tf':11},30.95),({'type':'L','H':50,'B':50,'t':5},4.75),({'type':'C','H':150,'B':60,'t':3,'lip':20},9.12),({'type':'RHS','H':200,'B':100,'t':6},34.56),({'type':'SHS','H':100,'B':100,'t':5},19),({'type':'CHS','D':100,'t':5},math.pi*4.75),({'type':'T','H':150,'B':100,'tw':6,'tf':9},17.46)]
        for inp,a in cases:
            r=pg.evaluate('(p)=>STEEL_V12.build(p)',inp);check(inp['type']+' independent area',abs(r['A']-a)<1e-8);check(inp['type']+' mass relation',abs(r['W']-a*.785)<1e-8)
        check('H Ix independent formula',pg.evaluate('Math.abs(STEEL_V12.build({type:"H",H:300,B:150,tw:6.5,tf:9}).Ix-(150*300**3-(150-6.5)*(300-18)**3)/12/10000)<1e-8'))
        check('SHS Ix independent formula',pg.evaluate('Math.abs(STEEL_V12.build({type:"SHS",H:100,B:100,t:5}).Ix-(100**4-90**4)/12/10000)<1e-8'))
        check('invalid SHS rejected',pg.evaluate('(()=>{try{STEEL_V12.build({type:"SHS",H:100,B:80,t:5});return false}catch{return true}})()'))
        pg.locator('#cust-tf').fill('200');check('excessive flange rejected',pg.locator('#saveCustom').is_disabled());check('invalid result cleared',pg.locator('[data-custom-result="A"]').count()==0);pg.locator('#cust-tf').fill('9');pg.locator('#cust-H').fill('');check('empty dimension rejected',pg.locator('#saveCustom').is_disabled());pg.locator('#cust-H').fill('300')
        pg.locator('#customType').select_option('SHS');pg.locator('#cust-H').fill('150');check('square H B synchronized',pg.locator('#cust-B').input_value()=='150' and pg.locator('#cust-B').get_attribute('readonly') is not None)
        pg.locator('#customType').select_option('H');pg.locator('#customName').fill('屋頂支撐梁 B1');pg.locator('#saveCustom').click();check('saved custom entry',pg.evaluate('customs.length')==1);pg.reload();check('custom survives reload',pg.evaluate('customs.length===1&&customs[0].label==="屋頂支撐梁 B1"'));check('restored values recalculated',pg.evaluate('Math.abs(customs[0].A-45.33)<1e-9'))
        pg.locator('#customShortcut').click();pg.locator('[data-edit-custom]').click();pg.locator('#cust-H').fill('350');pg.locator('#saveCustom').click();check('edit updates instead of duplicate',pg.evaluate('customs.length===1&&customs[0].H===350'))
        with pg.expect_download() as dl: pg.locator('#customExportJson').click()
        j=json.loads(Path(dl.value.path()).read_text());check('backup uses canonical mm',j['unit']=='mm' and j['sections'][0]['H']==350)
        bad={'schema':'steel-sections-custom-v2','unit':'mm','sections':[{'type':'SHS','H':100,'B':80,'t':5}]};pg.locator('#customFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});pg.wait_for_timeout(100);check('invalid import atomic',pg.evaluate('customs.length')==1)
        pg.evaluate("setTab('dictionary')");pg.locator('#v11-param-search').fill('腹板');check('dictionary search','腹板' in pg.locator('#v11-params').inner_text());check('28 parameter definitions',pg.evaluate('STEEL_V11.params.length')==28)
        pg.evaluate("setTab('source')");check('steel code source',pg.locator('#v11-codes a[href$="7176"]').count()==1);check('cold formed source',pg.locator('#v11-codes a[href$="968"]').count()==1)
        for width in [360,390,768,1440]:
            pg.set_viewport_size({'width':width,'height':1000});pg.evaluate("setTab('custom')");pg.wait_for_timeout(150);check('no page overflow '+str(width),pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));pg.evaluate('window.scrollTo(0,document.body.scrollHeight)');pg.wait_for_timeout(150);sel='.v11-dock [data-home]' if width<=790 else '#goHome';bb=pg.locator(sel).bounding_box();check('home visible after scroll '+str(width),bool(bb) and bb['y']>=0 and bb['y']+bb['height']<=1001);check('home touch target '+str(width),bool(bb) and bb['height']>=44)
        check('no script exceptions',not errors)
        pg.set_viewport_size({'width':1440,'height':1000});pg.evaluate("STEEL_V12.load({type:'H',H:300,B:150,tw:6.5,tf:9})");pg.screenshot(path=str(MEDIA/'custom-desktop.png'));pg.set_viewport_size({'width':390,'height':844});pg.screenshot(path=str(MEDIA/'custom-mobile.png'));b.close()
async def synth():
    import edge_tts
    for i,c in enumerate(CHAPTERS):
        path=WORK/f'{i}.mp3'
        for attempt in range(3):
            try:
                await asyncio.wait_for(edge_tts.Communicate(c[1],voice=VOICE,rate='-5%').save(str(path)),timeout=45)
                if path.stat().st_size<1000:raise RuntimeError('Empty audio')
                break
            except Exception:
                if attempt==2:raise
                await asyncio.sleep(2)
def demo(pg,mode):
    def fill(selector,value):
        pg.locator(selector).scroll_into_view_if_needed();box=pg.locator(selector).bounding_box();pg.mouse.move(box['x']+20,box['y']+20,steps=12);pg.locator(selector).fill(str(value));pg.wait_for_timeout(450)
    if mode=='home': pg.locator('#goHome').hover();pg.wait_for_timeout(1200)
    elif mode=='copy': pg.locator('#example').click();pg.wait_for_timeout(700);pg.locator('#editFromCatalog').click();pg.wait_for_timeout(800)
    elif mode=='custom':
        pg.locator('#customShortcut').click()
        for k,v in [('H',200),('B',100),('tw',6),('tf',9)]:fill('#cust-'+k,v)
        pg.locator('#customPreview').scroll_into_view_if_needed()
    elif mode=='units':
        pg.locator('#customShortcut').click();pg.locator('#customUnit').select_option('cm');pg.wait_for_timeout(1200);pg.locator('#customUnit').select_option('mm');pg.locator('#customType').select_option('SHS');fill('#cust-H',150);fill('#cust-t',90);pg.wait_for_timeout(1200);fill('#cust-t',5)
    elif mode=='save':
        pg.locator('#customShortcut').click();fill('#customName','屋頂支撐梁 B1');pg.locator('#saveCustom').click();pg.locator('#customSavedList').scroll_into_view_if_needed();pg.wait_for_timeout(700);pg.locator('#customExportJson').hover()
    elif mode=='weight':
        pg.locator('#example').click();pg.locator('#addCompare').click();fill('#length',6);fill('#quantity',4);pg.locator('#totalWeight').scroll_into_view_if_needed();pg.wait_for_timeout(700)
    elif mode=='params':
        pg.locator('#customShortcut').click();pg.locator('[data-view="custom"] details summary').click();pg.locator('#customCalculation').scroll_into_view_if_needed();pg.wait_for_timeout(1800);pg.evaluate("setTab('dictionary')");fill('#v11-param-search','迴轉')
    elif mode=='codes': pg.evaluate("setTab('source')");pg.locator('#v11-codes').scroll_into_view_if_needed()
def render_video(path):
    from playwright.sync_api import sync_playwright
    asyncio.run(synth());starts=[];total=0.;clips=[];vtt=['WEBVTT','']
    def stamp(t):
        m=round(t*1000);return f'{m//3600000:02d}:{m//60000%60:02d}:{m//1000%60:02d}.{m%1000:03d}'
    with sync_playwright() as p:
        browser=p.chromium.launch(args=['--no-sandbox'])
        for i,c in enumerate(CHAPTERS):
            aud=WORK/f'{i}.mp3';duration=float(probe(aud)['format']['duration'])+0.8
            context=browser.new_context(viewport={'width':1440,'height':960},record_video_dir=str(WORK),record_video_size={'width':1440,'height':960});pg=context.new_page();pg.goto(path.as_uri());pg.wait_for_timeout(200)
            pg.add_style_tag(content='body{padding-top:68px!important;padding-bottom:145px!important}.topbar{top:68px!important}.side{top:68px!important;height:calc(100vh - 68px)}.toast{bottom:145px}.hero,.stats{display:none!important}html{scroll-padding-top:150px;scroll-padding-bottom:140px}.custom-grid{grid-template-columns:1fr 1fr}.v11-hint{display:none!important}')
            pg.evaluate("([title,text])=>{let a=document.createElement('div');a.style='position:fixed;left:0;right:0;top:0;height:64px;background:#13263c;color:#ffe0a3;z-index:99999;padding:13px 30px;font:600 26px system-ui';a.textContent=title;document.body.appendChild(a);let b=document.createElement('div');b.style='position:fixed;left:0;right:0;bottom:0;min-height:126px;background:#13263c;color:white;z-index:99999;padding:18px 34px;font:23px/1.7 system-ui';b.textContent=text;document.body.appendChild(b)}",[f'{i+1:02d}  {c[0]}  |  STEEL 1.2',c[1]])
            start=time.monotonic();demo(pg,c[2]);pg.wait_for_timeout(max(0,round((duration-(time.monotonic()-start))*1000)));video=pg.video;context.close();raw=Path(video.path());dest=WORK/f'clip-{i}.mp4'
            run(['ffmpeg','-y','-v','error','-i',str(raw),'-i',str(aud),'-t',str(duration),'-map','0:v:0','-map','1:a:0','-vf','fps=24,format=yuv420p,fade=t=in:st=0:d=0.25','-af','apad=pad_dur=0.8','-c:v','libx264','-preset','veryfast','-crf','25','-c:a','aac','-b:a','96k','-ar','48000',str(dest)])
            starts.append(total);vtt.extend([f'{stamp(total)} --> {stamp(total+duration)}',c[1],'']);total+=duration;clips.append(dest)
        browser.close()
    ls=WORK/'list.txt';ls.write_text('\n'.join("file '"+str(x)+"'" for x in clips));mp4=MEDIA/'tutorial-zh-TW.mp4';run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(ls),'-c','copy','-movflags','+faststart',str(mp4)])
    (MEDIA/'tutorial-zh-TW.vtt').write_text('\n'.join(vtt),encoding='utf-8');(MEDIA/'transcript-zh-TW.txt').write_text('\n\n'.join(str(i+1)+' '+c[0]+'\n'+c[1] for i,c in enumerate(CHAPTERS)),encoding='utf-8')
    info=probe(mp4);check('MP4 contains audio',any(s['codec_type']=='audio' for s in info['streams']));check('MP4 contains video',any(s['codec_type']=='video' for s in info['streams']))
    REPORT['media']={'voice':VOICE,'gender':'Female','locale':'zh-TW','duration_seconds':float(info['format']['duration']),'chapters':starts,'sha256':hashlib.sha256(mp4.read_bytes()).hexdigest(),'type':'Actual Playwright screen recordings with H.264/AAC synthesized narration and burned-in captions'}
    return {'src':'data:video/mp4;base64,'+base64.b64encode(mp4.read_bytes()).decode(),'times':starts,'voice':VOICE}
def main():
    path=assemble();tests(path);media=render_video(path);path=assemble(media)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--no-sandbox']);pg=b.new_page();pg.goto(path.as_uri());pg.evaluate("setTab('tutorial')");pg.wait_for_function("document.getElementById('v11-video').readyState>=1",timeout=45000);check('embedded video decodes',pg.evaluate("document.getElementById('v11-video').duration>60"));pg.locator('[data-chapter="3"]').click();pg.wait_for_timeout(300);check('chapter seeking',pg.evaluate("document.getElementById('v11-video').currentTime")>=media['times'][3]);pg.evaluate("document.getElementById('v11-video').pause()")
        with pg.expect_download() as dl: pg.locator('#downloadOffline').click()
        copy=WORK/'offline-test.html';dl.value.save_as(str(copy));q=b.new_page();err=[];q.on('pageerror',lambda e:err.append(str(e)));q.goto(copy.as_uri());check('downloaded offline snapshot starts',q.evaluate('STEEL_V12.version')=='1.2.0' and not err);b.close()
    README='''# 台灣型鋼斷面資料庫 v1.2\n\n解壓後以瀏覽器開啟 index.html。查詢、計算及內嵌影片不需要網路。\n\n## 自訂尺寸\n點「自訂尺寸」，選型式，填入 H、B、tw、tf 或 t、D、lip。輸入可用 mm／cm，圖面固定標 mm。右側即時顯示 A、W、Ix、Iy、Sx、Sy、rx、ry。\n名稱選填；儲存後可再次編輯、查詢、加入比較。自訂資料存於目前瀏覽器，請用 JSON 備份。\n\n## 範例\n簡化 H-300×150×6.5×9：A=45.33 cm²，W=35.58405 kg/m。這與原廠型錄 A=46.78、W=36.7 不同，原因是理論模型不含圓角。\n\n## 影片\nmedia/tutorial-zh-TW.mp4 使用 Microsoft zh-TW-HsiaoChenNeural 女性合成旁白，附字幕與逐字稿。影片同時內嵌於 index.html。\n\n## 規範與限制\n核對日 2026-10-10。CNS 1490 用於熱軋尺寸與公差；鋼結構及冷軋型鋼規範另列。工具只整合公開來源、定義、幾何公式與使用範圍，未執行強度、穩定、有效斷面、接合或耐震設計。\n非對稱截面未處理主軸轉換及慣性積耦合彎曲。kg 為質量而非 kgf。\n\n## 返回入口\n上方與手機底部「回到工程工具」另開原入口，保留原分頁。入口及外部規範連結需要網路。\n\n## 測試\nverification-v12.json 記錄數值與 Chromium 測試，不代表 CNS 認證，亦未進行實機 iOS Safari 測試。\n'''
    (OUT/'README-v12.md').write_text(README,encoding='utf-8');(OUT/'verification-v12.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf-8')
    with zipfile.ZipFile(OUT/'steel-sections-v1.2-offline.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in [path,OUT/'README-v12.md',OUT/'verification-v12.json',*MEDIA.glob('*')]:z.write(f,str(f.relative_to(OUT)))
        for f in [ROOT/'.automation/custom-v12.js',ROOT/'.automation/steel-ui-v12.js',Path(__file__)]:z.write(f,'source/'+f.name)
    print(json.dumps({'passed':len(REPORT['checks']),'duration':REPORT['media']['duration_seconds'],'bytes':path.stat().st_size}))
if __name__=='__main__':main()
