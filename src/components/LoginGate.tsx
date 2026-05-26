/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Building2, Key, ShieldAlert, Sparkles, LogIn, CheckCircle } from 'lucide-react';
import { initSupabase, fetchAppPasswordDb } from '../lib/supabase';

interface LoginGateProps {
  onLoginSuccess: (email: string) => void;
}

export default function LoginGate({ onLoginSuccess }: LoginGateProps) {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load backend configurations and DB password on gate mount
  useEffect(() => {
    async function loadServerConfig() {
      try {
        // 1. Fetch Supabase connection parameters from our secure server settings API
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.supabaseUrl && config.supabaseAnonKey) {
            localStorage.setItem('supabase_url', config.supabaseUrl);
            localStorage.setItem('supabase_anon_key', config.supabaseAnonKey);
          }
        }
      } catch (err) {
        console.warn('Backend configurations call bypassed or offline.', err);
      }

      try {
        // 2. Initialize Supabase and check if a password is synced on the cloud database
        const client = initSupabase();
        if (client) {
          const cloudPassword = await fetchAppPasswordDb();
          if (cloudPassword && cloudPassword.trim()) {
            localStorage.setItem('site_app_password', cloudPassword.trim());
          }
        }
      } catch (err) {
        console.warn('Could not sync DB password (offline fallback in effect):', err);
      } finally {
        setIsLoadingConfig(false);
      }
    }

    loadServerConfig();
  }, []);

  // Retrieve the stored password or default to '1234'
  const getStoredPassword = () => {
    const saved = localStorage.getItem('site_app_password');
    return saved ? saved : '1234';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('패스워드를 올바르게 입력해 주세요.');
      return;
    }

    const correctPassword = getStoredPassword();

    if (password.trim() !== correctPassword) {
      setErrorMessage('패스워드가 일치하지 않습니다. (기본 비밀번호: 1234)');
      return;
    }

    // Success flow
    setIsSuccess(true);
    setErrorMessage(null);
    setTimeout(() => {
      onLoginSuccess('owner@tax-portal.local');
    }, 900);
  };

  const handleDemoLogin = () => {
    setPassword(getStoredPassword());
    setIsSuccess(true);
    setErrorMessage(null);
    setTimeout(() => {
      onLoginSuccess('owner@tax-portal.local');
    }, 900);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      
      {/* Decorative overhead element */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative">
        <div className="bg-indigo-950 p-6 text-white text-center relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]"></div>
          
          <div className="mx-auto bg-indigo-900 border border-indigo-800 p-3 rounded-2xl text-yellow-400 w-fit mb-3 shadow-md">
            <Building2 className="w-6 h-6 animate-pulse" />
          </div>

          <h2 className="font-extrabold text-base tracking-tight">세무 정산 증빙 자동화 AI 포털</h2>
          <p className="text-[10px] text-indigo-350 mt-1 font-medium leading-relaxed">
            나만의 비밀번호 인증형 지출/매입 대장 보관함
          </p>
        </div>

        {/* Success splash or input forms */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[250px] animate-scale-up">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full border border-emerald-250">
              <CheckCircle className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm">보안 세션 수립 완료</p>
              <p className="text-xs text-slate-400 mt-1">포인터 키를 검증하여 안전하게 장부를 불러오고 있습니다.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
              <span>비밀번호 전용 게이트</span>
              <span className="text-[9px] text-indigo-600 bg-indigo-50 border px-1.5 py-0.5 rounded-md font-mono">Session Security</span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-750 rounded-xl text-xs flex items-start gap-1.5 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span className="font-medium leading-normal">{errorMessage}</span>
              </div>
            )}

            {/* Password Field */}
            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 font-bold">비즈니스 접속 패스워드</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:border-indigo-600 rounded-xl px-3 py-2.5 transition">
                <Key className="w-4 h-4 text-slate-400 shrink-0" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="접속 비밀번호 입력"
                  className="bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 w-full focus:ring-0 p-0"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                🔑 초기 비밀번호는 <strong className="text-indigo-800">1234</strong> 입니다. (추후 비밀번호 변경 지원)
              </p>
            </div>

            {/* Access triggers buttons */}
            <div className="space-y-2 pt-2 text-xs">
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>장부 접속하기</span>
              </button>

              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 transition"
              >
                <span>초기 비밀번호로 1초 간편입장</span>
              </button>
            </div>

            {/* Mobile usage brief note */}
            <div className="pt-3.5 border-t border-slate-100 text-center text-[10px] text-slate-450 leading-normal font-medium">
              📱 스마트폰 카메라로 접속하여 즉석에서 영수증을 찍고 올릴 때도 동일한 패스워드로 통합 승인됩니다.
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
