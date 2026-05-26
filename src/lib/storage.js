const TX_KEY = 'mm_transactions_v3'
const DOC_KEY = 'mm_documents_v3'
const RULE_KEY = 'mm_rules_v3'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getTransactions() {
  return read(TX_KEY, [])
}

export function saveTransactions(rows) {
  save(TX_KEY, rows)
}

export function getDocuments() {
  return read(DOC_KEY, [])
}

export function saveDocuments(rows) {
  save(DOC_KEY, rows)
}

export function getRules() {
  return read(RULE_KEY, [
    { id: 'r1', vendor_keyword: '우체국', default_category: '배송비', default_type: 'expense', memo: '' },
    { id: 'r2', vendor_keyword: 'SUPER', default_category: '상품매입', default_type: 'expense', memo: '' },
    { id: 'r3', vendor_keyword: '네이버', default_category: '매출', default_type: 'income', memo: '' }
  ])
}

export function saveRules(rows) {
  save(RULE_KEY, rows)
}
