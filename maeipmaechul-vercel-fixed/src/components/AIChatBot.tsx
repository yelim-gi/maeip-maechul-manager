/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, Sparkles, AlertTriangle, ArrowRight, RefreshCw, Calculator, HelpCircle } from 'lucide-react';

interface AIChatBotProps {
  transactions: any[];
  evidencesCount: number;
  rulesCount: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function AIChatBot({ transactions, evidencesCount, rulesCount }: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `안녕하세요, 사장님! 🙇‍♂️\n실시간 매매 대장 및 해외 사입 증빙 분석을 돕는 **초간편 AI 세무 비서**입니다.\n\n현재 사장님 장부의 **거래 ${transactions.length}건, 보관 증빙 ${evidencesCount}건, 규칙 ${rulesCount}건**을 기반으로 맞춤 장부 분석이나 세금 상담을 도와드릴 수 있어요.\n\n궁금한 질문을 직접 타이핑하시거나 아래의 **추천 감지 템플릿**을 클릭해 보세요!`,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle send message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsgId = 'user-' + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Create lightweight ledger summary to optimize payload
      const ledgerSummary = {
        transactions: transactions.map(t => ({
          date: t.date,
          partner: t.partner,
          amount: t.amount,
          tax: t.tax,
          category: t.category,
          shippingFee: t.shippingFee,
          customsFee: t.customsFee,
          evidenceId: t.evidenceId,
        })),
        evidencesCount,
        rulesCount
      };

      // Call server backend chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role,
            text: m.text,
          })),
          ledgerData: ledgerSummary,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (e) {
        // failed to parse json
      }

      if (!response.ok) {
        throw new Error(data?.error || '서버와 대화에 실패했습니다.');
      }

      if (data && data.success) {
        const assistantMsgId = 'assistant-' + Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            text: data.text,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(data?.error || '답변을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'error-' + Date.now(),
          role: 'assistant',
          text: `⚠️ **오류가 발생했습니다:**\n${err.message || '인터넷 연결을 확인하거나 나중에 다시 시도해 주세요.'}\n\n*서버의 API KEY가 올바르게 기입되었는지 확인해 주시면 도움이 됩니다.*`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickTemplate = (templatePrompt: string) => {
    handleSendMessage(templatePrompt);
  };

  // Helper micro-markdown parser to safely format bold, bullets, lists, headings
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bullet list item
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2);
        return (
          <li key={idx} className="ml-3 list-disc text-slate-700 text-xs md:text-sm leading-relaxed mb-1 pl-1">
            {parseInLineBold(content)}
          </li>
        );
      }
      
      // Numbered list item
      const numMatch = line.trim().match(/^\d+\.\s(.*)/);
      if (numMatch) {
        const content = numMatch[1];
        return (
          <li key={idx} className="ml-3 list-decimal text-slate-700 text-xs md:text-sm leading-relaxed mb-1 pl-1">
            {parseInLineBold(content)}
          </li>
        );
      }

      // Headings
      if (line.trim().startsWith('###')) {
        return (
          <h4 key={idx} className="text-xs md:text-sm font-black text-slate-900 mt-2 mb-1 border-l-2 border-emerald-500 pl-1.5 bg-emerald-50/50 py-0.5">
            {parseInLineBold(line.trim().substring(3).trim())}
          </h4>
        );
      }
      if (line.trim().startsWith('##')) {
        return (
          <h3 key={idx} className="text-sm md:text-base font-black text-emerald-800 mt-3 mb-1">
            {parseInLineBold(line.trim().substring(2).trim())}
          </h3>
        );
      }
      if (line.trim().startsWith('#')) {
        return (
          <h2 key={idx} className="text-base md:text-lg font-black text-emerald-950 mt-4 mb-2">
            {parseInLineBold(line.trim().substring(1).trim())}
          </h2>
        );
      }

      // Empty line block
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }

      // Regular line
      return (
        <p key={idx} className="text-slate-700 text-xs md:text-sm leading-relaxed mb-1">
          {parseInLineBold(line)}
        </p>
      );
    });
  };

  const parseInLineBold = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <strong key={i} className="font-extrabold text-emerald-950 bg-emerald-50/40 px-0.5 rounded-sm">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      
      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-[360px] md:w-[410px] h-[550px] md:h-[620px] max-h-[85vh] flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-900 px-4 py-4 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-950/40 p-1.5 rounded-xl border border-emerald-400/30 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-yellow-300 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-black text-sm md:text-base flex items-center gap-1.5 text-yellow-100">
                    초간편 AI 세무 비서
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-emerald-100/90 font-medium leading-none mt-0.5">실시간 장부 진단 & 세무 자동 감지</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              
              {/* Active list showing current records context */}
              <div className="bg-emerald-50/60 border border-emerald-500/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-1">
                <div className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-500">거래</span>
                  <span className="text-[10px] font-extrabold text-emerald-700">{transactions.length}건</span>
                </div>
                <div className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-500">증빙</span>
                  <span className="text-[10px] font-extrabold text-emerald-700">{evidencesCount}건</span>
                </div>
                <div className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-500">자동분류</span>
                  <span className="text-[10px] font-extrabold text-emerald-700">{rulesCount}건</span>
                </div>
                <div className="text-[9px] text-emerald-800 font-extrabold flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-yellow-500" /> 실시간 연동중
                </div>
              </div>

              {/* Messages Area */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/80 border border-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-emerald-700" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs md:text-sm shadow-sm border ${
                        msg.role === 'user'
                          ? 'bg-emerald-800 text-white border-emerald-900 rounded-tr-none font-medium'
                          : 'bg-white text-slate-800 border-slate-200/90 rounded-tl-none'
                      }`}
                    >
                      {/* Convert lines and markdown formatting inside text to nicely rendered React components */}
                      <div className="space-y-1">
                        {formatText(msg.text)}
                      </div>
                      <span className={`block text-[9px] mt-1.5 text-right ${msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loader */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[80%]">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-emerald-700 animate-bounce" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-100" />
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-200" />
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-300" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">사장님의 최신 장부를 상세히 검수하고 있어요...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates List */}
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-2 shrink-0">
              <button
                onClick={() => handleQuickTemplate('현재 내 장부 분석해서 잘못된 카테고리 기입이나 누락 오류 진단해줘')}
                disabled={isLoading}
                className="bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200/80 rounded-full px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 select-none shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                장부 오류 진단
              </button>
              <button
                onClick={() => handleQuickTemplate('이번 달 결산상 상품 매입이랑 배송비 비율은 어때? 세금 절세 조언이 필요해')}
                disabled={isLoading}
                className="bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200/80 rounded-full px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 select-none shadow-xs cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-blue-500" />
                지출 통계 분석
              </button>
              <button
                onClick={() => handleQuickTemplate('해외 사이트 사입 시 인보이스나 해외 영수증으로 세액공제/비용처리 받는 조건 가르쳐줘')}
                disabled={isLoading}
                className="bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200/80 rounded-full px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 select-none shadow-xs cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                해외 사입 증빙요령
              </button>
              <button
                onClick={() => handleQuickTemplate('부가가치세 조기환급은 언제 신청하는게 좋은지 알려줘')}
                disabled={isLoading}
                className="bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200/80 rounded-full px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0 select-none shadow-xs cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-orange-500" />
                부가세 조기환급
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shadow-inner shrink-0"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isLoading ? '답변을 작성하는 중입니다...' : '무엇이든 물어보세요 (예: 절세 팁 등)...'}
                disabled={isLoading}
                className="flex-1 bg-slate-100 rounded-xl px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700/40 focus:bg-white text-slate-800 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="bg-emerald-700 text-white rounded-xl p-2.5 hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="메시지 전송"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="bg-slate-100 px-4 py-1.5 text-center text-[9px] text-slate-400 font-medium shrink-0 border-t border-slate-200 select-none">
              ⚠️ AI의 답변은 참고용이며, 공식 세무 자문은 전문가에 의뢰하시기 바랍니다.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto bg-emerald-800 hover:bg-emerald-700 text-white p-3.5 rounded-2xl shadow-xl flex items-center gap-2 group transition-all duration-300 cursor-pointer select-none border-t-2 border-emerald-600"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 text-yellow-300" />
          <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </div>
        <span className="text-xs font-black tracking-tight flex items-center gap-1 select-none pr-1">
          초간편 AI 비서
          <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse hidden md:inline" />
        </span>
      </motion.button>

    </div>
  );
}
