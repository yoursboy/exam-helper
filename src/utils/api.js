import { getSetting } from './db'

const API_BASE = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

export async function callLLM(text, type = 'generate') {
  const apiKey = await getSetting('apiKey')
  if (!apiKey) {
    throw new Error('请先配置API Key')
  }

  let prompt = ''
  
  if (type === 'generate') {
    const count = await getSetting('questionCount') || 10
    prompt = `请根据以下文本内容生成${count}道选择题。

要求：
1. 每道题4个选项，只有一个正确答案
2. 返回JSON数组格式
3. 题目要覆盖文本重点
4. 只返回JSON数组，不要其他内容

文本内容：
${text}

返回格式：
[
  {"question": "题目", "options": ["A", "B", "C", "D"], "answer": "A"}
]`
  } else if (type === 'analyze') {
    prompt = `题目：${text.question}
选项：${text.options.join(', ')}
正确答案：${text.correctAnswer}
用户答案：${text.userAnswer}

请分析用户为什么做错，并给出详细解析。`
  }

  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'abab6.5s-chat',
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!response.ok) {
    throw new Error('API调用失败')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // 解析JSON
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('JSON解析失败:', e)
  }
  
  return content
}
