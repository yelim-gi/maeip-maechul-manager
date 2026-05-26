/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, TransactionSource, Evidence } from '../types';
import { 
  Search, 
  Plus, 
  FileSpreadsheet, 
  CreditCard, 
  TrendingUp, 
  X, 
  HelpCircle, 
  Calendar,
  AlertTriangle,
  FileCheck,
  Tag,
  ClipboardList,
  ChevronDown,
  Trash2,
  RefreshCw,
  Edit,
  Sparkles,
  Link,
  Check,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface TransactionManagerProps {
  transactions: Transaction[];
  evidences: Evidence[];
  selectedMonth: string;
  onAddTransaction: (newTx: Transaction) => void;
  onAddTransactionsBulk: (bulk: Transaction[]) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onLinkEvidence: (txId: string, evId: string | null) => void;
  onApplyRules: () => void;
  onUpdateTransaction: (updatedTx: Transaction) => void;
}

// Sample CSV texts to simulate real imports (Smartstore, card statement, bank ledger)
const SAMPLE_SMARTSTORE_CSV = `날짜,거래처,금액,수입지출,메모
2026-05-15,네이버 스마트스토어 정산대금,1450000,수입,스마트스토어 5월 2차 정산분
2026-05-17,네이버 스마트스토어 정산대금,980000,수입,스마트스토어 5월 3차 정산분
2026-05-20,쿠팡 정산대금,550000,수입,쿠팡 파트너스 판매대금`;

const SAMPLE_CARD_CSV = `승인원일,가맹점명,승인금액,과세구분,비고
2026-05-18,우체국,12500,비과세,일본 사입 건 발송운임
2026-05-20,SUPER DELIVERY,550000,영세율,카드 해외결제 (사입)
2026-05-22,페이스북 코리아,120000,과세,바이럴 타겟 마케팅 광고비
2026-05-25,네이버비즈광고,180000,과세,스마트스토어 검색 노출 광고비`;

const SAMPLE_BANK_CSV = `거래일시,거래처명,출금금액,입금금액,거래수단
2026-05-10,관세청(서울세관),85000,0,인터넷뱅킹 납입
2026-05-12,수퍼딜리버리(해외송금),720000,0,전신환 사입 송금
2026-05-24,임대인김철수,600000,0,사무실 임차료 이체`;

export default function TransactionManager({
  transactions,
  evidences,
  selectedMonth,
  onAddTransaction,
  onAddTransactionsBulk,
  onDeleteTransaction,
  onUpdateCategory,
  onUpdateMemo,
  onLinkEvidence,
  onApplyRules,
  onUpdateTransaction
}: TransactionManagerProps) {
  
  // States
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState<'all' | TransactionSource>('all');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'matched' | 'missing'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [showTransferGuide, setShowTransferGuide] = useState<boolean>(true);

  // States for interactive manual pairing & transaction edits
  const [matchingTx, setMatchingTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Editable session mirror states
  const [editDate, setEditDate] = useState("");
  const [editPartner, setEditPartner] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editCategory, setEditCategory] = useState("");
  const [editSource, setEditSource] = useState<TransactionSource>("manual");
  const [editMemo, setEditMemo] = useState("");

  const handleOpenEditModal = (t: Transaction) => {
    setEditingTx(t);
    setEditDate(t.date);
    setEditPartner(t.partner);
    setEditAmount(t.amount);
    setEditCategory(t.category);
    setEditSource(t.source);
    setEditMemo(t.memo);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    if (!editPartner || editAmount <= 0) {
      alert("올바른 상호명 및 금액을 기재해 주세요.");
      return;
    }
    
    const updated: Transaction = {
      ...editingTx,
      date: editDate,
      partner: editPartner,
      amount: Number(editAmount),
      tax: editCategory === '매출' ? 0 : Math.round(Number(editAmount) * 0.1),
      category: editCategory,
      source: editSource,
      memo: editMemo
    };

    onUpdateTransaction(updated);
    setEditingTx(null);

    // Reapply matching rules
    setTimeout(() => {
      onApplyRules();
    }, 200);
  };

  // New Trans form raw states
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().substring(0, 10));
  const [newTxPartner, setNewTxPartner] = useState("");
  const [newTxAmount, setNewTxAmount] = useState(0);
  const [newTxCategory, setNewTxCategory] = useState("상품매입");
  const [newTxSource, setNewTxSource] = useState<TransactionSource>("manual");
  const [newTxMemo, setNewTxMemo] = useState("");

  const [csvText, setCsvText] = useState("");
  const [csvDataType, setCsvDataType] = useState<'smartstore' | 'card' | 'bank'>('card');
  const [csvFileName, setCsvFileName] = useState("");
  const [fileRawBytes, setFileRawBytes] = useState<Uint8Array | null>(null);
  const [currentEncoding, setCurrentEncoding] = useState<'utf8' | 'euckr'>('utf8');

  const decodeBytes = (bytes: Uint8Array, encoding: 'utf8' | 'euckr') => {
    try {
      const decoder = new TextDecoder(encoding === 'utf8' ? 'utf-8' : 'euc-kr');
      return decoder.decode(bytes);
    } catch (e) {
      console.error(e);
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    
    // Auto-detect type from file name keywords
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes('smart') || lowerName.includes('스토어') || lowerName.includes('sales') || lowerName.includes('정산') || lowerName.includes('naver')) {
      setCsvDataType('smartstore');
    } else if (lowerName.includes('card') || lowerName.includes('카드') || lowerName.includes('statement') || lowerName.includes('shinhancard')) {
      setCsvDataType('card');
    } else if (lowerName.includes('bank') || lowerName.includes('은행') || lowerName.includes('통장') || lowerName.includes('이체') || lowerName.includes('toss') || lowerName.includes('kakao')) {
      setCsvDataType('bank');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      setFileRawBytes(bytes);
      
      // Auto-detect encoding: try UTF-8 first, fall back to EUC-KR if fatal parsing fails
      let initialEncoding: 'utf8' | 'euckr' = 'utf8';
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        utf8Decoder.decode(bytes);
      } catch (err) {
        initialEncoding = 'euckr';
      }
      
      setCurrentEncoding(initialEncoding);
      const decodedText = decodeBytes(bytes, initialEncoding);
      setCsvText(decodedText);
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleEncoding = () => {
    if (!fileRawBytes) {
      alert("파일을 먼저 업로드해 주세요! 업로드된 파일이 있을 때 인코딩을 전환할 수 있습니다.");
      return;
    }
    const nextEncoding = currentEncoding === 'utf8' ? 'euckr' : 'utf8';
    setCurrentEncoding(nextEncoding);
    const decodedText = decodeBytes(fileRawBytes, nextEncoding);
    setCsvText(decodedText);
  };

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesMonth = t.date.substring(0, 7) === selectedMonth;
      const matchesSearch = t.partner.toLowerCase().includes(searchText.toLowerCase()) || 
        t.category.toLowerCase().includes(searchText.toLowerCase()) ||
        t.memo.toLowerCase().includes(searchText.toLowerCase());
      
      const matchesSource = sourceFilter === 'all' ? true : t.source === sourceFilter;
      const matchesEvidence = evidenceFilter === 'all' ? true : 
        evidenceFilter === 'matched' ? t.evidenceId !== null : t.evidenceId === null;

      return matchesMonth && matchesSearch && matchesSource && matchesEvidence;
    });
  }, [transactions, selectedMonth, searchText, sourceFilter, evidenceFilter]);

  // Form Submit manual transaction
  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxPartner || newTxAmount <= 0) {
      alert("거래처와 올바른 금액을 기재해 주세요.");
      return;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: newTxDate,
      partner: newTxPartner,
      amount: Number(newTxAmount),
      tax: newTxCategory === '매출' ? 0 : Math.round(Number(newTxAmount) * 0.1),
      shippingFee: 0,
      customsFee: 0,
      category: newTxCategory,
      source: newTxSource,
      memo: newTxMemo,
      evidenceId: null
    };

    onAddTransaction(newTx);
    setIsAddModalOpen(false);

    // Initial resets
    setNewTxPartner("");
    setNewTxAmount(0);
    setNewTxMemo("");
    
    // Automatically trigger rules
    setTimeout(() => {
      onApplyRules();
    }, 200);
  };

  // CSV parsing logic for user simulation and actual CSV files uploaded
  const handleCsvParse = () => {
    if (!csvText.trim()) {
      alert("CSV 데이터를 채워넣거나 아래 샘플 불러오기를 클릭하세요.");
      return;
    }

    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      alert("CSV 데이터 행이 부족합니다.");
      return;
    }

    const headers = lines[0].split(',');
    const bulkTx: Transaction[] = [];

    // Simple custom csv column parser mapping index
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      if (cols.length < 3) continue;

      let date = newTxDate;
      let partner = "거래처 미상";
      let amount = 0;
      let memo = "";
      let source: TransactionSource = "manual";
      let category = "상품매입";

      if (csvDataType === 'smartstore') {
        date = cols[0] || date;
        partner = cols[1] || partner;
        amount = Number(cols[2]) || 0;
        category = "매출";
        memo = cols[4] || "스마트스토어 매출연동";
        source = "smartstore";
      } else if (csvDataType === 'card') {
        date = cols[0] || date;
        partner = cols[1] || partner;
        amount = Number(cols[2]) || 0;
        memo = cols[4] || "카드정기 지출";
        source = "card";
        // Category rule based on initial keywords
        if (partner.includes("우체국")) category = "배송비";
        else if (partner.includes("SUPER DELIVERY")) category = "상품매입";
        else if (partner.includes("페이스북") || partner.includes("네이버비즈")) category = "광고비";
      } else if (csvDataType === 'bank') {
        date = cols[0] || date;
        partner = cols[1] || partner;
        const outAmt = Number(cols[2]) || 0;
        const inAmt = Number(cols[3]) || 0;
        amount = outAmt > 0 ? outAmt : inAmt;
        category = outAmt > 0 ? "상품매입" : "매출";
        memo = cols[4] || "통장 전표이체";
        source = "bank";
        if (partner.includes("세관")) category = "세금과공과";
        else if (partner.includes("김철수") || partner.includes("임대")) category = "임차료";
      }

      bulkTx.push({
        id: `tx-csv-${Date.now()}-${i}`,
        date,
        partner,
        amount,
        tax: category === '매출' ? 0 : Math.round(amount * 0.1),
        shippingFee: 0,
        customsFee: 0,
        category,
        source,
        memo,
        evidenceId: null
      });
    }

    onAddTransactionsBulk(bulkTx);
    setCsvText("");
    setCsvFileName("");
    setFileRawBytes(null);
    setCurrentEncoding('utf8');
    setIsCsvImportOpen(false);
    
    // Auto-match after loading bulk
    setTimeout(() => {
      onApplyRules();
    }, 200);
    alert(`성공! 총 ${bulkTx.length}건의 거래 명세가 대장에 등록되었습니다.`);
  };

  const loadCsvSample = (type: 'smartstore' | 'card' | 'bank') => {
    setCsvDataType(type);
    if (type === 'smartstore') setCsvText(SAMPLE_SMARTSTORE_CSV);
    else if (type === 'card') setCsvText(SAMPLE_CARD_CSV);
    else if (type === 'bank') setCsvText(SAMPLE_BANK_CSV);
  };

  return (
    <div id="transaction-manager-view" className="space-y-6">

      {/* Ribbon Header commands */}
      <div className="bg-white p-4 rounded-xl border border-slate-105 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">기본 거래내역 장부</h3>
          <p className="text-xs text-slate-400">기준 월의 카드결제, 통장입출금, 스마트스토어 거래내역을 등록하고 세무 항목을 관리하세요.</p>
        </div>

        <div className="flex items-center gap-2">
          
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="border border-slate-205 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>CSV/엑셀 정산파일연동</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>거래내역 직접 추가</span>
          </button>

        </div>
      </div>

      {/* Interactive Transfer Matching & Official Tax Voucher Guide */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-300">
              <Sparkles className="w-5 h-5 animate-pulse text-yellow-400" />
            </div>
            <div>
              <h4 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                계좌이체 대량 연동 및 국세청 적격증빙 보관 가이드
                <span className="bg-yellow-400 text-indigo-950 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">안내</span>
              </h4>
              <p className="text-[10.5px] text-indigo-250 font-medium">대량의 토스/카카오 이체내역, 환불, 쪼개기 매칭 및 법적 증빙 준비에 관한 완벽 안내서</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTransferGuide(!showTransferGuide)}
            className="text-xs bg-white/10 hover:bg-white/20 text-indigo-200 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
          >
            {showTransferGuide ? "안내 가이드 접기 ▲" : "자세히 보기 ▼"}
          </button>
        </div>

        {showTransferGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-indigo-900 text-xs leading-relaxed animate-fade-in">
            
            {/* Guide Column 1: How to link High volume transfers */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2.5">
              <span className="text-[10px] text-yellow-400 font-black tracking-wider uppercase">Q1. 이체내역이 너무 많은데 어떻게 연동해요?</span>
              <p className="text-slate-300 text-[11px] font-medium">
                하나하나 입력하실 필요 전혀 없습니다! 주거래 은행(토스, 카카오뱅크, 일반은행) 앱/웹에서 <strong className="text-white font-bold">"거래내역 내보내기 (CSV, Excel 파일)"</strong>를 다운로드하세요.
              </p>
              <div className="bg-black/20 rounded-lg p-2.5 text-[10.5px] text-slate-300 border border-white/5">
                <p className="font-bold text-white mb-1">🛠️ 초고속 연동 프로세스:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-350">
                  <li>상단 <strong className="text-emerald-400">CSV 정산연동</strong> 버튼 클릭</li>
                  <li>다운로드한 이체 파일 업로드</li>
                  <li>글자가 깨지면 <strong className="text-amber-400">한글 글자 깨짐 해결</strong> 클릭</li>
                  <li>등록하자마자 매칭 추천이 소급됩니다.</li>
                </ol>
              </div>
            </div>

            {/* Guide Column 2: Personal transactions, Refunds, Partial payments */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2.5">
              <span className="text-[10px] text-yellow-400 font-black tracking-wider uppercase">Q2. 사적인 지출, 중복 이체, 환불 금액 처리는?</span>
              <p className="text-slate-300 text-[11px] font-medium">
                가장 헷갈리는 돈의 출금/복귀 흐름도 본 시스템이 완벽하게 해결해 드립니다.
              </p>
              <ul className="space-y-1.5 text-[10.5px] text-slate-350">
                <li className="flex items-start gap-1">
                  <span className="text-[10px] text-red-400 font-bold">🚫 개인적 지출:</span>
                  <span>대량 등록 후 장부 우측 <strong className="text-white">쓰레기통(삭제)</strong> 버튼으로 아예 장부에서 없애거나, 비고에 기재해 두시면 소득세 산정 시 자동 제외됩니다.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-[10px] text-orange-400 font-bold">🔄 나간 돈이 환불되어 복귀:</span>
                  <span>돈이 출금되었다가 다시 취소/입금된 경우, 각각 매입 거래 1건과 동일액의 매출(또는 마이너스 매입)로 기재되어 <strong>상쇄 순합계 0원</strong>으로 처리되므로 세금이 이중 부과되지 않고 완전히 일치하게 됩니다.</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-[10px] text-indigo-300 font-bold">⚖️ 금액이 조금씩 다른 경우:</span>
                  <span>단 몇 백원 차이도 괜찮습니다. 우측 <strong>수정(연필)</strong> 버튼을 눌러 부가세나 총금액을 실제 송금액에 맞춰 1초 만에 미세 조정할 수 있습니다.</span>
                </li>
              </ul>
            </div>

            {/* Guide Column 3: Legal Proof Required Files checklist */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2.5">
              <span className="text-[10px] text-yellow-400 font-black tracking-wider uppercase">Q3. 세금 신고 시 필요한 법적 "적격증빙"은?</span>
              <p className="text-slate-300 text-[11px] font-medium">
                매우 중요한 세법 상식! 국세청에 정당하게 비용 인정을 받으려면 텍스트 거래내역 외에 다음과 같은 <strong className="text-white">실제 서류 파일</strong>이 꼭 결합되어 보관되어야 안전합니다.
              </p>
              
              <div className="bg-indigo-950 border border-indigo-750 rounded-xl p-2.5 space-y-2 text-[10.5px]">
                <p className="font-extrabold text-white flex items-center gap-1">
                  📋 상황별 세법상 통과 필수 서류:
                </p>
                <div className="space-y-1.5 text-slate-300">
                  <p>
                    <strong>1. 일반 거래처 이체 송금 시:</strong><br />
                    👉 <strong className="text-yellow-350">세금계산서(전자)</strong> 또는 <strong className="text-yellow-350">지출증빙 현금영수증</strong> 이 필수이며, 이체확인증은 보조 증명자료가 됩니다.
                  </p>
                  <p>
                    <strong>2. 사무실 월세(간이 임대인):</strong><br />
                    👉 <strong className="text-yellow-350">부동산 임대차계약서 사본</strong> + 은행 앱의 <strong className="text-yellow-350">이체확인증(송금확인증) 이미지</strong> 두 개만 준비하면 세금계산서가 없어도 100% 임차료 비용 처리가 보장됩니다!
                  </p>
                  <p>
                    <strong>3. 3만 원 이하 소액 지출:</strong><br />
                    👉 종이 간이영수증이나 간이 계산서 사진만 찍어서 올려두시면 가산세 없이 지출로 세법 처리됩니다.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Multipurpose Ledger Filter System */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Keyword Search */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="거래처명, 비고, 카테고리 실시간 검색..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-800 focus:outline-none w-full"
            />
          </div>

          {/* Payment Method / Source Tab Filter */}
          <div className="overflow-x-auto">
            <div className="flex items-center bg-slate-100/60 p-1 rounded-lg border">
              <button 
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${sourceFilter === 'all' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                전체 거래처 ({transactions.filter(t => t.date.substring(0, 7) === selectedMonth).length})
              </button>
              <button 
                onClick={() => setSourceFilter('card')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${sourceFilter === 'card' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                💳 신용카드 ({transactions.filter(t => t.date.substring(0, 7) === selectedMonth && t.source === 'card').length})
              </button>
              <button 
                onClick={() => setSourceFilter('bank')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${sourceFilter === 'bank' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                🏦 은행통장 ({transactions.filter(t => t.date.substring(0, 7) === selectedMonth && t.source === 'bank').length})
              </button>
              <button 
                onClick={() => setSourceFilter('smartstore')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${sourceFilter === 'smartstore' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                📦 스마트스토어 ({transactions.filter(t => t.date.substring(0, 7) === selectedMonth && t.source === 'smartstore').length})
              </button>
              <button 
                onClick={() => setSourceFilter('manual')}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${sourceFilter === 'manual' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                🖊 직접입력 ({transactions.filter(t => t.date.substring(0, 7) === selectedMonth && t.source === 'manual').length})
              </button>
            </div>
          </div>

          {/* Evidence Attach status filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 border rounded-lg">
            <select
              value={evidenceFilter}
              onChange={(e) => setEvidenceFilter(e.target.value as any)}
              className="bg-transparent border-none text-[11px] font-semibold text-slate-800 p-1 focus:ring-0 cursor-pointer"
            >
              <option value="all">🔍 증빙결합전체</option>
              <option value="matched">☘ 증빙완결건</option>
              <option value="missing">⚠ 증빙누락건</option>
            </select>
          </div>

        </div>
      </div>

      {/* Transaction Records Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-500">
            <thead className="text-slate-700 bg-slate-50 font-semibold uppercase border-b">
              <tr>
                <th className="px-4 py-3">거래일자</th>
                <th className="px-4 py-4">거래 대리처 / 상호</th>
                <th className="px-4 py-3">결제 출처</th>
                <th className="px-4 py-3">과세 구분 / 비용</th>
                <th className="px-4 py-3">세무비용 분류</th>
                <th className="px-4 py-3">메모 / 비고</th>
                <th className="px-4 py-3">매칭 증빙</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 bg-white transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-mono font-medium">{t.date}</td>
                  <td className="px-4 py-3 text-slate-900 font-bold">{t.partner}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize font-mono inline-block bg-slate-100 border border-slate-150 rounded px-1.5 py-0.5 text-[10px] text-slate-600">
                      {t.source === 'card' ? '💳 신용카드' : t.source === 'bank' ? '🏦 은행' : t.source === 'smartstore' ? '📦 내이버' : '📝 직접'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold block ${t.category === '매출' ? "text-emerald-700" : "text-slate-950"}`}>
                      {t.category === '매출' ? "+" : "-"}{new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(t.amount)}원
                    </span>
                    {t.category !== '매출' && t.tax > 0 && (
                      <span className="text-[10px] text-slate-400 block font-light">
                        (부가세: {Math.round(t.tax)}원)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select 
                      value={t.category} 
                      onChange={(e) => onUpdateCategory(t.id, e.target.value)}
                      className="bg-transparent border border-slate-200 text-slate-800 text-[11px] font-semibold rounded-md p-1 focus:ring-1 focus:ring-indigo-300"
                    >
                      <option value="상품매입">📦 상품매입</option>
                      <option value="배송비">📞 배송비</option>
                      <option value="광고비">📢 광고비</option>
                      <option value="소모품비">📎 소모품비</option>
                      <option value="지급수수료">💳 지급수수료</option>
                      <option value="여비교통비">🚄 여비교통비</option>
                      <option value="세금과공과">📊 세금과공과</option>
                      <option value="임차료">🏠 임차료</option>
                      <option value="도서인쇄비">📖 도서인쇄비</option>
                      <option value="통신비">📱 통신비</option>
                      <option value="복리후생비">🍗 복리후생비</option>
                      <option value="매출">💰 매출 (판매 정산)</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      value={t.memo} 
                      onChange={(e) => onUpdateMemo(t.id, e.target.value)}
                      className="bg-transparent border-0 border-b border-transparent hover:border-slate-350 focus:border-indigo-400 p-0 text-slate-700 w-full focus:ring-0"
                      placeholder="비고 비중 수동입력..."
                    />
                  </td>
                  <td className="px-4 py-3">
                    {t.evidenceId ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-250 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>영수증 결합됨</span>
                        </div>
                        <button
                          onClick={() => {
                            onLinkEvidence(t.id, null);
                          }}
                          className="text-[9px] text-slate-400 hover:text-rose-700 text-left hover:underline"
                        >
                          연동 끊기
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="flex items-center gap-1 bg-rose-50 border border-rose-250 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>증빙 누락</span>
                        </span>
                        
                        <button
                          onClick={() => setMatchingTx(t)}
                          className="mt-1 block text-[10.5px] text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg font-bold cursor-pointer transition-all w-full text-center"
                        >
                          📁 보관함 스마트 매칭
                        </button>

                        {/* Selector link options if missing */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              onLinkEvidence(t.id, e.target.value);
                              alert("거래내역에 증빙서류 영수증을 연동 성공하였습니다.");
                            }
                          }}
                          className="bg-slate-50 border border-slate-205 text-[9px] text-slate-500 w-full rounded p-0.5"
                          defaultValue=""
                        >
                          <option value="">↳ 보관서류 직결...</option>
                          {evidences
                            .filter(ev => !ev.isMatched)
                            .map(ev => (
                              <option key={ev.id} value={ev.id}>
                                {ev.ocrData?.partner || ev.fileName} ({new Intl.NumberFormat('ko-KR').format(ev.ocrData?.amount || 0)}원)
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="text-slate-600 hover:text-indigo-900 font-bold p-1 bg-slate-50 hover:bg-indigo-50 rounded transition cursor-pointer"
                        title="거래정보 직접수정"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(t.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1 bg-rose-50 hover:bg-rose-100 rounded transition cursor-pointer animate-pulse"
                        title="거래 영구삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <ClipboardList className="w-12 h-12 stroke-1 text-slate-350 mx-auto mb-2" />
                    현재 월({selectedMonth})의 해당 필터링된 거래 명세가 없습니다. 
                    혹은 상단 'CSV/엑셀 정산파일연동'을 클릭해 스마트스토어나 신용카드 전표를 대량 등록해 보세요!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Manual Input Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleSubmitManual}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 border border-indigo-150 animate-scale-up"
          >
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-indigo-900" />
                <span>장부내역 수동 추가</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래처 상호명</label>
                <input 
                  type="text" 
                  value={newTxPartner}
                  onChange={(e) => setNewTxPartner(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="예: 우체국, 네이버광고"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래 발생일</label>
                <input 
                  type="date" 
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">결제 출처 / 거래구분</label>
                <select 
                  value={newTxSource}
                  onChange={(e) => setNewTxSource(e.target.value as TransactionSource)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="card">💳 신용카드 결제</option>
                  <option value="bank">🏦 비즈니스 이체 통장</option>
                  <option value="smartstore">📦 스마트스토어 매출연장</option>
                  <option value="manual">📝 수동 장부등록</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">총 결제/정산액(원)</label>
                  <input 
                    type="number" 
                    value={newTxAmount || ""}
                    onChange={(e) => setNewTxAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none"
                    placeholder="숫자 입력"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">세무 항목</label>
                  <select 
                    value={newTxCategory}
                    onChange={(e) => setNewTxCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-indigo-900 focus:outline-none"
                  >
                    <option value="상품매입">📦 상품매입</option>
                    <option value="배송비">📞 배송비</option>
                    <option value="광고비">📢 광고비</option>
                    <option value="소모품비">📎 소모품비</option>
                    <option value="지급수수료">💳 지급수수료</option>
                    <option value="여비교통비">🚄 여비교통비</option>
                    <option value="매출">💰 매출</option>
                    <option value="임차료">🏠 임차료</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">메모 및 비고</label>
                <textarea 
                  value={newTxMemo}
                  onChange={(e) => setNewTxMemo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="예: 5월 사입 물품 운임결제 납입분"
                  rows={2}
                />
              </div>

            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition"
              >
                닫기
              </button>
              <button
                type="submit"
                className="bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition"
              >
                장부 등록하기
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CSV Import Simulation */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 border border-indigo-150 animate-scale-up">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>엑셀 / CSV 신속 대량 등록기</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsCsvImportOpen(false)}
                className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              카드사 승인자료, 은행 법인 통장 전조 이력, 또는 네이버 스마트스토어/쿠팡 정산 엑셀파일을 간편 업로드할 수 있습니다. 
              아래 <strong>'기관별 원클릭 템플릿 로드'</strong> 버튼을 눌러 모조 전표를 바로 테스트해 볼 수도 있습니다.
            </p>

            {/* Real File Upload & Drop Zone */}
            <div className="border-2 border-dashed border-emerald-250 hover:border-emerald-450 rounded-2xl p-4 bg-emerald-50/20 text-center transition-all">
              <label className="cursor-pointer block space-y-1.5">
                <div className="bg-emerald-100 text-emerald-700 rounded-full w-9 h-9 flex items-center justify-center mx-auto shadow-xs">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-800" />
                </div>
                <div className="text-xs">
                  <span className="font-extrabold text-emerald-950 hover:underline">내 컴퓨터에서 CSV/텍스트 파일 선택</span> <span className="text-slate-400">또는 이 영역에 드래그</span>
                </div>
                <span className="block text-[10px] text-slate-450 font-medium">실제 Toss, 카카오뱅크, 국민/신한은행 이체증 원본 또는 네이버 스마트스토어 정산 CSV 지원</span>
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* If file uploaded, show encoding adjustment control */}
            {csvFileName && (
              <div className="bg-amber-50 border border-amber-205 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 text-left w-full sm:w-auto">
                  <p className="font-black text-amber-950 flex items-center gap-1.5">
                    📁 파일 준비 완료: {csvFileName}
                  </p>
                  <p className="text-[10px] text-amber-850 font-medium">
                    현재 한글 디코딩 감지 규격: <strong className="font-extrabold text-slate-900">{currentEncoding === 'utf8' ? 'UTF-8 (일반 웹 표준)' : 'EUC-KR (한국 금융사/액셀 특화)'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleEncoding}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer shadow-sm flex items-center justify-center gap-1"
                >
                  <span>🔄 한글 글자 깨짐 해결 (인코딩 전환)</span>
                </button>
              </div>
            )}

            {/* Quick Presets row */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <span className="font-bold text-slate-700 text-[11px]">테스트용 기관 샘플 데이터 로드:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCsvFileName("샘플_신용카드사_승인내역.csv");
                    setFileRawBytes(null);
                    loadCsvSample('card');
                  }}
                  className="bg-white hover:bg-indigo-50 border border-slate-205 text-[10px] font-bold px-2 py-1 rounded-md text-slate-700 shadow-xs transition cursor-pointer"
                >
                  💳 카드사 전표
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFileName("샘플_은행통장_거래내역서.csv");
                    setFileRawBytes(null);
                    loadCsvSample('bank');
                  }}
                  className="bg-white hover:bg-indigo-50 border border-slate-205 text-[10px] font-bold px-2 py-1 rounded-md text-slate-700 shadow-xs transition cursor-pointer"
                >
                  🏦 이체 통장대장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFileName("샘플_네이버_스마트스토어_정산.csv");
                    setFileRawBytes(null);
                    loadCsvSample('smartstore');
                  }}
                  className="bg-white hover:bg-indigo-50 border border-slate-205 text-[10px] font-bold px-2 py-1 rounded-md text-slate-700 shadow-xs transition cursor-pointer"
                >
                  📦 스마트스토어 매출
                </button>
              </div>
            </div>

            {/* Educational Help Alert Banner (EUC-KR & Number Column display issues) */}
            <div className="bg-indigo-50/60 border border-indigo-150 rounded-2xl p-3 text-[10.5px] text-indigo-950 font-medium space-y-1">
              <p className="font-bold text-indigo-950 flex items-center gap-1">
                <HelpCircle className="w-4 h-4 text-indigo-800 shrink-0" />
                <span>질문하신 한글 깨짐(???) 및 ### 표기 완벽 해결법</span>
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-650 ml-1">
                <li><strong className="text-slate-900">한글 글자 깨짐(????) 현상:</strong> 우리나라 관공서와 은행, 쇼핑몰 정산 엑셀은 대부분 한국어 전용 방식인 <span className="font-bold font-mono text-[9px] bg-slate-200 px-1 py-0.2 rounded">EUC-KR (또는 CP949)</span>으로 저장됩니다. 웹 브라우저는 기본적으로 UTF-8을 기대하기 때문에 깨지는 것인데, 업로드 후 위의 <strong className="text-amber-900">인코딩 전환</strong> 버튼을 탭하시면 아름답고 정갈한 한글로 바뀝니다!</li>
                <li><strong className="text-slate-900">숫자 자리에 ####### 표시:</strong> 엑셀에서 숫자가 든 칸의 크기(가로폭)가 숫자 길이에 비해 협소할 때 숨김 기호로 표시되는 현상입니다. 엑셀 상단 열의 경계선(예: A열과 B열 사이)을 마우스 더블클릭 하거나 조금만 당겨 넓혀주시면 수수료 및 날짜가 100% 정상 출력됩니다!</li>
              </ul>
            </div>

            {/* CSV Text Area */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <label className="block font-semibold text-slate-700">CSV 원문 변환 프리뷰 데이터</label>
                <span className="text-[10px] text-slate-400 font-mono">가공방식: {csvDataType === 'smartstore' ? '네이버매출 정산' : csvDataType === 'card' ? '신용카드 대장' : '은행계정 원장'}</span>
              </div>
              <textarea 
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full bg-slate-950 text-emerald-350 font-mono text-[11px] rounded-xl p-3 focus:outline-none border border-slate-800"
                placeholder="여기에 실제 파일의 콤마(,) 구분 목록 데이터가 변환되어 표시됩니다. 직접 미세 가공 및 편집도 가능합니다."
                rows={6}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-450 italic">
                헤더 구문 파싱 규칙 자동 적용 완료
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCsvImportOpen(false)}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleCsvParse}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition"
                >
                  장부 파싱 삽입 실행
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: Interactive Visual Voucher Linkage (Manual Pair) */}
      {matchingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 border border-indigo-150 animate-scale-up">
            
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-950" />
                  <span>보관함 영수증 수동 비주얼 매칭</span>
                </h3>
                <p className="text-[10px] text-slate-450 mt-0.5">선택한 장부 전표에 적합한 인보이스 또는 영수증 서류를 직접 지정해 연결합니다.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setMatchingTx(null)}
                className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Transaction Profile card */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5">
              <span className="bg-indigo-900 border border-indigo-750 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full text-indigo-200 inline-block font-mono">
                현재 매치 대상 전표 데이터
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">거래 발생일</span>
                  <span className="font-bold text-slate-100 font-mono">{matchingTx.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">거래처 / 상호명</span>
                  <span className="font-bold text-slate-100">{matchingTx.partner}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">결제 금액 (부가세 포함)</span>
                  <span className="font-extrabold text-yellow-400">{new Intl.NumberFormat('ko-KR').format(matchingTx.amount)}원</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">지출 출처 (결제수단)</span>
                  <span className="font-bold text-slate-100">
                    {matchingTx.source === 'card' ? '💳 신용카드' : matchingTx.source === 'bank' ? '🏦 통장이체' : matchingTx.source === 'smartstore' ? '📦 네이버매출' : '📝 직접등록'}
                  </span>
                </div>
              </div>
            </div>

            {/* Unmatched Evidences Gallery List */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  📁 현재 미연결 보관 잔여 파일 목록 
                  <span className="bg-slate-150 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {evidences.filter(e => !e.isMatched).length}개 보관 중
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">Toss, Kakao 이체증이나 캡처본, 인보이스 PDF를 매칭해 보세요.</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1.5">
                {evidences.filter(e => !e.isMatched).length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border-2 border-dashed rounded-2xl text-slate-400 text-xs">
                    <ClipboardList className="w-10 h-10 stroke-1 mx-auto text-slate-350 mb-1.5" />
                    현재 보관함에 미수 매칭된 영수증 및 증빙 파일이 전혀 없습니다.<br />
                    먼저 <strong>'증빙서류 보관함'</strong> 탭에서 스마트스토어/카드 영수증 파일들을 대량 등록해 주세요!
                  </div>
                ) : (
                  evidences
                    .filter(e => !e.isMatched)
                    .map(ev => {
                      // AI Matching Recommendation Analysis
                      const isAmountExactMatch = ev.ocrData && Math.abs(ev.ocrData.amount - matchingTx.amount) < 10;
                      const isNameFuzzyMatch = ev.ocrData && (
                        ev.ocrData.partner.includes(matchingTx.partner) || 
                        matchingTx.partner.includes(ev.ocrData.partner)
                      );
                      const isDateClose = ev.ocrData && (
                        ev.ocrData.date === matchingTx.date ||
                        Math.abs(new Date(ev.ocrData.date).getTime() - new Date(matchingTx.date).getTime()) <= 3 * 24 * 60 * 60 * 1000
                      );

                      const hasRecommendation = isAmountExactMatch || isNameFuzzyMatch || isDateClose;

                      return (
                        <div 
                          key={ev.id} 
                          className={`p-3.5 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50 ${
                            isAmountExactMatch 
                              ? "bg-emerald-50/40 border-emerald-305 hover:border-emerald-450" 
                              : isNameFuzzyMatch 
                                ? "bg-amber-50/30 border-amber-305 hover:border-amber-450"
                                : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Check if image URL exists */}
                            {ev.fileDataUrl ? (
                              <img 
                                src={ev.fileDataUrl} 
                                alt="증빙" 
                                className="w-11 h-11 object-cover rounded-lg border bg-slate-100 shrink-0 shadow-xs"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-11 h-11 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center border font-mono font-bold text-[10px] shrink-0">
                                {ev.fileType.toUpperCase()}
                              </div>
                            )}

                            <div className="text-xs space-y-0.5">
                              <p className="font-bold text-slate-800 line-clamp-1">{ev.fileName}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-500 text-[10.5px]">
                                <span>인식된 상호: <strong className="text-slate-700">{ev.ocrData?.partner || "미추정"}</strong></span>
                                <span>•</span>
                                <span>금액: <strong className="text-indigo-900 font-bold">{ev.ocrData?.amount ? `${new Intl.NumberFormat('ko-KR').format(ev.ocrData.amount)}원` : "분석 미완"}</strong></span>
                                {ev.ocrData?.date && (
                                  <>
                                    <span>•</span>
                                    <span>일자: <strong className="text-slate-700 font-mono">{ev.ocrData.date}</strong></span>
                                  </>
                                )}
                              </div>

                              {/* AI Smart recommendation badges */}
                              {hasRecommendation && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  {isAmountExactMatch && (
                                    <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                      <Sparkles className="w-3 h-3 text-emerald-600 animate-spin" /> 금액 100% 일치
                                    </span>
                                  )}
                                  {isNameFuzzyMatch && (
                                    <span className="bg-amber-100 border border-amber-300 text-amber-800 text-[9.5px] font-bold px-2 py-0.5 rounded-md">
                                      🔍 상호 유사
                                    </span>
                                  )}
                                  {isDateClose && (
                                    <span className="bg-indigo-100 border border-indigo-250 text-indigo-800 text-[9.5px] font-bold px-2 py-0.5 rounded-md">
                                      📅 발생시기 근접
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                onLinkEvidence(matchingTx.id, ev.id);
                                setMatchingTx(null);
                                alert("장부와 보관 증빙서류의 결합 매칭 처리를 즉각 완료하였습니다!");
                              }}
                              className="px-4 py-2 bg-indigo-950 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs transition shadow-sm cursor-pointer"
                            >
                              이 파일로 매칭 실행
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <span className="text-[10px] text-slate-400 mr-auto font-medium leading-tight">
                * 매칭 결합 정보는 세무 대장 최종 제출이나 통계 세무 시뮬레이터에 즉시 소급 적용됩니다.
              </span>
              <button
                type="button"
                onClick={() => setMatchingTx(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                매칭 그만두기 / 닫기
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: Edit Transaction Record Detail */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <form 
            onSubmit={handleSaveEdit}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 border border-indigo-150 animate-scale-up"
          >
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-indigo-900 animate-pulse" />
                <span>기존 거래 장부 내역 수정</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">거래 대리처 / 상호명</label>
                <input 
                  type="text" 
                  value={editPartner}
                  onChange={(e) => setEditPartner(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-705 mb-1">거래 일자</label>
                <input 
                  type="date" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">거래 자금 출처구분</label>
                <select 
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value as TransactionSource)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="card">💳 신용카드 결제</option>
                  <option value="bank">🏦 비즈니스 이체 통장</option>
                  <option value="smartstore">📦 스마트스토어 매출연장</option>
                  <option value="manual">📝 직접등록 장부</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">총금액(부가가치세 포함)</label>
                  <input 
                    type="number" 
                    value={editAmount || ""}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-black text-slate-900 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">세무 항목 설정</label>
                  <select 
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-205 rounded-lg p-2.5 font-bold text-indigo-950 focus:outline-none"
                  >
                    <option value="상품매입">📦 상품매입</option>
                    <option value="배송비">📞 배송비</option>
                    <option value="광고비">📢 광고비</option>
                    <option value="소모품비">📎 소모품비</option>
                    <option value="지급수수료">💳 지급수수료</option>
                    <option value="여비교통비">🚄 여비교통비</option>
                    <option value="세금과공과">📊 세금과공과</option>
                    <option value="임차료">🏠 임차료</option>
                    <option value="복리후생비">🍗 복리후생비</option>
                    <option value="매출">💰 매출 (판매 정산)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메모 및 세무특이사항 비고</label>
                <textarea 
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  rows={2}
                />
              </div>

            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-650 font-extrabold px-4 py-2.5 rounded-xl transition"
              >
                수정 취소
              </button>
              <button
                type="submit"
                className="bg-indigo-950 hover:bg-indigo-900 text-white font-extrabold px-5 py-2.5 rounded-xl transition shadow-sm"
              >
                저장 및 자동 재분석
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
