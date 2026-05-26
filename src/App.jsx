import { useMemo, useState } from 'react'
import {
  LayoutDashboard, Upload, ReceiptText, Link2, FileSpreadsheet,
  Settings, Plus, Download, AlertTriangle, CheckCircle2, Search
} from 'lucide-react'
import {
  categories, currentMonth, exportExcel, formatWon, getMonth, makeSummary,
  normalizeImportedRows, readSpreadsheet, uid, compareAmount
} from './lib/utils'
import {
  getDocuments, getRules, getTransactions, saveDocuments,
  saveRules, saveTransactions
} from './lib/storage'

const navItems = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'upload', label: '업로드 센터', icon: Upload },
  { id: 'transactions', label: '거래내역', icon: ReceiptText },
  { id: 'matching', label: '매칭 검토', icon: Link2 },
  { id: 'reports', label: '보고서', icon: FileSpreadsheet },
  { id: 'settings', label: '설정', icon: Settings }
]

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState(getTransactions())
  const [documents, setDocuments] = useState(getDocuments())
  const [rules, setRules] = useState(getRules())
  const [query, setQuery] = useState('')

  const summary = useMemo(
    () => makeSummary(transactions, documents, month),
    [transactions, documents, month]
  )

  function updateTransactions(rows) {
    setTransactions(rows)
    saveTransactions(rows)
  }

  function updateDocuments(rows) {
    setDocuments(rows)
    saveDocuments(rows)
  }

  function updateRules(rows) {
    setRules(rows)
    saveRules(rows)
  }

  const sharedProps = {
    month,
    setMonth,
    transactions,
    documents,
    rules,
    updateTransactions,
    updateDocuments,
    updateRules,
    query,
    setQuery
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">₩</div>
          <div>
            <h1>매입매출</h1>
            <p>증빙관리 시스템</p>
          </div>
        </div>

        <nav>
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebarHint">
          <b>Gemini 2.5 Flash</b>
          <span>문서 분석은 필요할 때만 실행하세요.</span>
        </div>
      </aside>

      <main>
        <Topbar month={month} setMonth={setMonth} query={query} setQuery={setQuery} />

        {page === 'dashboard' && <Dashboard summary={summary} {...sharedProps} />}
        {page === 'upload' && <UploadCenter {...sharedProps} />}
        {page === 'transactions' && <TransactionsPage {...sharedProps} />}
        {page === 'matching' && <MatchingPage {...sharedProps} />}
        {page === 'reports' && <ReportsPage summary={summary} {...sharedProps} />}
        {page === 'settings' && <SettingsPage {...sharedProps} />}
      </main>
    </div>
  )
}

function Topbar({ month, setMonth, query, setQuery }) {
  return (
    <header className="topbar">
      <div>
        <h2>사업 증빙을 한 곳에서 정리해요</h2>
        <p>거래내역, 명세서, 영수증, 일본어 인보이스까지 월별로 관리합니다.</p>
      </div>
      <div className="topbarActions">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="거래처/메모 검색" />
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
    </header>
  )
}

function Dashboard({ summary, month, transactions, documents }) {
  const monthTx = transactions.filter(t => getMonth(t.transaction_date) === month).slice(0, 8)
  const monthDocs = documents.filter(d => getMonth(d.document_date) === month).slice(0, 6)

  return (
    <section className="page">
      <div className="cards">
        <Metric title="월 매출" value={formatWon(summary.income)} tone="income" />
        <Metric title="월 매입/비용" value={formatWon(summary.expense)} tone="expense" />
        <Metric title="예상 순이익" value={formatWon(summary.profit)} tone={summary.profit >= 0 ? 'income' : 'danger'} />
        <Metric title="증빙 누락" value={`${summary.noEvidence}건`} tone="danger" />
      </div>

      <div className="grid two">
        <div className="panel">
          <div className="panelHead">
            <h3>최근 거래내역</h3>
            <span>{summary.txCount}건</span>
          </div>
          <Table
            headers={['날짜', '거래처', '분류', '금액', '증빙']}
            rows={monthTx.map(t => [
              t.transaction_date,
              t.vendor,
              t.category,
              formatWon(t.amount),
              <Badge status={t.evidence_status} />
            ])}
          />
        </div>

        <div className="panel">
          <div className="panelHead">
            <h3>업로드 증빙</h3>
            <span>{summary.docCount}건</span>
          </div>
          <Table
            headers={['날짜', '거래처', '문서', '총액', '상태']}
            rows={monthDocs.map(d => [
              d.document_date,
              d.vendor,
              d.doc_type,
              formatWon(d.total_amount),
              <Badge status={d.status} />
            ])}
          />
        </div>
      </div>
    </section>
  )
}

