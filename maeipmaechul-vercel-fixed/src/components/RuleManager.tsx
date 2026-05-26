/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Rule } from '../types';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Sparkles, 
  HelpCircle, 
  Layers, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface RuleManagerProps {
  rules: Rule[];
  onAddRule: (newRule: Rule) => void;
  onDeleteRule: (id: string) => void;
  onApplyRules: () => void;
}

export default function RuleManager({
  rules,
  onAddRule,
  onDeleteRule,
  onApplyRules
}: RuleManagerProps) {
  
  // States
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("상품매입");
  const [successApply, setSuccessApply] = useState(false);

  // Submit Handler
  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) {
      alert("키워드를 공백 없이 적어주세요.");
      return;
    }

    // Dup check
    if (rules.some(r => r.keyword.toLowerCase() === newKeyword.trim().toLowerCase())) {
      alert("이미 동일한 등록 키워드가 존재합니다.");
      return;
    }

    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      keyword: newKeyword.trim(),
      category: newCategory
    };

    onAddRule(newRule);
    setNewKeyword("");
  };

  const triggerRuleApply = () => {
    onApplyRules();
    setSuccessApply(true);
    setTimeout(() => {
      setSuccessApply(false);
    }, 2800);
  };

  return (
    <div id="rule-manager-view" className="space-y-6">

      {/* Intro explain card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 text-lg mb-1.5 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-900" />
          <span>인공지능 & 패턴 자동 매칭 규칙 관리</span>
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          사업장 지출의 85% 이상은 거래처명만으로 용도를 예측할 수 있습니다. 
          여기에 키워드(Keyword) 규칙을 심어 두면 Excel이나 카드 CSV를 업로드하는 시점에 별도의 손을 거치지 않고도 지정한 세무 지출 과목으로 자동 인덱싱 및 카테고리 매핑이 일어납니다.
        </p>

        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3.5">
          <div className="text-xs text-slate-650 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500 animate-bounce" />
            <span>현재 총 <strong>{rules.length}개</strong>의 지출/매출 규칙 수립 완료</span>
          </div>
          <button
            onClick={triggerRuleApply}
            className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <span>현재 장부에 일괄 자동 규칙 전개 실행</span>
          </button>
        </div>

        {successApply && (
          <div className="mt-3 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>장부분류 자동완료! 키워드 매칭 규칙에 부합하는 모든 거래 내역의 세무 분류 수정이 완료되었습니다.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Creation Box (md size 4) */}
        <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
          <h4 className="font-bold text-slate-800 text-sm mb-3">새 자동 분류 규칙 추가</h4>
          
          <form onSubmit={handleAddRuleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">매칭할 키워드</label>
              <input 
                type="text" 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 text-xs font-medium"
                placeholder="예: 페이스북, 택배, 주유소"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">해당 텍스트를 포함하는 경우 적용됩니다 (대소문자 무구).</span>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1 font-sans">설정할 세무 분류</label>
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-indigo-900 font-semibold rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 text-xs"
              >
                <option value="상품매입">📦 상품매입</option>
                <option value="배송비">📞 배송비</option>
                <option value="광고비">📢 광고비</option>
                <option value="소모품비">📎 소모품비</option>
                <option value="지급수수료">💳 지급수수료</option>
                <option value="여비교통비">🚄 여비교통비</option>
                <option value="매출">💰 매출 (쇼핑몰 정산)</option>
                <option value="임차료">🏠 임차료</option>
                <option value="복리후생비">🍗 복리후생비</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>자동분류 규칙 저장</span>
            </button>
          </form>
        </div>

        {/* Existing Rules Inventory Box (md size 8) */}
        <div className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-800 text-sm">실시간 활성화 규칙 리스트</h4>
          
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs text-left text-slate-500">
              <thead className="text-slate-600 bg-slate-50 font-bold uppercase border-b">
                <tr>
                  <th className="px-4 py-3">업체 키워드 (Keyword)</th>
                  <th className="px-4 py-3">자동 인덱싱 지출항목</th>
                  <th className="px-4 py-3 text-right">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 bg-white">
                    <td className="px-4 py-3 font-bold text-slate-800">{r.keyword}</td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 text-indigo-900 text-xs font-semibold px-2.5 py-0.5 border border-indigo-100 rounded-lg">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDeleteRule(r.id)}
                        className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1 rounded transition"
                        title="규칙 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {rules.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-light">
                      <Layers className="w-10 h-10 stroke-1 text-slate-350 mx-auto mb-2" />
                      현재 가동 중인 맞춤형 키워드가 없습니다. 새 키워드를 설정해 지출을 원탭 정리 하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
