# Maidel2.1 概要設計書（MVP版）

## 1. システム概要
Maidel2.1 は、**チャットベースで予定管理を行えるパーソナルアシスタント**です。  
ユーザーが自然言語で指示すると、Claude API が適切な MCP ツールを選択し、  
Google Calendar に対して予定の参照・作成を行います。

---

## 2. システム構成

```text
[ユーザー]
    │ 自然言語で指示
    ▼
[Maidel2.1 (Electron/Node)]
    ├─ Claude API (Sonnet)
    │     └─ 自然言語 → ツール呼び出し(JSON)
    └─ MCPクライアント層
          └─ Google Calendar MCPサーバー
```

- **Maidel2.1 (ホスト)**  
  - アプリ本体。Claude APIを呼び出す。  
  - MCPクライアント機能を持ち、MCPサーバーと接続。  

- **Claude API (大脳)**  
  - ユーザー発話を理解し、利用可能なツール一覧から適切なツールを選択。  
  - MCPクライアントからの観察結果を要約してユーザーに返答。  

- **MCPクライアント層**  
  - MCPサーバーと通信（`initialize` / `tools/list` / `tools/call`）。  
  - Claudeからのツール呼び出しを受けて、サーバーに橋渡しする。  

- **Google Calendar MCPサーバー**  
  - Google Calendar API を MCP プロトコルでラップしたサーバー。  
  - `list-events` や `create-event` などのツールを提供。  

---

## 3. データフロー（例：予定の参照）

1. ユーザー: 「今日の予定見せて」  
2. Maidel2.1: Claude API にプロンプトを送信（利用可能ツール情報付き）  
3. Claude API:  
   - ツール `list-events` を選択  
   - 引数 `{ calendarId:"primary", timeMin:..., timeMax:... }` を生成  
4. MCPクライアント: Google Calendar MCPサーバーに `tools/call`  
5. サーバー: 指定範囲の予定を返す  
6. Maidel2.1: 取得した予定を Claude API に渡す  
7. Claude API: 「今日の予定は20時から“Maidel開発”があります」と要約  
8. ユーザーに表示  

---

## 4. 想定ユースケース（MVP）

- **予定の参照**  
  - 「今日の予定見せて」  
  - 「来週の水曜日の予定を確認して」  

- **予定の作成**  
  - 「今日20時〜22時に“Maidel開発”を入れて」  
  - 「明日の午後3時から30分、買い物の予定を追加して」  

---

## 5. 非機能要件

- **セキュリティ**  
  - Google OAuth JSON は OS キーチェーン（keytar）または安全な.env管理  
  - アプリに直書き禁止  

- **ログ**  
  - MCPサーバーごとに専用ログを出力（デバッグ用）  

- **タイムゾーン**  
  - 日本時間 (JST, +09:00) を基準  

---

## 6. 拡張性（将来）

- 他の MCP サーバー（例：株分析、日誌RAG）の追加  
- 書き込み系操作の確認ダイアログ（安全モード）  
- 複数予定の自動生成（プランニング機能）

---
