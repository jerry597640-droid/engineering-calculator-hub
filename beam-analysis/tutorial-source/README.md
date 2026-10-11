# 梁受力分析操作導覽

6章節、177.504秒、1280×720，台灣中文女性合成旁白（Microsoft zh-TW-HsiaoChenNeural），繁體字幕。縮編介面動畫沿用實際欄位與由 `beam-core.js` 求得的三跨梁結果，並非實際瀏覽器螢幕錄影。旁白沒有配樂，方便辨識數字。

`narration.json` 是旁白原稿；各章節定位以實際合成語音長度決定，字幕短句在每個實測語音段中依字數比例配置。程式中的內嵌影片可離線播放，播放器支援六章節定位與MP4下載。

重製需要Node.js、Python、FFmpeg、可供HyperFrames使用的Chrome。字型採SIL OFL授權Noto Sans TC，授權文件保留於composition/FONT-LICENSE.txt。前置生成須網路；成品沒有外部影音依賴。

```bash
npm install
python3 -m pip install edge-tts==7.2.8 numpy soundfile
node example-data.cjs
python3 make-audio.py
python3 build-video.py
npx hyperframes check composition
HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1 npx hyperframes render composition --output tutorial-master.mp4 --fps 24 --workers 2 --quality standard --skill general-video
python3 package-video.py tutorial-master.mp4
python3 ../build.py
```

影片生成的assets、快取及本機Chrome不納入Git。所有必需素材由以上步驟生成；成品MP4以base64保存於 `../tutorial-media.json` 並打包為同一個離線HTML。正式成品經FFprobe格式／長度檢查，HyperFrames完整布局／執行／對比檢查，以及六章節實際影格檢視。影片檢查不代表主程式已經過真實手機瀏覽器目視驗收。
