import { openDB } from 'idb'

const DB_NAME = 'exam-helper'
const DB_VERSION = 1

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 题库
      if (!db.objectStoreNames.contains('banks')) {
        db.createObjectStore('banks', { keyPath: 'id', autoIncrement: true })
      }
      // 答题记录
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
      }
      // 错题本
      if (!db.objectStoreNames.contains('wrongQuestions')) {
        db.createObjectStore('wrongQuestions', { keyPath: 'id', autoIncrement: true })
      }
      // 设置
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
}

// 题库操作
export async function addBank(bank) {
  const db = await initDB()
  return db.add('banks', bank)
}

export async function getAllBanks() {
  const db = await initDB()
  return db.getAll('banks')
}

export async function deleteBank(id) {
  const db = await initDB()
  return db.delete('banks', id)
}

// 答题记录操作
export async function addRecord(record) {
  const db = await initDB()
  return db.add('records', record)
}

export async function getAllRecords() {
  const db = await initDB()
  return db.getAll('records')
}

// 错题本操作
export async function addWrongQuestion(wq) {
  const db = await initDB()
  return db.add('wrongQuestions', wq)
}

export async function getAllWrongQuestions() {
  const db = await initDB()
  return db.getAll('wrongQuestions')
}

export async function deleteWrongQuestion(id) {
  const db = await initDB()
  return db.delete('wrongQuestions', id)
}

export async function clearWrongQuestions() {
  const db = await initDB()
  const tx = db.transaction('wrongQuestions', 'readwrite')
  await tx.store.clear()
  return tx.done
}

// 设置操作
export async function getSetting(key) {
  const db = await initDB()
  const result = await db.get('settings', key)
  return result?.value
}

export async function setSetting(key, value) {
  const db = await initDB()
  return db.put('settings', { key, value })
}
