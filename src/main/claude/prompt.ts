import { MCPTool } from '../mcp/types'

export class PromptManager {
  static getSystemPrompt(tools: MCPTool[]): string {
    const currentTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

    let prompt = `あなたはMaidel 2.1のAIアシスタント「クロコ」です。

現在の日時: ${currentTime} (日本時間)

## あなたの特徴
- 執事のような丁寧で親しみやすいAIアシスタント
- ユーザーの生活をサポートすることが使命
- 日本語での自然な対話を心がける
- カレンダーや予定管理が得意分野

## 応答スタイル
- 丁寧語（「です・ます」調）を基本とする
- ユーザーを「お客様」ではなく親しみやすく呼ぶ
- 必要に応じて確認を取りながら進める
- エラーが発生した場合は分かりやすく説明する

## 時間の扱い
- すべての時間は日本時間(JST, +09:00)を基準とする
- 「今日」「明日」「来週」などの相対的な表現を正しく解釈する
- 時刻の指定がない場合は適切に確認する

## カレンダー操作の原則
- 予定を作成する前に、内容・時間・期間を確認する
- 重複する可能性がある場合は既存の予定をチェックする
- 予定の詳細（場所、説明など）も適切に設定する`

    if (tools.length > 0) {
      prompt += `\n\n## 利用可能なツール\n`
      for (const tool of tools) {
        prompt += `### ${tool.name}\n${tool.description}\n\n`
      }
    }

    prompt += `\n## 会話の進め方
1. ユーザーの意図を正確に理解する
2. 必要に応じてツールを使用してカレンダーを操作する
3. 結果を分かりやすく要約して報告する
4. 追加の操作が必要か確認する

それでは、どのようなお手伝いができるでしょうか？`

    return prompt
  }

  static getUserMessageWithContext(message: string, context?: any): string {
    if (!context) {
      return message
    }

    let contextStr = ''

    if (context.currentEvents) {
      contextStr += `\n\n[現在の予定情報]\n${JSON.stringify(context.currentEvents, null, 2)}`
    }

    if (context.userPreferences) {
      contextStr += `\n\n[ユーザー設定]\n${JSON.stringify(context.userPreferences, null, 2)}`
    }

    return message + contextStr
  }

  static generateCalendarPrompt(action: 'list' | 'create' | 'update' | 'delete'): string {
    const prompts = {
      list: 'カレンダーの予定を取得してください。期間を指定してください。',
      create: '新しい予定を作成してください。タイトル、開始時間、終了時間は必須です。',
      update: '既存の予定を更新してください。予定IDと更新内容を指定してください。',
      delete: '予定を削除してください。予定IDを指定してください。'
    }

    return prompts[action] || '予定に関する操作を実行してください。'
  }

  static formatTimeForJapanese(dateTime: string): string {
    try {
      const date = new Date(dateTime)
      return date.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      })
    } catch {
      return dateTime
    }
  }

  static parseRelativeTime(input: string): { start: Date, end?: Date } | null {
    const now = new Date()

    // 今日
    if (input.includes('今日')) {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 1)
      return { start, end }
    }

    // 明日
    if (input.includes('明日')) {
      const start = new Date(now)
      start.setDate(now.getDate() + 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 1)
      return { start, end }
    }

    // 今週
    if (input.includes('今週')) {
      const start = new Date(now)
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - dayOfWeek)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { start, end }
    }

    // 来週
    if (input.includes('来週')) {
      const start = new Date(now)
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - dayOfWeek + 7)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { start, end }
    }

    return null
  }
}