# Maidel2.1 MCPクライアント インターフェース仕様書（MVP版）

## 1. 目的
MCPクライアントは、Maidel2.1 と MCPサーバー間の橋渡しを行うコンポーネントである。  
Claude API が生成した「ツール呼び出しリクエスト」を受け取り、MCPサーバーに正しく中継し、結果を返す責務を持つ。

---

## 2. クライアントの責務
1. **MCPサーバー起動と接続**
   - 指定されたコマンド（例: `npx @cocal/google-calendar-mcp`）でサーバーを起動
   - 標準入出力（stdio）で通信を確立する

2. **初期化処理**
   - `initialize` メッセージをサーバーに送信
   - サーバーの対応する protocolVersion / capabilities を確認

3. **ツール一覧取得**
   - `tools/list` を呼び出し、提供されるツール群と引数スキーマをキャッシュする

4. **ツール呼び出し**
   - Claude API から受け取った「tool_name」「arguments」に基づき
   - 対応する MCP サーバーの `tools/call` を実行
   - 成功結果 / エラーを呼び出し元に返す

5. **エラーハンドリング**
   - JSONパースエラー、タイムアウト、invalid args を明示的に返却
   - デバッグ用ログを残す

---

## 3. 通信仕様（JSON-RPC 2.0）

### 3.1 共通形式
- **リクエスト**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

- **レスポンス**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

---

## 4. サンプルやりとり（Google Calendar）

### 4.1 ツール一覧
**リクエスト**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

**レスポンス例**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "list-events",
        "description": "List events from a calendar",
        "inputSchema": {
          "type": "object",
          "properties": {
            "calendarId": {"type":"string"},
            "timeMin": {"type":"string","format":"date-time"},
            "timeMax": {"type":"string","format":"date-time"}
          },
          "required": ["calendarId"]
        }
      },
      {
        "name": "create-event",
        "description": "Create a new event",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### 4.2 ツール呼び出し（予定一覧取得）
**リクエスト**
```json
{
  "jsonrpc":"2.0",
  "id":2,
  "method":"tools/call",
  "params":{
    "name":"list-events",
    "arguments":{
      "calendarId":"primary",
      "timeMin":"2025-09-17T00:00:00+09:00",
      "timeMax":"2025-09-18T00:00:00+09:00"
    }
  }
}
```

**レスポンス例**
```json
{
  "jsonrpc":"2.0",
  "id":2,
  "result":{
    "events":[
      {
        "id":"abc123",
        "summary":"Maidel開発",
        "start":"2025-09-17T20:00:00+09:00",
        "end":"2025-09-17T22:00:00+09:00"
      }
    ]
  }
}
```

---

## 5. エラー仕様

- **Invalid arguments**
```json
{
  "jsonrpc":"2.0",
  "id":3,
  "error": { "code": -32602, "message": "Invalid params" }
}
```

- **Timeout / サーバー停止**
  - 明示的にエラーを返す  
  - ログファイルに記録（例: `mcp.google-calendar.log`）

---

## 6. 非機能要件
- **セキュリティ**
  - `GOOGLE_OAUTH_CREDENTIALS` の参照はOS Keychainまたは安全な.env管理
- **ログ**
  - `mcp.google-calendar.log` に入出力を保存（開発時のみ）
- **拡張**
  - `tools/list` 結果を元に自動的にツールセットを更新可能にすること

---
