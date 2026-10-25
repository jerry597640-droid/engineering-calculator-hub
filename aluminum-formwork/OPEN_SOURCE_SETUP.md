# GitHub 相似工具與交叉驗算設定

查核日期：2026-10-25。這次搜尋未找到可確認與本工具完全相同、涵蓋柱牆梁板鋁模板、側壓、拉片及支柱的完整專案。已找到可比較的結構分析核心：

| 專案 | 功能 | 授權 | 本次處理 |
| --- | --- | --- | --- |
| [PyNite](https://github.com/JWock82/Pynite) | 梁、構架、集中／分布載重、反力及變形 | MIT | 設為獨立交叉驗算，固定3.2.0 |
| [anaStruct](https://github.com/anastruct/anaStruct) | 二維梁構架與桁架 | LGPL-3.0 | 參考候選，未安裝或整合 |
| [PyCBA](https://github.com/ccaprani/pycba) | 連續梁直接勁度法 | AGPL-3.0 | 參考候選，未安裝或整合 |
| [CIRIA108側壓公式片段](https://gist.github.com/jsb2505/317f82dee2b5eafd1cac3ebc5eddba72) | 混凝土模板側壓與澆置速率 | 此頁未確認獨立授權 | 僅列搜尋結果，未採用程式碼或取代ACI公式 |

## 已設定

`tests/external-cases.cjs`直接讀取目前工程計算核心，輸出十組既有模板範例的各構件模型，以及四種外端支承的不等跨均布載重模型。每次驗證重新產生結果，沒有把目前計算結果固定成正確答案。

`tests/verify-external.py`使用PyNite另外建模，逐支點比對反力，逐點比對彎矩絕對值與撓度；外端轉角約束、中間連續性、均布載重及集中力位置均使用相同物理條件。相對誤差容許值為1e-6，近零值以整體需求尺度正規化。結果見`tests/external-validation.json`。

GitHub Actions的 **Aluminum formwork external verification** 會在計算核心或測試修改時自動執行，也可在Actions按Run workflow手動執行。每次結果上傳為獨立驗算紀錄。

## 本機執行

需Python 3.12與Node.js 22以上：

```bash
python -m venv .venv-external
# Windows
.venv-external\Scripts\python -m pip install -r aluminum-formwork/tests/requirements-external.txt
.venv-external\Scripts\python aluminum-formwork/tests/verify-external.py
# macOS / Linux
.venv-external/bin/python -m pip install -r aluminum-formwork/tests/requirements-external.txt
.venv-external/bin/python aluminum-formwork/tests/verify-external.py
```

此設定驗證線彈性梁分析，不驗證ACI側壓公式、材料容許應力、支柱挫屈、連接件或整體系統規範符合性。後者仍依原有專用檢核處理。網頁與單檔離線版維持原計算核心及kgf單位；Python僅在開發驗證與CI執行，使用網頁不必安裝Python。

沒有複製上游程式碼進入網頁。PyNite及其依賴依各套件所附授權使用，套件版本已固定於requirements-external.txt。
