# 操作教學

影片：五章步驟動畫與實際工作台畫面，130.6秒。

旁白：Microsoft `zh-TW-HsiaoChenNeural`，語系zh-TW、女性；以Edge TTS生成，語速-5%。聲音清單來源：https://learn.microsoft.com/zh-tw/azure/ai-services/speech-service/language-support?tabs=tts 。音訊為預先生成並內嵌的AAC，不依賴使用者裝置的語音合成。

製作：HyperFrames 0.8.145、GSAP3.14.2；1600×900原始場景，網頁版經FFmpeg壓縮至1280×720。章節依音訊實際段長，詞界時間由TTS服務回傳並存於transcript.json，未偽造為ASR轉錄。

內容：範例與樁體 → 鑽探土層 → 結果判讀 → 參數與規範 → 保存與離線。

驗證：HyperFrames check通過，0錯誤／0警告；轉場期间文字短暫重疊為0.4秒交叉淡入。61／61文字對比檢查通過，逐章影格人工視覺檢視。FFmpeg完整解碼及音訊峰值檢查、瀏覽器MP4播放、章節跳轉與離線播放測試。此環境不支援直接聽音，未宣稱完成真人聽審。

另附narration.txt逐字稿、chapters.json章節時間與transcript.json詞界時間。
