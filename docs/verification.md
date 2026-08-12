# 長時間安定性の検証手順

このドキュメントは、装置が「詰まらずに動き続けること」（README・issue #1 の要望の中核）を
毎回同じ手順で再現検証できるように、検証の考え方と判定基準をまとめたものです。

## 目的

- ボールが途中で停止せず、画面内に常に最低 1 個以上のボールが動いている状態を維持できているかを確認する
- 全ての仕掛け (坂・シーソー・発射装置・エレベーター・分岐・振り子・ドミノ・ホイール・バウンド床) が実際に作動しているかを確認する
- fps が大きく落ち込まず、視覚的にも「眺めて楽しい」速度で動き続けているかを確認する
- コンソールエラーが出ていないかを確認する (静止画のスクリーンショットだけでは、例外が起きて描画が固まっていることに気づけないため)

## 検証の考え方

装置はブラウザ上で `requestAnimationFrame` により自走し続けるページです。人手でブラウザを
開いて何分も眺め続けるのは再現性・記録性に欠けるため、以下の方式で自動的に記録します。

1. **Chrome DevTools Protocol (CDP) で headless Chrome を操作する。**
   `--remote-debugging-port=<PORT>` で起動済みの Chrome に対し、
   `PUT /json/new?<url>` で検証対象ページを開いた新しいタブを作らせる。
2. **一定間隔ごとに `window.__pitagora` を取得する。**
   `src/types.d.ts` の `PitagoraStats` を、simulation が毎フレーム更新して
   `window.__pitagora` に書き出している (`src/machine/simulation.ts` の `updateStats`)。
   CDP の `Runtime.evaluate` で `JSON.stringify(window.__pitagora)` を評価し、
   数値データとして回収する。
3. **同時にスクリーンショットも保存する。**
   `Page.captureScreenshot` で PNG を取得し保存する。数値だけでは「詰まって
   同じ位置で止まっているボール」のような視覚的な異常を見落とすことがあるため、
   数値記録と画像記録の両方を毎回セットで残す。
4. **コンソール例外・コンソールエラーの両方を監視する。**
   `Runtime.exceptionThrown` イベントを購読し、検証中に発生した未処理の JS 例外を
   全て記録する。例外が起きて `requestAnimationFrame` ループが停止していても、
   直前のフレームの静止画は正常に見えることがあるため、画像だけに頼らない。
   ただし `Runtime.exceptionThrown` は「未処理の例外」しか通知しないため、
   検証対象が例外を投げずに `console.error(...)` で異常を報告するケースは
   これだけでは検知できない。`console.error(...)` 自体は
   `Runtime.consoleAPICalled` (`type: "error"`) として通知されるため、
   あわせて購読し、両方をまとめて `consoleErrorCount` として集計する。

この考え方を実装したものが `scripts/verify-stability.mjs` です。

## 実行方法

前提: 検証対象の Vite dev server と、`--remote-debugging-port` を指定した headless Chrome が
既に起動していること (このスクリプト自身はサーバー・ブラウザの起動/停止を行わない)。

```bash
# 例: dev server が :5173、headless Chrome の CDP ポートが 9333 の場合
CDP_PORT=9333 node scripts/verify-stability.mjs \
  http://localhost:5173/ \
  ./verification-out \
  60000 \
  6 \
  stability
```

引数は `<url> <出力ディレクトリ> <サンプル間隔ms> <サンプル回数> [ラベル]`。
上記の例は「60 秒間隔で 6 回 = 6 分間」の検証になる (issue #1 / #6 の要件である
「5 分以上の連続稼働」を確実に超えるため、5 分ちょうどではなく 6 分で計測する)。

実行すると、`readings` (各サンプル時点の `window.__pitagora` の値) と `summary`
(平均/最低 fps・最終統計・仕掛けごとの発火有無を集計したもの) を含む JSON が
標準出力に出る。スクリーンショットは `<出力ディレクトリ>/<ラベル>-<経過ms>ms.png`
として保存される。

## 判定基準

以下を **すべて満たせば合格** とする。`summary` の対応フィールドと突き合わせて判定する。

