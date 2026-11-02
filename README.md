# スロットを爆発せよ！ — ASOBEAT

GitHub Pages対応のHTML/CSS/JavaScriptブラウザゲームです。メインファイルは `index.html`。

## 起動

`index.html` をWebサーバー経由で開いてください。例：このフォルダで `python3 -m http.server 8000` を実行し、`http://localhost:8000` にアクセスします。GitHub Pagesでも動作します。

Firebaseが未設定でも、ゲーム本体・ローカル自己ベスト・音声ON/OFF・プレイヤー名は利用できます。オンラインランキングはFirebaseの設定が必要です。

## Firebase設定（オンラインTOP100）

1. Firebaseプロジェクトを作成し、Webアプリを登録します。
2. Authenticationで「匿名」サインインを有効にします。
3. Cloud Firestoreを作成します。テストモードのまま公開しないでください。
4. `firebase-config.js` にWebアプリの設定を記入します。Firebase Web APIキーは秘密鍵ではありませんが、プロジェクトの適切な制限・監視を行ってください。
5. Firestoreのルール画面に `firestore.rules` の内容を登録します。
6. Firestoreのクエリで必要な複合インデックス（`bestHeight` 降順、`achievedAt` 昇順、ドキュメントID昇順）を作成します。必要なインデックスはFirebaseのエラーメッセージから作成できます。
7. Firebase Authenticationの承認済みドメインに公開先を設定します。
8. 実機で認証、0m登録、更新、同点、通信断・再送を確認してください。

### 注意事項

- Security Rulesは本人以外の更新・数値範囲外・自己ベストの減少を防ぎますが、クライアントによる偽スコアの送信は完全には防止できません。
- 端末のブラウザデータを削除すると匿名認証情報が消えることがあります。別ブラウザ・別端末は別ユーザーとして扱われます。
- 送信失敗時のローカル再送は次回起動時に1回試行します。再送後のランキング記録時刻はサーバー受理時刻です。
- 無料枠・利用条件はFirebaseの最新条件を確認してください。
- 広告は審査前のため未接続です。下部の固定広告領域のみ用意しています。Google AdSenseは候補であり、利用確定ではありません。
- iPhone Safari、Android Chrome、PC実機でのQAは未実施です。ブラウザの入力遅延により、内部判定±5msと実際のタッチ精度は一致しないことがあります。

## 実装と仕様の境界

- 3リール同速・同位相、7→BAR→ベル→チェリー→スイカ、周期800ms、JUST±5ms、15秒制限。
- 777は最大1,000,000m、それ以外は上限10,000m、平均精度の3乗曲線、整数mに四捨五入。
- 0回STOPの15秒経過は0m。1〜2回STOPの15秒経過は残りを自動停止して通常計算。
- 完全JUSTは1,000,000m。通常の最低高度は10m。
- 爆発0.8秒、上昇5秒。0mでは爆発のみで飛行しません。
- 15称号＋0m専用称号。ランキングは1人1件、先着順同点判定。
- 広告配信・高度に応じた背景の厳密なクロスフェード・サウンド素材の制作は今後の検証・調整が必要です。

## ファイル

- `index.html` 画面構造
- `style.css` レスポンシブUI
- `game.js` ゲーム本体・Canvas描画・演出
- `ranking.js` Firebase通信・ランキング
- `firebase-config.js` Firebase接続設定（未入力）
- `firestore.rules` Firestoreセキュリティルール案（実機検証未実施）


## Ver.1.1 gameplay changes
- STOP captures the original high-resolution timestamp for scoring; the reel then eases to the nearest centered symbol over 180ms.
- Reel symbols descend visually. Bell, cherry, and watermelon use emoji.
- The full game viewport displays a one-second explosion after all reels finish snapping, followed by the original ascent sequence.
- 777 displays a large horizontal BIG BONUS banner during the ascent after the explosion.

## Ver.1.2 変更点
- 最大到達高度でカメラを固定し、スロット台のみ重力加速の曲線で1秒間落下させてから結果表示します（0mの例外は既存どおり）。
- 結果画面にX共有ボタンを追加。飛距離、称号、`#スロット爆発 #ゲーム開発 #gamedev`、公開URLを含みます。
- X共有はユーザーがボタンを押した場合のみ開き、投稿自体はユーザーが確認して実行します。
