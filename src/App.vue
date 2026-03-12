<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { 
  Button, Field, CellGroup, Cell, RadioGroup, Radio, 
  RadioButton, Checkbox, CheckboxButton, CheckboxGroup,
  Dialog, Toast, NavBar, Tabbar, TabbarItem, 
  Popup, Uploader, Empty, Loading
} from 'vant'
import { callLLM } from '@/utils/api'

const store = useAppStore()

const activeTab = ref('banks')
const showSettings = ref(false)
const showImport = ref(false)
const showExam = ref(false)
const showResult = ref(false)
const showWrongDetail = ref(false)

// 设置表单
const settingsForm = ref({
  apiKey: '',
  questionCount: 10
})

// 导入表单
const importForm = ref({
  name: '',
  text: ''
})
const isGenerating = ref(false)

// 答题
const currentIndex = ref(0)
const examResult = ref(null)

// 错题详情
const currentWrongQuestion = ref(null)

onMounted(async () => {
  await store.loadData()
  settingsForm.value = {
    apiKey: store.settings.apiKey,
    questionCount: store.settings.questionCount
  }
})

// 保存设置
async function saveSettings() {
  await store.saveSettings(settingsForm.value)
  showSettings.value = false
  Toast.success('保存成功')
}

// 生成题目
async function generateQuestions() {
  if (!importForm.value.name || !importForm.value.text) {
    Toast.fail('请填写名称和文本内容')
    return
  }
  
  isGenerating.value = true
  try {
    const questions = await callLLM(importForm.value.text, 'generate')
    if (Array.isArray(questions)) {
      await store.createBank(importForm.value.name, importForm.value.text, questions)
      showImport.value = false
      importForm.value = { name: '', text: '' }
      Toast.success(`生成${questions.length}道题目`)
    } else {
      Toast.fail('生成失败，请重试')
    }
  } catch (e) {
    Toast.fail(e.message || '生成失败')
  } finally {
    isGenerating.value = false
  }
}

// 开始答题
function startExam(bank) {
  store.startExam(bank)
  currentIndex.value = 0
  showExam.value = true
}

// 提交答案
function submitAnswer(answer) {
  const q = store.currentQuestions[currentIndex.value]
  store.submitAnswer(q.id, answer)
  
  if (currentIndex.value < store.currentQuestions.length - 1) {
    currentIndex.value++
  } else {
    finishExam()
  }
}

// 交卷
async function finishExam() {
  const result = await store.finishExam()
  examResult.value = result
  showExam.value = false
  showResult.value = true
}

// 删除题库
async function removeBank(id) {
  await Dialog.confirm('确定删除该题库?')
  await store.removeBank(id)
  Toast.success('删除成功')
}

