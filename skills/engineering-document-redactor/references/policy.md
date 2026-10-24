# 遮蔽設定與座標

policy含原始待遮蔽詞，屬私有檔案。先由inspect產生source_sha256，不手動繞過來源檢查。

```json
{
  "version": 1,
  "source_sha256": "inspect產生的64位十六進位值",
  "kind": "pdf",
  "terms": [{"text":"青禾示範大樓新建工程","replacement":"[工程名稱]","category":"PROJECT"}],
  "media": [],
  "regions": [{"page":1,"box":[0.06,0.03,0.30,0.13],"color":"black","reason":"logo"}],
  "pdf_mode": "raster",
  "dpi": 180,
  "ocr": true,
  "ocr_lang": "chi_tra+eng",
  "sanitize": true,
  "accept_revisions": true,
  "case_sensitive": false,
  "review": {"text_checked":true,"visual_checked":true}
}
```

上例hash不是有效值；review只有實際檢查後設true。

## 文字

terms.text是明確字串，不接受regex。預設忽略大小寫；不要假設簡繁、全形、縮寫或OCR錯字都自動等價，必要別名應分列。Word用replacement，PDF／圖片使用純色填除，沒有可還原對照表。

## 頁面與圖片

regions.page一基；PNG／JPEG只有第1頁。box=[x0,y0,x1,y1]相對於預覽畫面，左上[0,0]、右下[1,1]；須0<=x0<x1<=1且0<=y0<y1<=1。PDF以旋轉後可見CropBox為準。

color只接受black／white，皆為不透明填除，不使用模糊或馬賽克。

## Word媒體

media.id直接取自inspect，每張圖片須有一個明確動作：

```json
[
 {"id":"word/media/image1.png","action":"blank","color":"black"},
 {"id":"word/media/image2.jpeg","action":"regions","regions":[[0.02,0.02,0.28,0.18]],"color":"white"},
 {"id":"word/media/image3.png","action":"keep","reviewed":true}
]
```

框座標相對完整內嵌圖片，不是Word頁面。共享media引用一起修改。光柵圖片重編碼並更新引用，不保留原圖；SVG／EMF／WMF等格式需先轉換或另行處理。

## 保留工程資訊

不需遮的尺寸／公式不列入terms。身份名稱若也是一般技術詞，使用完整名稱或只框指定位置，避免誤遮全文。文字清單目前不支援逐一命中排除。
