import { defineStore } from 'pinia'
import { ref } from 'vue'
import { 
  getAllBanks, addBank, deleteBank,
  getAllRecords, addRecord,
  getAllWrongQuestions, addWrongQuestion, deleteWrongQuestion, clearWrongQuestions,
  getSetting, setSetting
} from '@/utils/db'

export const useAppStore = defineStore('app', () => {
  // 状态
  const banks = ref([])
  const records = ref([])
  const wrongQuestions = ref([])
  const currentBank = ref(null)
  const currentQuestions = ref([])
  const currentAnswers = ref({})
  const settings = ref({
    apiKey: '',
    questionCount: 10,
    theme: 'light'
  })

  // 加载数据
  async function loadData() {
    banks.value = await getAllBanks()
    records.value = await getAllRecords()
    wrongQuestions.value = await getAllWrongQuestions()
    settings.value.apiKey = await getSetting('apiKey') || ''
    settings.value.questionCount = parseInt(await getSetting('questionCount')) || 10
    settings.value.theme = await getSetting('theme') || 'light'
  }

  // 题库管理
  async function createBank(name, sourceText, questions) {
    const bank = {
      name,
      sourceText: sourceText.substring(0, 200),
      questions,
      createdAt: Date.now()
    }
    await addBank(bank)
    await loadData()
  }

  async function removeBank(id) {
    await deleteBank(id)
    await loadData()
  }

  // 答题
  function startExam(bank) {
    currentBank.value = bank
    currentQuestions.value = [...bank.questions].sort(() => Math.random() - 0.5)
    currentAnswers.value = {}
  }

  function submitAnswer(questionId, answer) {
    currentAnswers.value[questionId] = answer
  }

  async function finishExam() {
    if (!currentBank.value) return null
    
    let correct = 0
    const results = []
    
    for (const q of currentQuestions.value) {
      const userAnswer = currentAnswers.value[q.id]
      const isCorrect = userAnswer === q.answer
      if (isCorrect) correct++
      
      results.push({
        questionId: q.id,
        userAnswer,
        correct: q.answer,
        isCorrect
      })
      
      // 记录错题
      if (!isCorrect) {
        await addWrongQuestion({
          question: q.question,
          options: q.options,
          userAnswer,
          correctAnswer: q.answer,
          aiAnalysis: '',
          analyzedAt: null,
          bankId: currentBank.value.id
        })
      }
    }
    
    const score = Math.round((correct / currentQuestions.value.length) * 100)
    
    // 保存记录
    await addRecord({
      bankId: currentBank.value.id,
      bankName: currentBank.value.name,
      score,
      total: currentQuestions.value.length,
      correct,
      results,
      date: Date.now()
    })
    
    await loadData()
    return { score, correct, total: currentQuestions.value.length }
  }

  // 错题本
  async function removeWrongQuestion(id) {
    await deleteWrongQuestion(id)
    await loadData()
  }

  async function clearWrong() {
    await clearWrongQuestions()
    await loadData()
  }

  // 设置
  async function saveSettings(newSettings) {
    if (newSettings.apiKey !== undefined) {
      await setSetting('apiKey', newSettings.apiKey)
    }
    if (newSettings.questionCount !== undefined) {
      await setSetting('questionCount', String(newSettings.questionCount))
    }
    if (newSettings.theme !== undefined) {
      await setSetting('theme', newSettings.theme)
    }
    await loadData()
  }

  return {
    banks,
    records,
    wrongQuestions,
    currentBank,
    currentQuestions,
    currentAnswers,
    settings,
    loadData,
    createBank,
    removeBank,
    startExam,
    submitAnswer,
    finishExam,
    removeWrongQuestion,
    clearWrong,
    saveSettings
  }
})
