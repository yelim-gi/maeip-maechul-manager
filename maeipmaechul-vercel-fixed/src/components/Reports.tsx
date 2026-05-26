/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Transaction, Evidence } from '../types';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  FileCheck, 
  TrendingUp, 
  TrendingDown, 
  Layers,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
  evidences: Evidence[];
  selectedMonth: string;
}

export default function Reports({
  transactions,
  evidences,
  selectedMonth
}: ReportsProps) {

  // Current month's records
  const monthlyTransactions = useMemo(() => {
    return transactions
      .filter(t => t.date.substring(0, 7) === selectedMonth)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, selectedMonth]);

  // Calculations
  const stats = useMemo(() => {
    let totalSales = 0;
    let totalExpenses = 0;
    let totalTax = 0;
    let totalShipping = 0;
    let totalCustoms = 0;
    let matchedCount = 0;
    let missingCount = 0;

    monthlyTransactions.forEach(t => {
      if (t.category === '매출') {
        totalSales += t.amount;
      } else {
        totalExpenses += t.amount;
        totalTax += t.tax;
        totalShipping += t.shippingFee;
        totalCustoms += t.customsFee;
        
        if (t.evidenceId) {
          matchedCount++;
        } else {
          missingCount++;
        }
      }
    });

    return {
      totalSales,
      totalExpenses,
      totalTax,
      totalShipping,
      totalCustoms,
      matchedCount,
      missingCount,
      netProfit: totalSales - totalExpenses
    };
  }, [monthlyTransactions]);

  // Categorized details
  const categorySummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    monthlyTransactions.forEach(t => {
      summary[t.category] = (summary[t.category] || 0) + t.amount;
    });
    return Object.keys(summary).map(cat => ({
      category: cat,
      amount: summary[cat]
    })).sort((a, b) => b.amount - a.amount);
  }, [monthlyTransactions]);

  const handlePrint = () => {
    window.print();
  };

  // Direct CSV Generation with UTF-8 BOM (\uFEFF) for perfect Korean display in Excel
  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // BOM characters to force Excel decode Korean in UTF-8
    
    // Title Section
    csvContent += `[세무대리인 제출용] 개인사업자 매입매출 증빙검토 대장 (${selectedMonth})\n`;
    csvContent += `발생기간,${selectedMonth}-01 ~ ${selectedMonth}-31\n`;
    csvContent += `출력일자,${new Date().toISOString().substring(0, 10)}\n\n`;

    // Summary sheet
    csvContent += "=== 월별 재무 및 부가세 공제 요약 ===\n";
    csvContent += `구분,금액,내역 수\n`;
    csvContent += `총 매출액 (정산대금 수입),${stats.totalSales}원,${monthlyTransactions.filter(t=>t.category==='매출').length}건\n`;
    csvContent += `총 비용/매입액 (지출비합),${stats.totalExpenses}원,${monthlyTransactions.filter(t=>t.category!=='매출').length}건\n`;
    csvContent += `예상 과세대상 순소득,${stats.netProfit}원\n`;
    csvContent += `세금(공제대상 부가세추정),${stats.totalTax}원\n`;
    csvContent += `증빙 정상결합 완료,${stats.matchedCount}건\n`;
    csvContent += `증빙 유실/추정누락,${stats.missingCount}건\n\n`;

    // Category breakdown
    csvContent += "=== 카테고리별 세무 비용 현황 ===\n";
    csvContent += "계정과목,금액\n";
    categorySummary.forEach(item => {
      csvContent += `${item.category},${item.amount}원\n`;
    });
    csvContent += "\n";

    // Itemized Ledger list sheet
    csvContent += "=== 세부 거래 내역 원장 (영수증 일치 상태 포함) ===\n";
    csvContent += "거래일자,가맹점/거래처명,지출구분,금액,부가세,메모,증빙상태,매칭문서파일명\n";
    
    monthlyTransactions.forEach(t => {
      const linkedFile = t.evidenceId ? (evidences.find(e => e.id === t.evidenceId)?.fileName || "서류등록됨") : "없음(누락)";
      const isMatchedText = t.evidenceId ? "완료" : "미증빙";
      csvContent += `${t.date},${t.partner.replace(/,/g, '')},${t.category},${t.amount},${t.tax},${t.memo.replace(/,/g, '')},${isMatchedText},${linkedFile}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `세무사제출용_매입매출대장_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatKRW = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
  };

  return (
    <div id="reports-view" className="space-y-6">

      {/* Button controls card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-850 text-lg">새 보고서 생성 및 내보내기</h3>
          <p className="text-xs text-slate-500">
            {selectedMonth.substring(0, 4)}년 {selectedMonth.substring(5, 7)}월 세무용 매입원장 준비가 완료되었습니다. 한 번의 클릭으로 엑셀 또는 인쇄본을 뽑으십시오.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4 text-indigo-900" />
            <span>장부 종이인쇄 / PDF 저장</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow transition-all"
          >
            <Download className="w-4 h-4" />
            <span>세무대리인 제출용 엑셀 다운로드 (BOM-CSV)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet View: Visual beauty like a standard sheet */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 max-w-4xl mx-auto printable-area">
        
        {/* Header letter-head */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">매입·매출 증빙 확인 원장</h1>
            <span className="text-xs font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-150 inline-block mt-1">
              신고 기준월: {selectedMonth.substring(0, 4)}년 {selectedMonth.substring(5, 7)}월분
            </span>
          </div>

          <div className="text-right text-xs text-slate-500 space-y-1 font-medium sm:block hidden">
            <p>상호: 사업장 자영업 대장</p>
            <p>작성일: {new Date().toISOString().substring(0, 10)}</p>
            <p>검토자: {localStorage.getItem('userEmail') || "qzwxec88888@gmail.com"}</p>
          </div>
        </div>

        {/* Aggregate statistics brief row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          
          <div className="border border-slate-150 p-4 rounded-xl space-y-1 bg-slate-50">
            <span className="text-slate-400 font-bold tracking-wide block">총 매출 (수입계)</span>
            <strong className="text-lg text-emerald-700 block font-bold font-mono">{formatKRW(stats.totalSales)}</strong>
            <p className="text-[10px] text-slate-400">네이버 스마트스토어 등 정산금액 합계</p>
          </div>

          <div className="border border-slate-150 p-4 rounded-xl space-y-1 bg-slate-50">
            <span className="text-slate-400 font-bold block tracking-wide">총 비용 (매입 소계)</span>
            <strong className="text-lg text-slate-900 block font-bold font-mono">{formatKRW(stats.totalExpenses)}</strong>
            <p className="text-[10px] text-slate-400">부가세 공제대상 예상 항목: {formatKRW(stats.totalTax)}</p>
          </div>

          <div className="border border-slate-150 p-4 rounded-xl space-y-1 bg-slate-50">
            <span className="text-slate-410 font-bold tracking-wide block">검토 이익 (종합 순익)</span>
            <strong className="text-lg text-blue-900 block font-bold font-mono">{formatKRW(stats.netProfit)}</strong>
            <p className="text-[10px] text-slate-400">증빙 일치 완료 건수: {stats.matchedCount}건 / 누락 {stats.missingCount}건</p>
          </div>

        </div>

        {/* Specific tax category details list */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 text-sm">1. 비용 항목별 합산 명세 (세무신고 과목별)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categorySummary.map(item => (
              <div key={item.category} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs">
                <span className="text-slate-400 block font-medium">{item.category}</span>
                <strong className="text-slate-800 font-bold">{formatKRW(item.amount)}</strong>
              </div>
            ))}
            {categorySummary.length === 0 && (
              <p className="col-span-4 text-center text-xs text-slate-400 py-4">이번 달 지출 기록이 존재하지 않습니다.</p>
            )}
          </div>
        </div>

        {/* Ledger detailed lists table */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 text-sm">2. 거래원장 명세서 원본 (세금계산서/영수증 확인용)</h4>
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <table className="w-full text-left text-[10px] text-slate-500">
              <thead className="bg-slate-900 text-white font-bold text-[11px]">
                <tr>
                  <th className="px-3 py-2.5">거래일</th>
                  <th className="px-3 py-2.5">거래처 상호</th>
                  <th className="px-3 py-2.5">지출구분</th>
                  <th className="px-3 py-2.5">총 금액 (원)</th>
                  <th className="px-3 py-2.5">부가세 (추정)</th>
                  <th className="px-3 py-2.5">비고 및 기록</th>
                  <th className="px-3 py-2.5 text-right">매치 증빙파일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthlyTransactions.map((t, idx) => {
                  const hasFile = !!t.evidenceId;
                  const eName = hasFile ? (evidences.find(ev => ev.id === t.evidenceId)?.fileName || "서류보관") : "미보유 (증빙불가)";
                  
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 font-medium">
                      <td className="px-3 py-2.5 font-mono text-slate-600">{t.date}</td>
                      <td className="px-3 py-2.5 text-slate-900 font-bold">{t.partner}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-bold text-[9px]">{t.category}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-bold font-mono">
                        {new Intl.NumberFormat('ko-KR').format(t.amount)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">
                        {t.category === '매출' ? "-" : `${new Intl.NumberFormat('ko-KR').format(t.tax)}`}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate">{t.memo || "-"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold inline-block border rounded px-1.5 py-0.5 text-[9px] ${
                          hasFile ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"
                        }`}>
                          {eName}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {monthlyTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                      신고할 거래 내역이 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Declaratory sign section */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-medium gap-4">
          <p>이 원장은 정식 세무 감사용 인쇄 본이 아닙니다. 자료 제출용 편의 서류로만 쓰십시오.</p>
          <div className="text-right">
            <span className="text-slate-800 font-bold block">작성인: __________________ (인)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
