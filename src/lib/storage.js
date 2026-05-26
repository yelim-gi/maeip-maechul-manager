const TX_KEY = 'maeip_transactions'
const DOC_KEY = 'maeip_documents'
const RULE_KEY = 'maeip_vendor_rules'

const defaultRules = [
  { vendor_keyword: 'SUPER DELIVERY', default_category: '상품매입', default_type: 'expense' },
  { vendor_keyword: '슈퍼딜리버리', default_category: '상품매입', default_type: 'expense' },
  { vendor_keyword: '우체국', default_category: '배송비', default_type: 'expense' },
  { vendor_keyword: '관세', default_category: '관부가세', default_type: 'expense' },
  { vendor_keyword: '네이버', default_category: '매출/수수료', default_type: 'income' }
]

export function readLocal(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getTransactions() {
  return readLocal(TX_KEY, [])
}

export function saveTransactions(rows) {
  writeLocal(TX_KEY, rows)
}

export function getDocuments() {
  return readLocal(DOC_KEY, [])
}

export function saveDocuments(rows) {
  writeLocal(DOC_KEY, rows)
}

export function getRules() {
  const rows = readLocal(RULE_KEY, null)
  if (!rows) {
    writeLocal(RULE_KEY, defaultRules)
    return defaultRules
  }
  return rows
}

export function saveRules(rows) {
  writeLocal(RULE_KEY, rows)
}