function Metric({ title, value, tone }) {
  return (
    <div className={`metric ${tone || ''}`}>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  )
}

function UploadCenter({ transactions, documents, rules, updateTransactions, updateDocuments }) {
  const [rawText, setRawText] = useState('')
  const [fileInfo, setFileInfo] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSheetUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const rows = await readSpreadsheet(file)
    const normalized = normalizeImportedRows(rows, rules)
    updateTransactions([...normalized, ...transactions])
    alert(`${normalized.length}건의 거래내역을 불러왔습니다.`)
    e.target.value = ''
  }

  async function handleDocumentFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setFileInfo({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size
    })
    setAnalysis(null)
    alert(`${file.name} 업로드 완료`)
    e.target.value = ''
  }

  async function analyzeWithGemini() {
    if (!selectedFile && !rawText.trim()) {
      alert('파일을 먼저 업로드하거나 텍스트를 입력해주세요.')
      return
    }

    setLoading(true)
    setAnalysis(null)

    try {
      let body

      if (selectedFile) {
        body = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          base64: await fileToBase64(selectedFile)
        }
      } else {
        body = {
          text: rawText,
          fileName: '직접입력',
          mimeType: 'text/plain'
        }
      }

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '분석 실패')
      }

      setAnalysis(data.result || data)
      alert('Gemini 분석 완료')
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  function saveAnalysis() {
    if (!analysis) return

    const doc = {
      id: uid(),
      file_name: fileInfo?.name || '직접입력 문서',
      file_type: fileInfo?.type || 'text/plain',
      file_url: '',
      doc_type: analysis.documentType || analysis.doc_type || '기타',
      vendor: analysis.vendor || '',
      document_date: analysis.documentDate || analysis.document_date || new Date().toISOString().slice(0, 10),
      total_amount: Number(analysis.totalAmount || analysis.total_amount || 0),
      supply_amount: Number(analysis.subtotal || analysis.supply_amount || 0),
      vat: Number(analysis.vat || 0),
      shipping_fee: Number(analysis.shippingFee || analysis.shipping_fee || 0),
      duty_tax: Number(analysis.customsDuty || analysis.duty_tax || 0),
      currency: analysis.currency || 'KRW',
      exchange_rate: 1,
      extracted_json: analysis,
      status: 'needs_review'
    }

    updateDocuments([doc, ...documents])
    alert('증빙 문서를 저장했습니다.')
  }

  return (
    <section className="page">
      <div className="grid two">
        <div className="panel uploadBox">
          <h3>거래내역 업로드</h3>
          <p>카드, 통장, 스마트스토어 정산내역 CSV/XLSX를 올립니다.</p>
          <label className="fileButton">
            CSV/XLSX 선택
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSheetUpload} hidden />
          </label>
        </div>

        <div className="panel uploadBox">
          <h3>증빙/거래명세서 분석</h3>
          <p>일본어 명세서, 영수증, 인보이스 PDF/이미지를 Gemini 2.5 Flash로 정리합니다.</p>
          <label className="fileButton">
            파일 선택
            <input type="file" accept=".txt,.csv,.pdf,.jpg,.jpeg,.png,.webp" onChange={handleDocumentFile} hidden />
          </label>

          {fileInfo && (
            <div className="fileInfo">
              <b>선택된 파일</b>
              <span>{fileInfo.name}</span>
              <small>{fileInfo.type} / {(fileInfo.size / 1024).toFixed(1)}KB</small>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <h3>문서 텍스트 입력 / OCR 결과 붙여넣기</h3>
          <button className="primary" onClick={analyzeWithGemini} disabled={loading}>
            {loading ? '분석 중...' : 'Gemini 무료 분석'}
          </button>
        </div>
        <textarea
          className="bigText"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="파일 분석이 안 될 때만 텍스트를 붙여넣으세요."
        />
      </div>

      {analysis && (
        <div className="panel">
          <div className="panelHead">
            <h3>분석 결과 검토</h3>
            <button className="primary" onClick={saveAnalysis}>검토 후 저장</button>
          </div>

          <div className="formGrid">
            <Info label="문서종류" value={analysis.documentType || analysis.doc_type} />
            <Info label="거래처" value={analysis.vendor} />
            <Info label="날짜" value={analysis.documentDate || analysis.document_date} />
            <Info label="통화" value={analysis.currency} />
            <Info label="총액" value={formatWon(analysis.totalAmount || analysis.total_amount)} />
            <Info label="부가세" value={formatWon(analysis.vat)} />
            <Info label="배송비" value={formatWon(analysis.shippingFee || analysis.shipping_fee)} />
            <Info label="신뢰도" value={analysis.confidence} />
          </div>

          <pre className="jsonBox">{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}

function TransactionsPage({ month, transactions, updateTransactions, query }) {
  const [form, setForm] = useState({
    type: 'expense',
    transaction_date: new Date().toISOString().slice(0, 10),
    vendor: '',
    title: '',
    category: '확인필요',
    amount: '',
    vat: '',
    payment_method: '',
    evidence_status: 'none',
    memo: ''
  })

  const filtered = transactions.filter(t =>
    getMonth(t.transaction_date) === month &&
    JSON.stringify(t).toLowerCase().includes(query.toLowerCase())
  )

  function addTransaction() {
    if (!form.amount) {
      alert('금액을 입력해주세요.')
      return
    }

    updateTransactions([
      { ...form, id: uid(), amount: Number(form.amount), vat: Number(form.vat || 0) },
      ...transactions
    ])

    setForm({ ...form, vendor: '', title: '', amount: '', vat: '', memo: '' })
  }

  return (
    <section className="page">
      <div className="panel">
        <div className="panelHead">
          <h3>거래 직접 입력</h3>
          <button className="primary" onClick={addTransaction}><Plus size={16} /> 추가</button>
        </div>

        <div className="formGrid">
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="expense">매입/비용</option>
            <option value="income">매출</option>
          </select>
          <input type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
          <input placeholder="거래처" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
          <input placeholder="내용" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="금액" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <input placeholder="부가세" value={form.vat} onChange={e => setForm({ ...form, vat: e.target.value })} />
          <input placeholder="결제수단" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} />
          <select value={form.evidence_status} onChange={e => setForm({ ...form, evidence_status: e.target.value })}>
            <option value="none">증빙없음</option>
            <option value="partial">일부누락</option>
            <option value="done">증빙완료</option>
            <option value="needs_review">확인필요</option>
          </select>
          <input placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <h3>{month} 거래내역</h3>
          <span>{filtered.length}건</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>날짜</th><th>구분</th><th>거래처</th><th>분류</th><th>금액</th><th>증빙</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td>{t.transaction_date}</td>
                <td>{t.type === 'income' ? '매출' : '매입/비용'}</td>
                <td>{t.vendor}</td>
                <td>{t.category}</td>
                <td>{formatWon(t.amount)}</td>
                <td><Badge status={t.evidence_status} /></td>
                <td><button className="ghost" onClick={() => updateTransactions(transactions.filter(x => x.id !== t.id))}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MatchingPage({ month, transactions, documents, updateTransactions, updateDocuments }) {
  const monthTx = transactions.filter(t => getMonth(t.transaction_date) === month)
  const monthDocs = documents.filter(d => getMonth(d.document_date) === month)

  function match(txId, docId) {
    updateTransactions(transactions.map(t =>
      t.id === txId ? { ...t, matched_document_id: docId, evidence_status: 'done' } : t
    ))

    updateDocuments(documents.map(d =>
      d.id === docId ? { ...d, status: 'matched' } : d
    ))
  }

  return (
    <section className="page">
      <div className="panel">
        <div className="panelHead">
          <h3>자동 매칭 후보</h3>
          <p>금액 차이 1,000원 이내, 같은 월 거래를 우선 보여줍니다.</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>거래내역</th><th>증빙 후보</th><th>차액</th><th>상태</th><th></th>
            </tr>
          </thead>
          <tbody>
            {monthTx.map(t => {
              const candidates = monthDocs
                .map(d => ({ d, cmp: compareAmount(t.amount, d.total_amount, 1000) }))
                .sort((a, b) => Math.abs(a.cmp.diff) - Math.abs(b.cmp.diff))

              const best = candidates[0]

              if (!best) {
                return (
                  <tr key={t.id}>
                    <td>{t.transaction_date} / {t.vendor} / {formatWon(t.amount)}</td>
                    <td>후보 없음</td>
                    <td>-</td>
                    <td><Badge status="none" /></td>
                    <td></td>
                  </tr>
                )
              }

              return (
                <tr key={t.id}>
                  <td>{t.transaction_date} / {t.vendor} / {formatWon(t.amount)}</td>
                  <td>{best.d.document_date} / {best.d.vendor} / {formatWon(best.d.total_amount)}</td>
                  <td>{formatWon(Math.abs(best.cmp.diff))}</td>
                  <td>{best.cmp.matched ? <Badge status="matched" /> : <Badge status="needs_review" />}</td>
                  <td><button className="primary small" onClick={() => match(t.id, best.d.id)}>연결</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReportsPage({ month, transactions, documents, summary }) {
  function download() {
    exportExcel(`${month}_매입매출_증빙관리.xlsx`, {
      요약: [{
        월: month,
        매출: summary.income,
        매입비용: summary.expense,
        예상순이익: summary.profit,
        증빙누락건수: summary.noEvidence
      }],
      거래내역: transactions.filter(t => getMonth(t.transaction_date) === month),
      증빙문서: documents.filter(d => getMonth(d.document_date) === month)
    })
  }

  return (
    <section className="page">
      <div className="cards">
        <Metric title="다운로드 대상 월" value={month} />
        <Metric title="거래내역" value={`${summary.txCount}건`} />
        <Metric title="증빙문서" value={`${summary.docCount}건`} />
        <Metric title="예상 순이익" value={formatWon(summary.profit)} />
      </div>

      <div className="panel">
        <div className="empty">
          <FileSpreadsheet size={46} />
          <h3>세무사 제출용 엑셀 다운로드</h3>
          <p>월별 요약, 거래내역, 증빙문서를 한 파일로 내려받습니다.</p>
          <button className="primary" onClick={download}><Download size={16} /> 엑셀 다운로드</button>
        </div>
      </div>

      <div className="panel notice">
        <AlertTriangle size={20} />
        <p>세금 계산은 참고용입니다.</p>
      </div>
    </section>
  )
}

function SettingsPage({ rules, updateRules }) {
  const [form, setForm] = useState({
    vendor_keyword: '',
    default_category: '확인필요',
    default_type: 'expense',
    memo: ''
  })

  function addRule() {
    if (!form.vendor_keyword) return
    updateRules([{ ...form, id: uid() }, ...rules])
    setForm({ vendor_keyword: '', default_category: '확인필요', default_type: 'expense', memo: '' })
  }

  return (
    <section className="page">
      <div className="panel">
        <h3>거래처 자동 분류 규칙</h3>
        <p>한 번 등록하면 업로드 거래내역을 자동 분류할 때 사용합니다.</p>

        <div className="formGrid">
          <input placeholder="거래처 키워드" value={form.vendor_keyword} onChange={e => setForm({ ...form, vendor_keyword: e.target.value })} />
          <select value={form.default_category} onChange={e => setForm({ ...form, default_category: e.target.value })}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={form.default_type} onChange={e => setForm({ ...form, default_type: e.target.value })}>
            <option value="expense">매입/비용</option>
            <option value="income">매출</option>
          </select>
          <input placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
          <button className="primary" onClick={addRule}>규칙 추가</button>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr><th>키워드</th><th>분류</th><th>구분</th><th>메모</th></tr>
          </thead>
          <tbody>
            {rules.map((r, idx) => (
              <tr key={r.id || idx}>
                <td>{r.vendor_keyword}</td>
                <td>{r.default_category}</td>
                <td>{r.default_type === 'income' ? '매출' : '매입/비용'}</td>
                <td>{r.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Table({ headers, rows }) {
  return (
    <table>
      <thead>
        <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((row, idx) => (
          <tr key={idx}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
        )) : (
          <tr><td colSpan={headers.length} className="mutedCell">데이터가 없습니다.</td></tr>
        )}
      </tbody>
    </table>
  )
}

function Badge({ status }) {
  const map = {
    done: ['증빙완료', 'ok'],
    matched: ['매칭완료', 'ok'],
    partial: ['일부누락', 'warn'],
    none: ['증빙없음', 'danger'],
    needs_review: ['확인필요', 'warn'],
    '': ['미확인', 'warn']
  }

  const [label, tone] = map[status] || [status, 'warn']

  return (
    <span className={`badge ${tone}`}>
      {tone === 'ok' ? <CheckCircle2 size={13} /> : null}
      {label}
    </span>
  )
}

function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{String(value ?? '')}</strong>
    </div>
  )
}