// 导出题库
function exportBank(bank) {
  const json = JSON.stringify(bank, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bank.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 查看错题详情
async function analyzeWrong(wq) {
  currentWrongQuestion.value = wq
  if (!wq.aiAnalysis) {
    try {
      Toast.loading({ message: 'AI解析中...', forbidClick: true })
      const analysis = await callLLM({
        question: wq.question,
        options: wq.options,
        correctAnswer: wq.correctAnswer,
        userAnswer: wq.userAnswer
      }, 'analyze')
      wq.aiAnalysis = analysis
      Toast.clear()
    } catch (e) {
      Toast.fail('解析失败')
    }
  }
  showWrongDetail.value = true
}

// 删除错题
async function removeWrong(id) {
  await store.removeWrongQuestion(id)
  Toast.success('删除成功')
}
</script>

<template>
  <div class="app">
    <van-nav-bar title="刷题助手" fixed>
      <template #right>
        <van-icon name="setting-o" size="20" @click="showSettings = true" />
      </template>
    </van-nav-bar>

    <div class="content">
      <!-- 题库管理 -->
      <div v-if="activeTab === 'banks'" class="page">
        <div class="page-header">
          <h3>题库管理</h3>
          <van-button type="primary" size="small" @click="showImport = true">+ 创建题库</van-button>
        </div>
        
        <div v-if="store.banks.length === 0" class="empty-wrap">
          <van-empty description="还没有题库" />
        </div>
        
        <van-cell-group v-else>
          <van-cell v-for="bank in store.banks" :key="bank.id" :title="bank.name">
            <template #label>
              <span>{{ bank.questions?.length || 0 }}道题</span>
            </template>
            <template #value>
              <van-space>
                <van-button size="small" type="primary" @click="startExam(bank)">答题</van-button>
                <van-button size="small" @click="exportBank(bank)">导出</van-button>
                <van-button size="small" type="danger" @click="removeBank(bank.id)">删除</van-button>
              </van-space>
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- 答题记录 -->
      <div v-if="activeTab === 'records'" class="page">
        <h3>答题记录</h3>
        
        <div v-if="store.records.length === 0" class="empty-wrap">
          <van-empty description="还没有答题记录" />
        </div>
        
        <van-cell-group v-else>
          <van-cell v-for="r in store.records" :key="r.id" :title="r.bankName">
            <template #label>
              {{ new Date(r.date).toLocaleString() }}
            </template>
            <template #value>
              <span :style="{ color: r.score >= 60 ? '#07c160' : '#ee0a24' }">
                {{ r.score }}分
              </span>
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- 错题本 -->
      <div v-if="activeTab === 'wrong'" class="page">
        <div class="page-header">
          <h3>错题本</h3>
          <van-button v-if="store.wrongQuestions.length" size="small" type="danger" @click="store.clearWrong()">
            清空
          </van-button>
        </div>
        
        <div v-if="store.wrongQuestions.length === 0" class="empty-wrap">
          <van-empty description="没有错题" />
        </div>
        
        <van-cell-group v-else>
          <van-cell v-for="wq in store.wrongQuestions" :key="wq.id" :title="wq.question" is-link @click="analyzeWrong(wq)">
            <template #label>
              正确答案: {{ wq.correctAnswer }} | 你的答案: {{ wq.userAnswer }}
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </div>

    <van-tabbar v-model="activeTab">
      <van-tabbar-item name="banks" icon="folder">题库</van-tabbar-item>
      <van-tabbar-item name="records" icon="clock">记录</van-tabbar-item>
      <van-tabbar-item name="wrong" icon="warning">错题</van-tabbar-item>
    </van-tabbar>

    <!-- 设置弹窗 -->
    <van-popup v-model:show="showSettings" position="top" :style="{ height: '50%' }">
      <div class="popup-content">
        <h3>设置</h3>
        <van-cell-group>
          <van-cell title="API Key">
            <van-field v-model="settingsForm.apiKey" placeholder="请输入MiniMax API Key" />
          </van-cell>
          <van-cell title="生成题目数量">
            <van-field v-model.number="settingsForm.questionCount" type="digit" placeholder="10" />
          </van-cell>
        </van-cell-group>
        <van-button type="primary" block @click="saveSettings" style="margin-top: 20px">保存</van-button>
      </div>
    </van-popup>

    <!-- 导入弹窗 -->
    <van-popup v-model:show="showImport" position="top" :style="{ height: '80%' }">
      <div class="popup-content">
        <h3>创建题库</h3>
        <van-cell-group>
          <van-cell title="题库名称">
            <van-field v-model="importForm.name" placeholder="请输入名称" />
          </van-cell>
          <van-cell title="文本内容">
            <van-field v-model="importForm.text" type="textarea" rows="6" placeholder="请输入学习文本内容，AI将自动生成题目" />
          </van-cell>
        </van-cell-group>
        <van-button type="primary" block :loading="isGenerating" @click="generateQuestions">
          {{ isGenerating ? 'AI生成中...' : 'AI生成题目' }}
        </van-button>
      </div>
    </van-popup>

    <!-- 答题弹窗 -->
    <van-popup v-model:show="showExam" position="top" :style="{ height: '90%' }" :closeable="true">
      <div class="exam-content">
        <div class="exam-header">
          <span>第{{ currentIndex + 1 }}/{{ store.currentQuestions.length }}题</span>
        </div>
        
        <div v-if="store.currentQuestions[currentIndex]" class="question-box">
          <div class="question-text">{{ store.currentQuestions[currentIndex].question }}</div>
          
          <van-radio-group 
            v-model="store.currentAnswers[store.currentQuestions[currentIndex].id]" 
            @change="submitAnswer"
          >
            <van-radio v-for="(opt, i) in store.currentQuestions[currentIndex].options" :key="i" :name="String.fromCharCode(65 + i)" shape="square">
              {{ String.fromCharCode(65 + i) }}. {{ opt }}
            </van-radio>
          </van-radio-group>
        </div>
      </div>
    </van-popup>

    <!-- 结果弹窗 -->
    <van-popup v-model:show="showResult" position="top" :style="{ height: '40%' }">
      <div class="popup-content" style="text-align: center; padding-top: 60px">
        <div class="score">{{ examResult?.score }}分</div>
        <p>正确 {{ examResult?.correct }} / {{ examResult?.total }}</p>
        <van-button type="primary" @click="showResult = false">确定</van-button>
      </div>
    </van-popup>

    <!-- 错题详情弹窗 -->
    <van-popup v-model:show="showWrongDetail" position="top" :style="{ height: '70%' }">
      <div class="popup-content" v-if="currentWrongQuestion">
        <h3>错题解析</h3>
        <p><strong>题目：</strong>{{ currentWrongQuestion.question }}</p>
        <p><strong>正确答案：</strong>{{ currentWrongQuestion.correctAnswer }}</p>
        <p><strong>你的答案：</strong>{{ currentWrongQuestion.userAnswer }}</p>
        <div v-if="currentWrongQuestion.aiAnalysis">
          <p><strong>AI解析：</strong></p>
          <p>{{ currentWrongQuestion.aiAnalysis }}</p>
        </div>
        <van-button type="danger" block @click="removeWrong(currentWrongQuestion.id)" style="margin-top: 20px">
          删除此题
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app {
  min-height: 100vh;
  background: #f5f5f5;
}

.content {
  padding: 60px 16px 60px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h3 {
  margin: 0;
}

.empty-wrap {
  padding: 60px 0;
}

.popup-content {
  padding: 20px;
}

.popup-content h3 {
  margin: 0 0 16px;
  text-align: center;
}

.exam-content {
  padding: 50px 20px 20px;
  height: 100%;
}

.exam-header {
  text-align: center;
  margin-bottom: 20px;
  color: #666;
}

.question-box {
  margin-top: 20px;
}

.question-text {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  line-height: 1.6;
}

.van-radio {
  margin-bottom: 12px;
}

.score {
  font-size: 48px;
  font-weight: bold;
  color: #07c160;
  margin-bottom: 16px;
}
</style>
