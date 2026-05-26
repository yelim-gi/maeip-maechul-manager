import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const categories = [
  '매출',
  '상품매입',
  '포장재',
  '배송비',
  '플랫폼수수료',
  '광고비',
  '관부가세',
  '기타비용',
  '개인사용/사업무관',
  '확인필요'
]

export function uid() {
  return crypto.randomUUID()
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function getMonth(date) {
  if (!date) return ''
  return String(date).slice(0, 7)
}

export function formatWon(value) {
  const num = Number(value || 0)
  return `${num.toLocaleString('ko-KR')}원`
}

function getValue(row, names) {
  const keys = Object.keys(row || {})
  for (const name of names) {
    const found = keys.find(k => String(k).replace(/\s/g, '').toLowerCase().includes(name.toLowerCase()))
    if (found) return row[found]
  }
  return ''
}

function parseAmount(value) {
  return Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0
}

function applyRule(vendor, rules) {
  const text = String(vendor || '').toLowerCase()
  return rules.find(r => text.includes(String(r.vendor_keyword || '').toLowerCase()))
}

export async function readSpreadsheet(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    return parsed.data
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

export function normalizeImportedRows(rows, rules = []) {
  return rows.map(row => {
    const date = getValue(row, ['날짜', '거래일', '승인일', '일자', 'date'])
    const vendor = getValue(row, ['거래처', '사용처', '가맹점', '적요', '내용', 'vendor'])
    const title = getValue(row, ['내용', '품목', '메모', 'title', 'description'])
    const amount = parseAmount(getValue(row, ['금액', '출금', '입금', '결제금액', '이용금액', 'amount']))
    const rule = applyRule(vendor || title, rules)

    return {
      id: uid(),
      type: rule?.default_type || (amount > 0 ? 'income' : 'expense'),
      transaction_date: date || new Date().toISOString().slice(0, 10),
      vendor: vendor || title || '미확인',
      title: title || '',
      category: rule?.default_category || '확인필요',
      amount: Math.abs(amount),
      vat: 0,
      payment_method: '',
      evidence_status: 'none',
      memo: ''
    }
  })
}

export function makeSummary(transactions, documents, month) {
  const tx = transactions.filter(t => getMonth(t.transaction_date) === month)
  const docs = documents.filter(d => getMonth(d.document_date) === month)

  const income = tx
    .filter(t => t.type === 'income' || t.category === '매출')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const expense = tx
    .filter(t => t.type !== 'income' && t.category !== '매출')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const noEvidence = tx.filter(t => t.evidence_status === 'none').length
  const needsReview = docs.filter(d => d.status === 'needs_review').length

  return {
    income,
    expense,
    profit: income - expense,
    noEvidence,
    needsReview,
    txCount: tx.length,
    docCount: docs.length
  }
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31))
  })
  XLSX.writeFile(wb, filename)
}
