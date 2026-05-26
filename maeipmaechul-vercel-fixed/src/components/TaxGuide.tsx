/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  HelpCircle, 
  Flame, 
  CheckSquare, 
  Square, 
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  BookOpen,
  DollarSign,
  Smartphone,
  Eye,
  FileCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface TaxGuideProps {
  onNavigateToTab: (tab: string) => void;
}

export default function TaxGuide({ onNavigateToTab }: TaxGuideProps) {
  // Persistence States
  const [vatFiled, setVatFiled] = useState(false);
  const [globalTaxFiled, setGlobalTaxFiled] = useState(false);
  
  // Accordion active keys
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Initialize status from localStorage
  useEffect(() => {
    const isVat = localStorage.getItem('is_vat_filed_done') === 'true';
    const isGlobal = localStorage.getItem('is_global_tax_filed_done') === 'true';
    setVatFiled(isVat);
    setGlobalTaxFiled(isGlobal);
  }, []);

  const handleToggleVat = () => {
    const nextVal = !vatFiled;
    setVatFiled(nextVal);
    localStorage.setItem('is_vat_filed_done', String(nextVal));
  };

  const handleToggleGlobalTax = () => {
    const nextVal = !globalTaxFiled;
    setGlobalTaxFiled(nextVal);
    localStorage.setItem('is_global_tax_filed_done', String(nextVal));
  };

  // Hardcode 2026-05-26 reference dates
  const today = new Date('2026-05-26');
  
  // Tax deadlines
  const globalTaxDeadline = new Date('2026-06-01'); // 1st of June
  const vatDeadline = new Date('2026-07-25'); // 25th of July

  const getDDay = (target: Date) => {
    const diff = target.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'D-Day';
    return days > 0 ? `D-${days}` : `완료 (${Math.abs(days)}일 지남)`;
  };

  // FAQ contents
  const TAX_FAQS = [
    {
      q: "💰 부가가치세(부가세)는 어떠한 이유로 붙게 되고 왜 내는 건가요?",
      a: "부가가치세는 상품이 판매되거나 서비스가 제공되는 모든 유통 단계에서 창출되는 '부가가치(Value Added)'에 대해 과세하는 세금입니다. 원론적으로 사업자가 내는 세금이 아니라, 최종소비자가 물건값을 지불하면서 내는 10%의 부가세를 사업자가 '대신 보관(예수)'했다가 국가에 납부하는 일종의 간접세입니다.\n\n사업자 입장에서는:\n1) 내가 물건이나 서비스를 팔고 소비자가 지급한 매출세액(10%)\n2) 대리점, 도매처 또는 우체국 등에서 물건을 가져오며 지급한 매입세액(10%)\n두 세액의 갭(매출세액 - 매입세액)을 차감하여 국가에 정산 납부합니다. 이때, 매입세액을 증명하기 위해 신용카드 전표, 현금영수증, 세금계산서 등의 '적격 증빙자료'를 철저히 관리하여 결합하는 이 스마트 포털 시스템이 세법상 공제 및 감면 혜택의 가장 중요한 기초가 됩니다."
    },
    {
      q: "📸 AI OCR 기능에 매출/매입 영수증, 결제 내역, 현금영수증, 세금계산서 등을 올리면 알아서 다 정리되나요?",
      a: "네, 맞습니다! 본 시스템의 'AI 증빙 뷰 (OCR)' 탭에 국내 우체국 택배 영수증, 네이버 비즈니스 광고 명세서뿐만 아니라 해외 사입 내역서(예: 일본 SUPER DELIVERY 인보이스), 간이 영수증, 사업자용 세금계산서, 현금영수증 등을 드래그하여 올리거나 휴대폰으로 사진 촬영 후 업로드하면 Gemini 3.5 AI가 알아서 날짜, 상호(거래처명), 최종 결제 금액, 세액(부가세)을 자동으로 정밀 해독하여 가상 영수증 대장에 시간대 순서대로 정렬해 줍니다.\n\n그뿐만 아니라, 시스템이 장부와 영수증 데이터를 1원 단위까지 실시간으로 크로스체크하여 정확히 일치하는 날짜와 금액의 대상을 찾아 자동으로 체결(Auto Match완료)해줍니다. 사장님은 그저 클릭 한 번으로 모든 매칭 유 누락 결합을 스마트하게 감시하실 수 있습니다."
    },
    {
      q: "📱 휴대폰으로도 접속하고 촬영해서 바로 영수증을 올릴 수 있나요?",
      a: "네, 당연히 가능합니다! 본 포털은 데스크톱뿐만 아니라 스마트폰(모바일 웹) 해상도에서도 100% 최적화된 반응형 레이아웃(Responsive Web)으로 조율되어 있어 손에 착 감깁니다. 휴대폰으로 외부에서 식사를 하거나 택배 발송 후, 영수증을 스마트폰 카메라로 직접 즉석 촬영(Take a photo)하여 모바일 브라우저 상에서 드롭하고 바로 실시간 OCR 인식 버튼을 누르면 그 자리에서 장부에 기재가 연동됩니다."
    },
    {
      q: "💾 내가 넣은 거래들이나 증빙자료는 완전히 저장되나요? 꺼도 그대로인가요?",
      a: "네, 완벽하게 밀봉 저장됩니다! 사장님께서 수동으로 추가하신 지출내역 장부부터, AI OCR이 해독해낸 인보이스 파일, 매칭 연동 상태, 그리고 직접 수집해 둔 나만의 '자동 세무 자동분류 키워드 규칙' 및 신고 여부 체크리스트까지 브라우저 세션의 안전한 로컬 저장소(localStorage DB)에 정밀 지속(Persistence)됩니다.\n\n브라우저 컴퓨터를 리부트하거나 창을 껐다 켜도, 사장님께서 지우기 전까지는 장부 고유 데이터가 그대로 안전하게 복원되어 있으므로 유실 걱정 없이 맘 편히 업무를 보셔도 괜찮습니다."
    },
    {
      q: "🚀 베셀(Vercel)이나 외부 호스팅 사이트에 제가 만든 것을 진짜로 배포할 수 있나요?",
      a: "네! 빌드 결과물 배포가 즉각 가능한 완제품 세무 솔루션 구조로 설계되어 있습니다. 이 코드 포털 패키지는 완벽한 Vite + React TypeScript 싱글 페이지 앱(SPA)과 Express 백엔드로 구조화되어 있습니다. Vercel이나 Render, Cloud Run, Netlify 등 원하시는 개발 클라우드 플랫폼에 간단히 GitHub Repository를 연결하시거나 파일 압축 업로드 버튼(Zip export)을 통해 실배포(Production Release)하여 나만의 상용 SaaS 도구처럼 운영이 가능합니다."
    }
  ];

  return (
    <div className="space-y-6">

      {/* Alarm notification banner: High light priority */}
      {(!vatFiled || !globalTaxFiled) && (
        <div id="tax-urgency-alarm" className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 text-white p-2.5 rounded-xl">
              <Flame className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm md:text-base flex items-center gap-1.5">
                <span>긴급 세무 신고기한 임박 알림 알람</span>
                <span className="bg-red-200 text-red-800 text-[10px] font-black px-2 py-0.5 rounded">D-Day 카운트다운 가동 중</span>
              </h3>
              <p className="text-xs text-red-700/90 mt-1 font-medium">
                현재 체크하지 않은 필수 원천세/종합소득세 신고 기한이 얼마 남지 않았습니다. 대장을 세무사 제출용 엑셀로 내려받은 후 납부 신고를 마치고 완료 체크를 해주세요.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigateToTab('reports')}
            className="bg-red-900 hover:bg-red-950 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs self-end md:self-auto shrink-0"
          >
            대장 엑셀받기 ↳
          </button>
        </div>
      )}

      {/* interactive Grid trackers cards */}
      <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mt-4">
        <Calendar className="w-5 h-5 text-indigo-900" />
        <span>실시간 법정 신고 의무 기한 & 체크 보드</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Global Income Tax */}
        <div className={`bg-white border rounded-2xl p-5 transition shadow-sm flex flex-col justify-between ${
          globalTaxFiled ? "border-emerald-250 bg-emerald-50/15" : "border-slate-200 hover:border-indigo-300"
        }`}>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-900 font-bold px-2 py-0.5 rounded">
                  연 1회 정기 의무
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-1.5">귀속 종합소득세 정기 자진신고</h4>
              </div>

              <div className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg ${
                globalTaxFiled ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
              }`}>
                {globalTaxFiled ? "신고 완료" : getDDay(globalTaxDeadline)}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 leading-relaxed font-semibold">
              <p>⏰ <strong className="text-slate-800">신고 기한:</strong> 2026년 5월 1일 ~ 6월 1일 까지</p>
              <p>📝 <strong className="text-slate-800">신고 대상:</strong> 작년 한 해 동안 발생한 사업상의 소득 총액</p>
              <p className="text-[11px] font-medium text-slate-400">
                수익 금액에서 실제 증빙 결합된 경비 데이터를 제외하고 남은 '순이익'에 구간 세율을 적용하므로 대장 유실 차단이 핵심입니다!
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleToggleGlobalTax}
              className={`w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
                globalTaxFiled 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" 
                  : "bg-indigo-950 text-white hover:bg-indigo-900"
              }`}
            >
              {globalTaxFiled ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>진행 마감 (2026 종소세 자진신고 필함)</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>이 기한을 신고 완료 상태로 전환하기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Value Added Tax (VAT) */}
        <div className={`bg-white border rounded-2xl p-5 transition shadow-sm flex flex-col justify-between ${
          vatFiled ? "border-emerald-250 bg-emerald-50/15" : "border-slate-200 hover:border-indigo-300"
        }`}>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] bg-amber-50 border border-amber-150 text-amber-800 font-bold px-2 py-0.5 rounded">
                  상반기 1기 부가세 확기
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-1.5">1기 부가가치세 확정 자진신고</h4>
              </div>

              <div className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg ${
                vatFiled ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-700"
              }`}>
                {vatFiled ? "신고 완료" : getDDay(vatDeadline)}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1.5 leading-relaxed font-semibold">
              <p>⏰ <strong className="text-slate-800">신고 기한:</strong> ~ 2026년 7월 25일 까지</p>
              <p>📝 <strong className="text-slate-800">신고 대상:</strong> 금년 상반기(1월~6월)에 매입 및 매출 발생분</p>
              <p className="text-[11px] font-medium text-slate-400">
                고객이 낸 매출세액에서 사업 목적을 위해 우체국택배, 광고비, 자재 구입 등으로 지급한 부가세 매입액을 공제(환급) 받습니다.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleToggleVat}
              className={`w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
                vatFiled 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" 
                  : "bg-indigo-950 text-white hover:bg-indigo-900"
              }`}
            >
              {vatFiled ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>진행 마감 (2026 1기 부가세 신고 마침)</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>이 기한을 신고 완료 상태로 전환하기</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Tax guides step by step */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">개인사업자 초보 사장님을 위한 1분 필수 세무 상식</h3>
          <p className="text-xs text-slate-450 leading-relaxed font-medium">카테고리별 아코디언 질의응답을 열어 가장 빠르고 명확하게 부가세와 세무 신고의 오해를 파헤치세요.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {TAX_FAQS.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx} className="py-3">
                <button
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full text-left font-bold text-slate-800 text-xs py-2 flex items-center justify-between hover:text-indigo-900 transition"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {isOpen && (
                  <div className="mt-2 text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 border p-4 rounded-xl whitespace-pre-line animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Step instruction on how to file with our exported spreadsheet */}
        <div className="bg-slate-50 p-4 border border-slate-150 rounded-xl space-y-2.5">
          <strong className="text-slate-800 text-xs font-bold flex items-center gap-1">
            <Info className="w-4 h-4 text-indigo-900" />
            <span>이 포털의 데이터로 쉽고 편리하게 세금 신고하는 법 (전표 제출용)</span>
          </strong>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-slate-650 leading-relaxed pt-1 font-semibold">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-extrabold text-indigo-900 block font-mono text-sm mb-1">01</span>
              <strong className="text-slate-800 text-[11px] block">증빙자료 보관 검토</strong>
              <span className="text-[10px] text-slate-400 block font-normal">
                스마트스토어 정산 파일, 신용카드 전표 및 홈택스 계산서들을 AI OCR에 하나하나 던져 날짜 기준으로 촤르르 정렬하고 장부 금액과 맞물려 매칭시킵니다.
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-extrabold text-indigo-900 block font-mono text-sm mb-1">02</span>
              <strong className="text-slate-800 text-[11px] block">세무 대장 내보내기</strong>
              <span className="text-[10px] text-slate-400 block font-normal">
                '세무사 대장 내보내기' 탭 또는 상단의 다운로드 버튼을 클릭해 Excel 완벽 연동 BOM-CSV 대장을 원클릭으로 보존합니다.
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-extrabold text-indigo-900 block font-mono text-sm mb-1">03</span>
              <strong className="text-slate-800 text-[11px] block">세무사 제출 / 자진 신고</strong>
              <span className="text-[10px] text-slate-400 block font-normal">
                이 엑셀 파일을 세무 대리인에게 이메일로 송부하거나, 국세청 홈택스(Hometax) 지출경비 수동 입력 폼에 기재하여 아주 편리하게 소득세를 절감합니다.
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
