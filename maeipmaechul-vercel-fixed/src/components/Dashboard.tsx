/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Transaction, Evidence } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  AlertTriangle, 
  ArrowUpRight, 
  CheckCircle,
  FileQuestion,
  Calendar,
  Calculator,
  Percent,
  PiggyBank,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  evidences: Evidence[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ 
  transactions, 
  evidences, 
  selectedMonth, 
  setSelectedMonth,
  onNavigate 
}: DashboardProps) {

  // Tax simulator local states
  const [dependents, setDependents] = useState<number>(1); // 본인 포함 가구원 수
  const [hasYellowUmbrella, setHasYellowUmbrella] = useState<boolean>(false); // 노란우산공제 가입 여부
  const [taxPayerType, setTaxPayerType] = useState<'general' | 'simplified'>('general'); // 일반과세 vs 간이과세
  const [showHumanDeductionHelp, setShowHumanDeductionHelp] = useState<boolean>(false); // 인적공제 상세 가이드 보기 여부

  // Detailed dynamic tax estimations based on all cumulative transactions in the ledger
  const taxStats = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    let deductibleExpensesWithEvidence = 0;
    let missingEvidenceExpenses = 0;

    transactions.forEach(t => {
      if (t.category === '매출') {
        sales += t.amount;
      } else {
        expenses += t.amount;
        if (t.evidenceId) {
          deductibleExpensesWithEvidence += t.amount;
        } else {
          missingEvidenceExpenses += t.amount;
        }
      }
    });

    const netProfit = Math.max(0, sales - expenses);

    // 1. VAT (부가가치세) Estimation
    // Output VAT = Sales * 10 / 110 (assumed smartstore sales are tax-inclusive)
    // Input VAT = Deductible Expenses * 10 / 110 (only expense transactions with mapped Evidence block are deductible as input tax!)
    let outputVat = 0;
    let inputVat = 0;
    let estimatedVat = 0;

    if (taxPayerType === 'general') {
      outputVat = Math.round((sales * 10) / 110);
      inputVat = Math.round((deductibleExpensesWithEvidence * 10) / 110);
      estimatedVat = outputVat - inputVat;
    } else {
      // Simplified Taxpayer (간이과세자) - has 1.5% - 4.0% simplified VAT depending on trade, approx 2.0% average of revenue
      estimatedVat = Math.round(sales * 0.02);
    }

    // Potential VAT savings if they upload and link all missing evidences!
    const potentialVatSaving = Math.round((missingEvidenceExpenses * 10) / 110);

    // 2. Comprehensive Income Tax (종합소득세) Estimation
    // Deductions: Basic Personal Deduction (1.5M KRW per dependent)
    const basicPersonalDeduction = dependents * 1500000;
    // Yellow Umbrella (노란우산) - 3,000,000 KRW deduction
    const yellowUmbrellaDeduction = hasYellowUmbrella ? 3000000 : 0;

    const totalDeductions = basicPersonalDeduction + yellowUmbrellaDeduction;
    const taxableBase = Math.max(0, netProfit - totalDeductions);

    // Standard 2026 progressive income tax rate tiers
    let calcIncomeTax = 0;
    let rate = 0;
    let progressiveDeduction = 0;

    if (taxableBase <= 14000000) {
      rate = 6;
      calcIncomeTax = taxableBase * 0.06;
    } else if (taxableBase <= 50000000) {
      rate = 15;
      progressiveDeduction = 1260000;
      calcIncomeTax = taxableBase * 0.15 - 1260000;
    } else if (taxableBase <= 88000000) {
      rate = 24;
      progressiveDeduction = 5760000;
      calcIncomeTax = taxableBase * 0.24 - 5760000;
    } else if (taxableBase <= 150000000) {
      rate = 35;
      progressiveDeduction = 15440000;
      calcIncomeTax = taxableBase * 0.35 - 15440000;
    } else {
      rate = 38;
      progressiveDeduction =progressiveDeduction = 19440000;
      calcIncomeTax = taxableBase * 0.38 - 19440000;
    }

    calcIncomeTax = Math.round(Math.max(0, calcIncomeTax));
    const localIncomeTax = Math.round(calcIncomeTax * 0.1); // 지방소득세 10%
    const totalIncomeTax = calcIncomeTax + localIncomeTax;

    return {
      netProfit,
      outputVat,
      inputVat,
      estimatedVat: Math.max(0, estimatedVat),
      potentialVatSaving,
      basicPersonalDeduction,
      yellowUmbrellaDeduction,
      totalDeductions,
      taxableBase,
      taxRate: rate,
      progressiveDeduction,
      calcIncomeTax,
      localIncomeTax,
      totalIncomeTax
    };
  }, [transactions, dependents, hasYellowUmbrella, taxPayerType]);

  // Get list of all unique months present in transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      if (t.date) {
        months.add(t.date.substring(0, 7)); // 'YYYY-MM'
      }
    });
    // Add current month if empty
    if (months.size === 0) {
      const today = new Date();
      months.add(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // desc
  }, [transactions]);

  // Filtered lists
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.date.substring(0, 7) === selectedMonth);
  }, [transactions, selectedMonth]);

  // Calculations
  const stats = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    let missingEvidenceCount = 0;

    monthlyTransactions.forEach(t => {
      if (t.category === '매출') {
        sales += t.amount;
      } else {
        expenses += t.amount;
        if (!t.evidenceId) {
          missingEvidenceCount++;
        }
      }
    });

    const netProfit = sales - expenses;
    const documentsCount = evidences.filter(e => e.uploadedAt.substring(0, 7) === selectedMonth).length;

    return {
      sales,
      expenses,
      netProfit,
      missingEvidenceCount,
      documentsCount
    };
  }, [monthlyTransactions, evidences, selectedMonth]);

  // Chart 1: Monthly Trend Comparison
  const trendData = useMemo(() => {
    const monthsData: { [key: string]: { sales: number; expenses: number } } = {};
    
    // Aggregate over last 6 months or all
    transactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!monthsData[m]) {
        monthsData[m] = { sales: 0, expenses: 0 };
      }
      if (t.category === '매출') {
        monthsData[m].sales += t.amount;
      } else {
        monthsData[m].expenses += t.amount;
      }
    });

    return Object.keys(monthsData)
      .sort()
      .slice(-6) // last 6 months
      .map(month => ({
        month,
        '매출 (정산)': monthsData[month].sales,
        '매입 (비용)': monthsData[month].expenses,
        '순이익': monthsData[month].sales - monthsData[month].expenses
      }));
  }, [transactions]);

  // Chart 2: Category distribution of expenses (this month)
  const categoryData = useMemo(() => {
    const catMap: { [key: string]: number } = {};
    monthlyTransactions.forEach(t => {
      if (t.category !== '매출') {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      }
    });

    return Object.keys(catMap).map(cat => ({
      name: cat,
      value: catMap[cat]
    }));
  }, [monthlyTransactions]);

  // Colors for expense chart
  const COLORS = ['#1e3a8a', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

  // Alerts: Top high-value transactions with missing evidence
  const missingEvidenceAlerts = useMemo(() => {
    return monthlyTransactions
      .filter(t => t.category !== '매출' && !t.evidenceId)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [monthlyTransactions]);

  // Helper formatting wonkrw
  const formatKRW = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
  };

  return (
    <div id="dashboard-view" className="space-y-6">
      
      {/* Search/Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-900" />
          <span className="font-semibold text-slate-800">조회 기준 월:</span>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 font-medium"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m.substring(0, 4)}년 {m.substring(5, 7)}월</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          실시간 로컬 클라우드 저장 및 AI 분석 지원
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI: 매출 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium tracking-wide">월 매출액</span>
            <h3 className="text-xl font-bold text-slate-800">{formatKRW(stats.sales)}</h3>
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> 스마트스토어/기타 정산 포함
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* KPI: 매입/비용 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium tracking-wide">비용합계 (매입)</span>
            <h3 className="text-xl font-bold text-slate-800">{formatKRW(stats.expenses)}</h3>
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> 카드/송금내역 자동 분류
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl">
            <TrendingDown className="w-6 h-6 text-amber-600" />
          </div>
        </div>

        {/* KPI: 예상 순이익 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium tracking-wide">예상 순이익</span>
            <h3 className={`text-xl font-bold ${stats.netProfit >= 0 ? "text-blue-900" : "text-rose-600"}`}>
              {formatKRW(stats.netProfit)}
            </h3>
            <span className="text-xs text-blue-500 font-semibold">
              이익률: {stats.sales > 0 ? Math.round((stats.netProfit / stats.sales) * 100) : 0}%
            </span>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <DollarSign className="w-6 h-6 text-blue-900" />
          </div>
        </div>

        {/* KPI: 증빙 누락 */}
        <div 
          onClick={() => onNavigate('transactions')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium tracking-wide">증빙 누락 건수</span>
            <h3 className={`text-xl font-bold ${stats.missingEvidenceCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {stats.missingEvidenceCount}건 누락
            </h3>
            <span className="text-xs text-slate-500 font-light underline">
              클릭 시 거래 목록 조회
            </span>
          </div>
          <div className={`p-3 rounded-xl ${stats.missingEvidenceCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
            {stats.missingEvidenceCount > 0 ? (
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            ) : (
              <CheckCircle className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* KPI: 분석된 인보이스 */}
        <div 
          onClick={() => onNavigate('evidence')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium tracking-wide">업로드 증빙문서</span>
            <h3 className="text-xl font-bold text-slate-800">{stats.documentsCount}개</h3>
            <span className="text-xs text-indigo-600 font-semibold">
              AI OCR 실시간 매칭
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl">
            <FileText className="w-6 h-6 text-indigo-900" />
          </div>
        </div>

      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend line / bar chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">최근 매입 및 매출 동향</h3>
            <span className="text-xs text-slate-400">최근 6개월 추이</span>
          </div>
          <div className="h-80 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 10000)}만`} />
                  <Tooltip 
                    formatter={(value: any) => [formatKRW(Number(value)), '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="매출 (정산)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="매입 (비용)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                <FileQuestion className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                차트를 생성할 거래내역이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Expenses category breakdown donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">{selectedMonth.substring(5, 7)}월 비용 항목 분포</h3>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div className="h-56 w-full relative">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatKRW(Number(value)), '']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                  <FileQuestion className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                  이번 달 지출 분류 내역이 없습니다.
                </div>
              )}
            </div>

            {/* Explanatory details legend list */}
            <div className="mt-4 space-y-2 overflow-y-auto max-h-36 pr-1">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="font-medium text-slate-700">{item.name}</span>
                  </div>
                  <div className="font-semibold text-slate-800">
                    {formatKRW(item.value)} ({stats.expenses > 0 ? Math.round((item.value / stats.expenses) * 100) : 0}%)
                  </div>
                </div>
              ))}
              {categoryData.length === 0 && (
                <div className="text-center text-xs text-slate-400">
                  지출 항목이 없습니다. 비용 증빙 카테고리를 설정해 보세요.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Real-time Taxes Estimator & Simulator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-[1px] rounded-3xl shadow-lg border border-slate-800">
        <div className="bg-white p-6 rounded-[23px] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-900 p-2.5 rounded-2xl">
                <Calculator className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-base">실시간 AI 예상 세액 계산기 & 절세 시뮬레이터</h3>
                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-bounce" /> AI 모의 계산기
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">현재까지 누적 대장 데이터 기준 예상 소득세 및 부가세를 산출하고 맞춤 공제액을 조절해 보세요.</p>
              </div>
            </div>
            
            {/* Taxpayer type selectors */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 border rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setTaxPayerType('general')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  taxPayerType === 'general'
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-850"
                }`}
              >
                일반과세자 (10%)
              </button>
              <button
                type="button"
                onClick={() => setTaxPayerType('simplified')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  taxPayerType === 'simplified'
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-850"
                }`}
              >
                간이과세자 (~4%)
              </button>
            </div>
          </div>

          {/* Configuration Inputs & Simulator Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Controls (Column 4) */}
            <div className="lg:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/65 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-indigo-900" />
                <span>종합소득세 소득공제 설정</span>
              </h4>
              
              {/* Dependents Slider/Counter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1">
                    인적 공제 인원 (본인 포함)
                    <button
                      type="button"
                      onClick={() => setShowHumanDeductionHelp(!showHumanDeductionHelp)}
                      className="text-indigo-800 hover:text-indigo-950 transition-all cursor-pointer p-0.5"
                      title="인적공제 상세 보기"
                    >
                      <Info className="w-3.5 h-3.5 inline text-indigo-500" />
                    </button>
                  </span>
                  <span className="text-indigo-900 font-bold">{dependents}명</span>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setDependents(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 bg-white hover:bg-slate-100 border text-slate-700 font-medium rounded-xl text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-white border rounded-xl flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">
                    인적공제: {formatKRW(taxStats.basicPersonalDeduction)}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setDependents(prev => Math.min(10, prev + 1))}
                    className="w-10 h-10 bg-white hover:bg-slate-100 border text-slate-700 font-medium rounded-xl text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-slate-400">1인당 연 150만원 기본 소득 공제 혜택</p>
                  <button
                    type="button"
                    onClick={() => setShowHumanDeductionHelp(!showHumanDeductionHelp)}
                    className="text-[10px] text-indigo-800 hover:underline font-semibold cursor-pointer"
                  >
                    {showHumanDeductionHelp ? "설명 접기 ▲" : "인적공제란? ❓"}
                  </button>
                </div>

                {/* Expanding guidance explaining 인적공제 */}
                {showHumanDeductionHelp && (
                  <div className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-650 leading-relaxed font-medium space-y-1.5 animate-fade-in">
                    <p className="font-bold text-indigo-950 flex items-center gap-1">
                      💡 쉽게 배우는 인적공제 (인적 소득공제)
                    </p>
                    <p>
                      <strong>종합소득세</strong>를 계산할 때, 사업체를 이끌어 나가는 사장님 본인과 생계를 같이하는 <strong>부양가족의 생계비 부담</strong>을 덜어주기 위해 소득액에서 빼 주는 가장 강력한 국가 절세 혜택입니다.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 mt-1 text-[10.5px]">
                      <li><strong className="text-slate-800">공제 한도:</strong> 조건이 충족되는 가족 구성원 <strong>1인당 무려 연간 150만 원</strong>씩 과세 대상 소득에서 통째로 차감됩니다.</li>
                      <li><strong className="text-slate-800">공제 대상:</strong> 주민등록등본상 함께 살며 사장님이 직접 부양하고 있고, 연간 소득금액이 100만 원 이하인 부모(만 60세 이상), 자녀(만 20세 이하), 배우자 등이 대상이 됩니다.</li>
                      <li><strong className="text-slate-800">절세 효과 연동:</strong> 공정액이 늘어날수록 소득세 누진세 구간 세율(6%~38% 등)이 적용되는 금액 베이스 자체가 낮아져, 수십만 원의 소득세 세금을 합법적으로 아낄 수 있습니다.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Yellow Umbrella Accordion / Toggle */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700">
                    <span>노란우산 소기업 소상공인 공제</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={hasYellowUmbrella}
                    onChange={(e) => setHasYellowUmbrella(e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-900 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="bg-white p-3 border rounded-xl text-[11px] text-slate-500 leading-relaxed font-medium shadow-sm">
                  {hasYellowUmbrella ? (
                    <span className="text-emerald-700 font-bold block mb-0.5">✓ 연 300만원 소득 공제 적용 완료!</span>
                  ) : (
                    <span>소상공인 생활안정 지원 공제로 연 소득 금액에 따라 최고 500만원까지 추가 공정 혜택을 줍니다.</span>
                  )}
                </div>
              </div>

              {/* Tax Savings tip box */}
              <div className="bg-indigo-50 border border-indigo-150 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-950">
                  <PiggyBank className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span>AI 절세 핵심 노하우</span>
                </div>
                <p className="text-[10.5px] text-indigo-900/80 leading-normal font-medium">
                  부가가치세는 매칭된 <strong>적격 증빙(영수증 고유 키)</strong>이 있어야만 전액 매입세액공제로 환원되어 세액이 줄어듭니다. 누락된 장부가 있다면 지금 바로 다중 업로드로 보강하세요!
                </p>
              </div>
            </div>

            {/* Calculations display (Column 8) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Display: VAT Card */}
              <div className="border border-slate-200 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-300 transition-all bg-gradient-to-b from-white to-slate-50/40 shadow-sm">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-indigo-950 bg-indigo-50 border border-indigo-150 rounded px-2.5 py-0.5">
                      1. 예상 부가가치세 (VAT)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">과세주기 기준 누적</span>
                  </div>
                  
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>매출 부가세 (예상 매출의 10%)</span>
                      <span className="font-semibold text-slate-700">{formatKRW(taxStats.outputVat)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 pb-1.5 border-b border-dashed">
                      <span>매입 공제세액 (증빙 완료분의 10%)</span>
                      <span className="font-bold text-emerald-600">-{formatKRW(taxStats.inputVat)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2">
                      <span className="text-xs font-bold text-slate-800">최종 납부 예상세액</span>
                      <span className="text-base font-black text-rose-650">{formatKRW(taxStats.estimatedVat)}</span>
                    </div>
                  </div>
                </div>

                {/* Savings Warning */}
                {taxStats.potentialVatSaving > 0 ? (
                  <div className="mt-4 p-2.5 bg-amber-50 border border-amber-150 rounded-xl text-[10.5px] text-amber-900 leading-normal font-medium shadow-sm">
                    <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-bounce" />
                      절세 가능 매입세액 발견!
                    </span>
                    {formatKRW(taxStats.potentialVatSaving)} 상당의 매입세액이 영수증 미비로 공제에서 보류 중입니다. 해당 전표들에 영수증 증빙을 다중 첨부하면 이만큼 즉각 부가세를 감소시킬 수 있습니다.
                  </div>
                ) : (
                  <div className="mt-4 p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[10.5px] text-emerald-800 flex items-center gap-1.5 leading-normal font-medium shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    현재 등록된 모든 매입 전표의 원소 증빙이 결단되어 누락 세액 없이 전면 100% 공제 반영 중입니다.
                  </div>
                )}
              </div>

              {/* Display: Income Tax Card */}
              <div className="border border-slate-200 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-300 transition-all bg-gradient-to-b from-white to-slate-50/40 shadow-sm">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded px-2.5 py-0.5">
                      2. 종합소득세 (기본 지방세 포함)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">장부 기준 누진세율</span>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>총 사업 이익금액</span>
                      <span className="font-semibold text-slate-700">{formatKRW(taxStats.netProfit)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>소득 공제 총합 (인적+노란우산)</span>
                      <span className="font-semibold text-slate-600">-{formatKRW(taxStats.totalDeductions)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>과세 표준 (소득 - 공제)</span>
                      <span className="font-semibold text-slate-700 font-mono">{formatKRW(taxStats.taxableBase)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pb-1.5 border-b border-dashed">
                      <span>적용 세율 구간 (누진세율)</span>
                      <span className="font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-100 rounded px-1">{taxStats.taxRate}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>종합소득세 본세</span>
                      <span className="font-bold text-slate-700">{formatKRW(taxStats.calcIncomeTax)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>개인지방소득세 (소득세의 10%)</span>
                      <span className="font-medium text-slate-600">+{formatKRW(taxStats.localIncomeTax)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-800">최종 세액 합계</span>
                      <span className="text-base font-black text-rose-650">{formatKRW(taxStats.totalIncomeTax)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[10px] text-slate-500 leading-normal font-semibold text-center bg-slate-50 border p-2 rounded-xl">
                  🛡️ 본 세액 계산은 간편장부 모의계산용이며, 실제 가산세나 세액공제 유무에 따라 다소 달라질 수 있습니다.
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Critical Warnings / Missing Evidences Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span>증빙 관리가 우선 필요한 주요 거래 내역 ({selectedMonth.substring(5, 7)}월)</span>
        </h3>
        
        {missingEvidenceAlerts.length > 0 ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-850 text-sm font-medium flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                현재 {selectedMonth.substring(5, 7)}월 지출 내역 중 <strong className="text-amber-900">{stats.missingEvidenceCount}건의 증빙 정보</strong>가 아직 준비되지 않았습니다. 
                금전이 오갔지만 영수증이 매칭되지 않은 고액 지출 항목들을 아래에서 확인하고, 가급적 빠른 시일 내에 매입 세금계산서, 간이영수증, 수입 송장을 등록하셔야 세액 공제를 안전하게 받으실 수 있습니다.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">거래 날짜</th>
                    <th className="px-4 py-3">거래처 (상호)</th>
                    <th className="px-4 py-3">분류</th>
                    <th className="px-4 py-3">지출 금액</th>
                    <th className="px-4 py-3">결제 기관 / 출처</th>
                    <th className="px-4 py-3 text-right">조치</th>
                  </tr>
                </thead>
                <tbody>
                  {missingEvidenceAlerts.map(t => (
                    <tr key={t.id} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.date}</td>
                      <td className="px-4 py-3">{t.partner}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-rose-500">{formatKRW(t.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-xs text-semibold">
                          {t.source === 'card' ? '💳 신용카드' : t.source === 'bank' ? '🏦 은행통장' : t.source === 'smartstore' ? '📦 스마트스토어' : '📝 직접입력'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => onNavigate('evidence')}
                          className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 shadow-sm transition"
                        >
                          증빙 업로드 <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-2" />
            <p className="text-slate-800 font-semibold mb-1">증빙 완전성 보장 통과!</p>
            <p className="text-slate-500 text-xs">현재 월의 모든 비용 거래 정보에 영수증/인보이스가 완벽하게 결합 및 세팅되었습니다.</p>
          </div>
        )}
      </div>

    </div>
  );
}
