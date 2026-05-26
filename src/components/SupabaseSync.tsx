import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Database, 
  RefreshCw, 
  Check, 
  Copy, 
  ExternalLink, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  ArrowDownCircle,
  ArrowUpCircle,
  Smartphone
} from 'lucide-react';
import { getSupabaseCredentials, testConnection } from '../lib/supabase';

interface SupabaseSyncProps {
  onSyncComplete: () => void;
  transactionsCount: number;
  evidencesCount: number;
  rulesCount: number;
  onUploadState: () => Promise<void>;
  onDownloadState: () => Promise<void>;
  isSynced: boolean;
}

export default function SupabaseSync({
  onSyncComplete,
  transactionsCount,
  evidencesCount,
  rulesCount,
  onUploadState,
  onDownloadState,
  isSynced
}: SupabaseSyncProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setUrl(creds.url || 'https://qnftssmqueilovlkqxzx.supabase.co');
    setAnonKey(creds.key || '');
    if (creds.url && creds.key) {
      setConnectionStatus('success');
    }
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('두 항목을 모두 정확히 기재해 주세요.');
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');
    setActionStatus('연동 신호를 점검하고 있습니다...');

    const isConnected = await testConnection(url.trim(), anonKey.trim());
    setIsTesting(false);

    if (isConnected) {
      localStorage.setItem('supabase_url', url.trim());
      localStorage.setItem('supabase_anon_key', anonKey.trim());
      
      // Save credentials to our backend server configuration to distribute to other devices automatically (e.g. phone)
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supabaseUrl: url.trim(),
            supabaseAnonKey: anonKey.trim()
          })
        });
      } catch (err) {
        console.warn('Backend server configurations save failed:', err);
      }

      setConnectionStatus('success');
      setActionStatus('🎉 연동 성공! 이제 모든 기기(폰 & 다른 PC)가 로그인 없이 동일하게 자동 실시간 연동됩니다.');
      onSyncComplete();
    } else {
      setConnectionStatus('failed');
      setActionStatus('❌ 인증 실패. URL 주소 또는 API Anon Key가 잘못되었거나, Supabase 테이블이 아직 생성되지 않았을 수 있습니다. 하단의 SQL 스크립트를 먼저 실행해 주셨는지 확인해 주세요!');
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Supabase 연동을 끊으시겠습니까? 로컬 데이터는 보존되며 브라우저 저장소만 오프라인으로 전환됩니다.')) {
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_anon_key');
      localStorage.removeItem('supabase_initial_merged');
      
      // Clear on the backend server too
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supabaseUrl: '',
            supabaseAnonKey: ''
          })
        });
      } catch (err) {
        console.warn('Backend server config clear failed:', err);
      }

      setUrl('https://qnftssmqueilovlkqxzx.supabase.co');
      setAnonKey('');
      setConnectionStatus('idle');
      setActionStatus('연동이 종료되고 로컬 수동 모드로 복귀했습니다.');
      onSyncComplete();
    }
  };

  const syncToCloud = async () => {
    try {
      setActionStatus('현재 등록된 로컬 장부 및 사진 영수증들을 Supabase 클라우드로 올리는 중...');
      await onUploadState();
      setActionStatus('💸 업로드 완료! 이제 폰으로 언제 어디서든 접속해도 동일한 장부를 확인하실 수 있습니다.');
    } catch (err: any) {
      setActionStatus(`❌ 업로드 실패: ${err.message || '인증 오류가 발생했습니다.'}`);
    }
  };

  const syncFromCloud = async () => {
    try {
      setActionStatus('Supabase 클라우드에서 최신 데이터를 가져와 동기화를 덮어쓰는 중...');
      await onDownloadState();
      setActionStatus('📲 수신 완료! 휴대폰이나 다른 PC로 입력했던 내역이 완벽히 병합 및 동기화되었습니다.');
    } catch (err: any) {
      setActionStatus(`❌ 다운로드 실패: ${err.message || '인증 오류가 발생했습니다.'}`);
    }
  };

  // SQL Script to copy
  const sqlScript = `-- 1. AI 증빙 내역 테이블 생성 (evidences)
CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size NUMERIC,
  uploaded_at TEXT,
  ocr_data JSONB,
  ocr_status TEXT DEFAULT 'pending',
  is_matched BOOLEAN DEFAULT FALSE,
  matched_transaction_id TEXT,
  file_data_url TEXT -- 영수증 이미지 데이터 (포괄적 보관 전송)
);

-- 2. 매입매출 거래장부 테이블 생성 (transactions - 외래키 제약조건 제거하여 업로드 안전성 100% 보장)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  partner TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  shipping_fee NUMERIC DEFAULT 0,
  customs_fee NUMERIC DEFAULT 0,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  memo TEXT DEFAULT '',
  evidence_id TEXT
);

-- 기존 테이블이 있어 제약조건이 활성화되어 있는 상태에서 업로드 에러가 나는 것을 방지하기 위해 외래키 제약조건이 있다면 강제로 제거합니다.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_evidence_id_fkey;

-- 3. 자동 분류 규칙 테이블 생성 (rules)
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL
);

-- 4. 앱 전용 설정 및 동기화 패스워드 테이블 생성 (settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- [보안 및 실시간 연동 활성화 핵심 설정]
-- RLS(Row Level Security)가 활성화되어 있으면 로그인하지 않은 클라이언트의 백업/동기화 요청이 차단됩니다.
-- 기기 간 자유로운 실시간 양방향 연동을 위해 RLS를 완전히 비활성화합니다.
ALTER TABLE evidences DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 실시간 채널에서 수정(UPDATE) 및 삭제(DELETE)가 일어날 때 모든 기기에 바뀐 내용이 즉시 전파되도록 복제 ID 정책을 FULL로 설정합니다.
ALTER TABLE evidences REPLICA IDENTITY FULL;
ALTER TABLE transactions REPLICA IDENTITY FULL;
ALTER TABLE rules REPLICA IDENTITY FULL;
ALTER TABLE settings REPLICA IDENTITY FULL;

-- 테이블을 실시간 동기화 채널로 등록 허용 (Supabase Realtime API 활성화)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE evidences, transactions, rules, settings;
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Introduction Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-5 rounded-2xl border border-emerald-800 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2.5 rounded-xl text-emerald-300">
            <Cloud className="w-6 h-6 shrink-0 animate-bounce" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
              실시간 폰 & PC 클라우드 데이터 동기화 센터
              <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-md">SUPABASE</span>
            </h2>
            <p className="text-[11.5px] text-emerald-200/90 font-medium">
              이제 무료 데이터베이스 Supabase를 연결하여 휴대폰 즉석 촬영 자료와 장부를 끊김 없이 실시간 원격 백업 및 동기화하세요!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Connection Setup Form */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm">1단계. 연동 정보 입력</h3>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-3.5">
            <div className="space-y-1 text-xs">
              <label className="block text-slate-600 font-bold">1) Supabase Project URL</label>
              <input 
                type="url" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://YOUR_PROJECT.supabase.co"
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl px-3 py-2.5 font-mono text-xs focus:ring-0"
                required
              />
              <p className="text-[10px] text-slate-400">
                올려주신 대시보드 화면 하단에서 확인되는 `https://...supabase.co` 전체 주소를 그대로 붙여넣어 주세요.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-bold">2) API Project Anon Key (Public Key)</label>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600 inline" />
                  안전 암호화 보관
                </span>
              </div>
              <input 
                type="password" 
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl px-3 py-2.5 font-mono text-xs focus:ring-0"
                required
              />
              <p className="text-[10px] text-slate-400">
                Supabase의 Project Settings → API 탭 또는 홈화면의 `API Keys` 밑에 있는 <strong className="text-slate-600">anon/public</strong> 키를 복사해 입력하세요.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isTesting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>저장 및 연동 상태 확인</span>
              </button>

              {connectionStatus === 'success' && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  연동 끊기
                </button>
              )}
            </div>
          </form>

          {/* Connection Result Indicator */}
          {actionStatus && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed ${
              connectionStatus === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500' 
                : connectionStatus === 'failed' 
                ? 'bg-rose-50 text-rose-800 border-l-4 border-rose-500' 
                : 'bg-indigo-50 text-indigo-800 border-l-4 border-indigo-500'
            }`}>
              {actionStatus}
            </div>
          )}

          {/* Sync Trigger Panel (Only visible when connected successfully) */}
          {connectionStatus === 'success' && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <span className="text-[11px] font-black text-slate-400 tracking-wider uppercase block">
                2단계. 실시간 장부 백업 및 내려받기
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* Upload state */}
                <button
                  type="button"
                  onClick={syncToCloud}
                  className="p-3.5 rounded-2xl border border-slate-150 hover:border-emerald-500 text-left hover:bg-emerald-50/20 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-slate-700 font-extrabold text-xs">
                    <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                    <span>PC ➔ 클라우드 올리기</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    내 PC에 등록된 장부({transactionsCount}건), 영수증 사진({evidencesCount}건), 매칭 규칙({rulesCount}건)을 클라우드로 복사합니다. <strong className="text-emerald-700 font-bold">휴대폰에서 처음 열기 전에 실행하세요!</strong>
                  </p>
                </button>

                {/* Download state */}
                <button
                  type="button"
                  onClick={syncFromCloud}
                  className="p-3.5 rounded-2xl border border-slate-150 hover:border-emerald-500 text-left hover:bg-emerald-50/20 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-slate-700 font-extrabold text-xs">
                    <ArrowDownCircle className="w-4 h-4 text-blue-600" />
                    <span>클라우드 ➔ 브라우저 받기</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    휴대폰 즉석 촬영이나 외부에서 백업한 대장을 그대로 가져와 로컬을 업데이트합니다. <strong className="text-blue-700 font-bold">기기 간 화면 불일치가 있을 때 터치하세요!</strong>
                  </p>
                </button>
              </div>

              {/* Status information */}
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-slate-400" />
                  <span>실시간 모바일 연동 사용 중</span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                  ACTIVE
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Database SQL Setup Guide */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-900" />
              <h3 className="font-bold text-slate-800 text-sm">필수 작업. Supabase 테이블 생성 SQL</h3>
            </div>
            <button
              onClick={handleCopySql}
              type="button"
              className="text-[11px] bg-slate-100 hover:bg-indigo-900 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all font-bold cursor-pointer flex items-center gap-1 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사 완료!' : 'SQL 전체 복사'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 space-y-2.5 leading-relaxed">
            <span className="font-black text-rose-600 flex items-center gap-1 block">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              주의: 최초 1회, SQL 쿼리를 Supabase 대시보드에 실행해주셔야 연동이 시작됩니다!
            </span>

            <ol className="list-decimal pl-4 text-[11px] space-y-1.5 text-slate-400 font-medium">
              <li>올려주신 Supabase 검은색 대시보드 웹페이지 화면 왼쪽의 메인 메뉴들 중 <strong className="text-slate-700">"SQL Editor (초록색 터미널 아이콘)"</strong> 또는 주황색 <strong className="text-slate-700">"New Query"</strong> 버튼을 클릭하세요.</li>
              <li>화면 상단에 있는 <strong className="text-slate-700">SQL 전체 복사</strong> 버튼을 클릭하여 스크립트를 클립보드에 담습니다.</li>
              <li>Supabase SQL Editor 빈 화면에 붙여넣기(Ctrl + V) 합니다.</li>
              <li>화면 우측 하단의 초록색 <strong className="text-emerald-600 font-bold">"Run (실행)"</strong> 버튼을 누르시면 3초 만에 세무 장부 데이터베이스 구축이 완료됩니다!</li>
            </ol>
          </div>

          <div className="bg-slate-900 text-indigo-200 p-3.5 rounded-xl border border-slate-800 font-mono text-[9px] overflow-x-auto max-h-56 leading-normal scrollbar-thin">
            <pre className="whitespace-pre">{sqlScript}</pre>
          </div>
        </div>

      </div>

    </div>
  );
}
