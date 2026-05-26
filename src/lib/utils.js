import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export const categories = [
  '매출',
  '상품매입',
  '포장재',
  '배송비',
  '플랫폼 수수료',
  '광고비',
  '관부가세',
  '사무용품',
  '환불',
  '기타비용',
  '개인사용/사업무관',
  '확인필요'
]

export function formatWon(value) {
  const n = Number(value || 0)
  return n.toLocaleString('ko-KR') + '원'
}

export function formatDate(date) {
  if (!date) return ''
  return String(date).slice(0, 10)
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function getMonth(date) {
  return String(date || '').slice(0, 7)
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}

export function numberOnly(value) {
  if (typeof value === 'number') return value
  const cleaned = String(value || '').replace(/[^\d.-]/g, '')
  return Number(cleaned || 0)
}

export function guessCategory(vendor = '', rules = []) {
  const found = rules.find(rule =>
    vendor.toLowerCase().includes(String(rule.vendor_keyword || '').toLowerCase())
  )
  return found || null
}

export function compareAmount(a, b, tolerance = 1000) {
  const diff = Number(a || 0) - Number(b || 0)
  return {
    diff,
    matched: Math.abs(diff) <= tolerance
  }
}

export function exportExcel(filename, sheets) {
  const wb = XLSX.utils.book_new()
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  })
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([out], { type: 'application/octet-stream' }), filename)
}

export async function readSpreadsheet(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
}

export function normalizeImportedRows(rows, rules = []) {
  return rows.map(row => {
    const keys = Object.keys(row)
    const find = words => {
      const key = keys.find(k => words.some(w => String(k).includes(w)))
      return key ? row[key] : ''
    }

    const date = find(['날짜', '일자', '거래일', '결제일', '사용일']) || new Date().toISOString().slice(0, 10)
    const vendor = find(['거래처', '사용처', '가맹점', '내용', '적요', '상호']) || ''
    const amount = numberOnly(find(['금액', '출금', '입금', '결제금액', '승인금액']))
    const memo = find(['메모', '비고', '내용', '적요']) || ''
    const rule = guessCategory(vendor, rules)

    return {
      id: uid(),
      type: rule?.default_type || (amount < 0 ? 'expense' : 'expense'),
      transaction_date: String(date).slice(0, 10),
      vendor,
      title: vendor || memo || '업로드 거래',
      category: rule?.default_category || '확인필요',
      amount: Math.abs(amount),
      vat: 0,
      payment_method: '',
      evidence_status: 'none',
      memo,
      matched_document_id: ''
    }
  })
}

export function makeSummary(transactions, documents, month) {
  const tx = transactions.filter(t => getMonth(t.transaction_date) === month)
  const docs = documents.filter(d => getMonth(d.document_date) === month)
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const expense = tx.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const vat = tx.reduce((s, t) => s + Number(t.vat || 0), 0)
  const noEvidence = tx.filter(t => t.evidence_status === 'none').length
  const needsReview = docs.filter(d => d.status === 'needs_review').length

  return {
    income,
    expense,
    profit: income - expense,
    vat,
    noEvidence,
    needsReview,
    txCount: tx.length,
    docCount: docs.length
  }
}