| # | 項目 | 基準 | summary のフィールド |
|---|------|------|----------------------|
| 1 | 連続稼働時間 | 300,000ms (5 分) 以上、`elapsedMs` が単調に増加し続け、いずれのサンプルでも取得できる (ページがフリーズ/クラッシュしていない) | `finalElapsedMs` |
| 2 | 最小アクティブボール数 | 全サンプルを通じて 1 以上 (0 になった時点は「画面上にボールが 1 個もない」= 装置が完全停止したことを意味する) | `finalMinActiveBalls` |
| 3 | 平均 fps | 55 以上 (60fps 目標に対し、多少の変動は許容する) | `averageFps` |
| 4 | 最低 fps | 30 以上 (体感でカクつきが気になり始める一般的な下限) | `minFps` |
| 5 | 仕掛けごとの作動回数 | `gimmicks` の全フィールドが検証終了時点で 1 以上 (未到達の仕掛けが無いこと) | `gimmicksAllFiredAtLeastOnce` が `true` |
| 6 | コンソールエラー | 0 件 (`console.error(...)` による報告と、未処理の JS 例外の合計) | `consoleErrorCount` |

`recoveredBalls` (スタック検知による回収) と `outOfBoundsBalls` (画面外脱落からの回収) は、
0 より大きくても不合格にはしない。これらは詰まり対策のフェイルセーフが正常に機能した
結果であり、想定内の動作。ただし際限なく増え続ける (例: 1 分あたり数十回発生する) 場合は、
どこかの仕掛けが詰まりやすくなっている兆候なので、`readings` の時系列を見て増加ペースが
一定以上に加速していないかも合わせて確認する。

## 実測結果 (2026-08-12 実施)

`node scripts/verify-stability.mjs http://localhost:5184/ <出力先> 60000 6 longrun6min`
で 6 分間 (60 秒間隔 x 6 回) 計測した結果。

| 経過時間 | activeBalls | minActiveBalls | fps | recoveredBalls | outOfBoundsBalls |
|---|---|---|---|---|---|
| 60s | 5 | 1 | 60 | 0 | 0 |
| 120s | 5 | 1 | 60 | 0 | 1 |
| 180s | 5 | 1 | 60 | 1 | 2 |
| 240s | 5 | 1 | 60 | 1 | 3 |
| 300s | 5 | 1 | 60 | 1 | 4 |
| 360s | 5 | 1 | 60 | 1 | 4 |

最終時点 (360s) の仕掛けごとの作動回数 (`gimmicks`):

| 仕掛け | 作動回数 |
|---|---|
| ramp1 | 246 |
| seesaw | 101 |
| launcher | 91 |
| ramp2 | 98 |
| elevator | 85 |
| branchLeft | 42 |
| branchRight | 46 |
| pendulum | 95 |
| domino | 91 |
| wheel | 90 |
| bounceFloor | 88 |
| landingBoost | 91 |

判定:

- 連続稼働: 360,435ms (6 分超) 稼働継続、途中で `window.__pitagora` の取得が
  途切れることはなかった → **合格**
- 最小アクティブボール数: 全区間で 1 → **合格**
- 平均 fps: 60 (全サンプルで 60 固定) → **合格**
- 最低 fps: 60 → **合格**
- 仕掛けごとの作動回数: 全 12 項目が 1 以上 (最小でも branchLeft の 42 回) → **合格**
- コンソールエラー: 0 件 → **合格**

結論: **6 分間の連続稼働で装置は詰まらず、全仕掛けが繰り返し作動し、fps 低下も
発生しなかった。**

## デバッグ設定パネルの動作確認

パネル操作 (開閉・5 つの設定項目) は数値の記録だけでなく実際の操作イベントで検証する
必要があるため、`scripts/verify-stability.mjs` とは別に、CDP の `Input.dispatchMouseEvent` /
`Input.dispatchKeyEvent` でクリック・キー入力そのものを送るスクリプトを使う
(このスクリプトはリポジトリには含めていない検証用の一時スクリプトのため、
同じ考え方で作る場合の要点だけ残す)。

- クリック位置は決め打ちにせず、`element.getBoundingClientRect()` を
  `Runtime.evaluate` で毎回取得してから `Input.dispatchMouseEvent` に渡す
  (ウィンドウサイズやレイアウト変更に強くするため)。
- `<button>` 要素に対して Enter キーでのクリックを CDP から再現する場合、
  `Input.dispatchKeyEvent` の `type: "keyDown"` に `text: "\r"` を含める必要がある
  (`type: "rawKeyDown"` 単体では、ブラウザ内部の「Enter キーで button をクリックする」
  というネイティブ処理がトリガーされないことを実測で確認した)。
- 開閉状態は `document.querySelector('#pg-panel').hidden` と
  `#pg-panel-toggle` の `aria-expanded` 属性を毎回読み、期待通りに切り替わって
  いるかを機械的に検証する (スクリーンショットの目視だけに頼らない)。
