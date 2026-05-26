/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Transaction, Evidence, Rule } from './types';
import Dashboard from './components/Dashboard';
import EvidenceManager from './components/EvidenceManager';
import TransactionManager from './components/TransactionManager';
import RuleManager from './components/RuleManager';
import Reports from './components/Reports';
import TaxGuide from './components/TaxGuide';
import LoginGate from './components/LoginGate';
import { 
  Building2, 
  LayoutDashboard, 
  FileText, 
  ClipboardList, 
  BookOpen, 
 Settings, 
  Download,
  AlertCircle,
  HelpCircle,
  LogOut,
  Key,
  Cloud
} from 'lucide-react';
import SupabaseSync from './components/SupabaseSync';
import { AIChatBot } from './components/AIChatBot';
import {
  getSupabase,
  initSupabase,
  fetchAllData,
  upsertTransactionDb,
  deleteTransactionDb,
  upsertEvidenceDb,
  deleteEvidenceDb,
  upsertRuleDb,
  deleteRuleDb,
  uploadAllLocalData,
  getSupabaseCredentials,
  saveAppPasswordDb
} from './lib/supabase';

// Default mock rules
const DEFAULT_RULES: Rule[] = [
  { id: 'rule-1', keyword: '우체국', category: '배송비' },
  { id: 'rule-2', keyword: 'SUPER DELIVERY', category: '상품매입' },
  { id: 'rule-3', keyword: '페이스북', category: '광고비' },
  { id: 'rule-4', keyword: '네이버비즈', category: '광고비' },
  { id: 'rule-5', keyword: '임대인', category: '임차료' },
  { id: 'rule-6', keyword: '쿠팡', category: '매출' },
  { id: 'rule-7', keyword: '스마트스토어 정산', category: '매출' }
];

// Default mock transaction ledger for YYYY-MM YYYY-MM representation
const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-05-02',
    partner: '네이버 스마트스토어 정산대금',
    amount: 3200000,
    tax: 0,
    shippingFee: 0,
    customsFee: 0,
    category: '매출',
    source: 'smartstore',
    memo: '5월 1차 매출 정산 환급금액',
    evidenceId: null
  },
  {
    id: 'tx-2',
    date: '2026-05-04',
    partner: '우체국택배 발송',
    amount: 45000,
    tax: 4100,
    shippingFee: 0,
    customsFee: 0,
    category: '배송비',
    source: 'card',
    memo: '고객 반품 및 대량 사입품 발송용 우편료',
    evidenceId: null
  },
  {
    id: 'tx-3',
    date: '2026-05-10',
    partner: 'SUPER DELIVERY 사입대금',
    amount: 850000,
    tax: 0, // Duty-free import
    shippingFee: 0,
    customsFee: 0,
    category: '상품매입',
    source: 'bank',
    memo: '일본 수퍼딜리버리 여성자켓 30벌 소도매 사입대금',
    evidenceId: null
  },
  {
    id: 'tx-4',
    date: '2026-05-12',
    partner: '페이스북 광고 집행비',
    amount: 250000,
    tax: 25000,
    shippingFee: 0,
    customsFee: 0,
    category: '광고비',
    source: 'card',
    memo: '스토어 노출용 광고비 마케팅 집행 대금',
    evidenceId: null
  },
  {
    id: 'tx-5',
    date: '2026-05-15',
    partner: '네이버 스마트스토어 정산대금',
    amount: 1980000,
    tax: 0,
    shippingFee: 0,
    customsFee: 0,
    category: '매출',
    source: 'smartstore',
    memo: '5월 2차 매출 정산 대금',
    evidenceId: null
  },
  {
    id: 'tx-6',
    date: '2026-05-20',
    partner: '임대인 김철수 월세 납입',
    amount: 600000,
    tax: 0,
    shippingFee: 0,
    customsFee: 0,
    category: '임차료',
    source: 'bank',
    memo: '사무공간 월세 이체납부 완료',
    evidenceId: null
  },
  {
    id: 'tx-7',
    date: '2026-05-22',
    partner: '수퍼딜리버리 소도매 사입대금',
    amount: 204850, // This is set to perfectly match the sample doc preset 1!
    tax: 0,
    shippingFee: 0,
    customsFee: 0,
    category: '상품매입',
    source: 'card',
    memo: '일본 사입몰 추가 보완 자재결제 건',
    evidenceId: null
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-05');
  
  // Login Session States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('qzwxec88888@gmail.com');
  
  // Persistence States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  // Cloud/Supabase state
  const [isCloudActive, setIsCloudActive] = useState<boolean>(false);
  const [triggerSyncCount, setTriggerSyncCount] = useState<number>(0);

  const loadSupabaseData = async (forceMerge?: boolean) => {
    try {
      initSupabase(); // Ensure latest credentials from localStorage are active
      const data = await fetchAllData();
      if (data) {
        // Decide if we should do a forceMerge
        // If forceMerge is undefined, check if we have never successfully merged this connection
        const hasMergedBefore = localStorage.getItem('supabase_initial_merged') === 'true';
        const shouldMerge = forceMerge !== undefined ? forceMerge : !hasMergedBefore;

        const localTx = JSON.parse(localStorage.getItem('site_transactions') || '[]');
        const localEv = JSON.parse(localStorage.getItem('site_evidences') || '[]');
        const localRules = JSON.parse(localStorage.getItem('site_rules') || '[]');

        const hasLocalData = localTx.length > 0 || localEv.length > 0;
        const hasRemoteData = data.transactions.length > 0 || data.evidences.length > 0;

        // Check if the user has actually made edits on this device (otherwise data is just default templates)
        const isUserModified = localStorage.getItem('site_data_user_modified') === 'true';
        const hasLocalRealData = hasLocalData && isUserModified;

        if (shouldMerge) {
          if (hasLocalRealData && !hasRemoteData) {
            // Supabase is empty but local has real user modifications -> upload local
            console.log("Supabase is empty. Syncing local modified data to Supabase...");
            await uploadAllLocalData(localTx, localEv, localRules);
            setTransactions(localTx);
            setEvidences(localEv);
            setRules(localRules);
            localStorage.setItem('supabase_initial_merged', 'true');
          } else if (!hasLocalRealData && hasRemoteData) {
            // Local is freshly initialized or unmodified template -> pull real data from Supabase
            console.log("Local has default placeholders. Syncing Supabase data to local...");
            setTransactions(data.transactions);
            setEvidences(data.evidences);
            setRules(data.rules);
            localStorage.setItem('site_transactions', JSON.stringify(data.transactions));
            localStorage.setItem('site_evidences', JSON.stringify(data.evidences));
            localStorage.setItem('site_rules', JSON.stringify(data.rules));
            localStorage.setItem('supabase_initial_merged', 'true');
            // Once loaded from cloud, we can align the modified flag because it's cloud-backed
            localStorage.setItem('site_data_user_modified', 'true');
          } else if (hasLocalRealData && hasRemoteData) {
            // Both sides have real data -> two-way merge
            console.log("Both have data. Performing safe two-way merge...");
            
            const mergedTransactions = [...data.transactions];
            let updatedRemoteTx = false;
            localTx.forEach((lt: any) => {
              if (!mergedTransactions.some(rt => rt.id === lt.id)) {
                mergedTransactions.push(lt);
                updatedRemoteTx = true;
              }
            });

            const mergedEvidences = [...data.evidences];
            let updatedRemoteEv = false;
            localEv.forEach((le: any) => {
              if (!mergedEvidences.some(re => re.id === le.id)) {
                mergedEvidences.push(le);
                updatedRemoteEv = true;
              }
            });

            const mergedRules = [...data.rules];
            let updatedRemoteRules = false;
            localRules.forEach((lr: any) => {
              if (!mergedRules.some(rr => rr.id === lr.id)) {
                mergedRules.push(lr);
                updatedRemoteRules = true;
              }
            });

            setTransactions(mergedTransactions);
            setEvidences(mergedEvidences);
            setRules(mergedRules);
            localStorage.setItem('site_transactions', JSON.stringify(mergedTransactions));
            localStorage.setItem('site_evidences', JSON.stringify(mergedEvidences));
            localStorage.setItem('site_rules', JSON.stringify(mergedRules));
            localStorage.setItem('supabase_initial_merged', 'true');
            localStorage.setItem('site_data_user_modified', 'true');

            if (updatedRemoteTx || updatedRemoteEv || updatedRemoteRules) {
              await uploadAllLocalData(mergedTransactions, mergedEvidences, mergedRules);
            }
          } else {
            // Both are empty, setup placeholders
            setTransactions(DEFAULT_TRANSACTIONS);
            setEvidences([]);
            setRules(DEFAULT_RULES);
            localStorage.setItem('site_transactions', JSON.stringify(DEFAULT_TRANSACTIONS));
            localStorage.setItem('site_evidences', JSON.stringify([]));
            localStorage.setItem('site_rules', JSON.stringify(DEFAULT_RULES));
            localStorage.setItem('supabase_initial_merged', 'true');
          }
        } else {
          // Absolute remote database source-of-truth mode (prevents resurrected deletions propagation)
          setTransactions(data.transactions);
          setEvidences(data.evidences);
          setRules(data.rules);
          localStorage.setItem('site_transactions', JSON.stringify(data.transactions));
          localStorage.setItem('site_evidences', JSON.stringify(data.evidences));
          localStorage.setItem('site_rules', JSON.stringify(data.rules));
          localStorage.setItem('site_data_user_modified', 'true');
        }
      }
    } catch (e) {
      console.warn('DB offline fetch failed:', e);
    }
  };

  // Initialize and load from localStorage
  useEffect(() => {
    const savedLogin = localStorage.getItem('site_logged_in') === 'true';
    const savedEmail = localStorage.getItem('site_user_email');
    if (savedLogin) {
      setIsLoggedIn(true);
      if (savedEmail) {
        setUserEmail(savedEmail);
      }
    }

    const savedTx = localStorage.getItem('site_transactions');
    const savedEv = localStorage.getItem('site_evidences');
    const savedRules = localStorage.getItem('site_rules');
    localStorage.setItem('userEmail', savedEmail || 'qzwxec88888@gmail.com');

    if (savedTx) {
      setTransactions(JSON.parse(savedTx));
    } else {
      setTransactions(DEFAULT_TRANSACTIONS);
      localStorage.setItem('site_transactions', JSON.stringify(DEFAULT_TRANSACTIONS));
    }

    if (savedEv) {
      setEvidences(JSON.parse(savedEv));
    } else {
      setEvidences([]);
    }

    if (savedRules) {
      setRules(JSON.parse(savedRules));
    } else {
      setRules(DEFAULT_RULES);
      localStorage.setItem('site_rules', JSON.stringify(DEFAULT_RULES));
    }

    async function syncAndLoad() {
      // 1. Fetch Supabase connection parameters from our secure server settings API
      try {
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

      // 2. Checking if credentials exist to establish active cloud flag
      const creds = getSupabaseCredentials();
      if (creds.url && creds.key) {
        setIsCloudActive(true);
        await loadSupabaseData();
      } else {
        setIsCloudActive(false);
      }
    }

    syncAndLoad();
  }, [triggerSyncCount, isLoggedIn]);

  // Supabase Real-time Sync subscription
  useEffect(() => {
    const creds = getSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return;
    }

    const client = getSupabase();
    if (!client) return;

    console.log("Subscribing to Supabase Realtime changes to sync client live...");

    // Subscribe to public database changes
    const channel = client.channel('db-raw-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('Realtime DB Event received:', payload);
          // Pull latest records automatically to sync phone and desktop live
          loadSupabaseData();
        }
      )
      .subscribe((status) => {
        console.log("Realtime Channel status:", status);
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [isCloudActive, triggerSyncCount]);

  // Save states helper on change
  const saveTransactions = (txs: Transaction[]) => {
    setTransactions(txs);
    localStorage.setItem('site_transactions', JSON.stringify(txs));
    localStorage.setItem('site_data_user_modified', 'true');
  };

  const saveEvidences = (evs: Evidence[]) => {
    setEvidences(evs);
    localStorage.setItem('site_evidences', JSON.stringify(evs));
    localStorage.setItem('site_data_user_modified', 'true');
  };

  const saveRules = (rls: Rule[]) => {
    setRules(rls);
    localStorage.setItem('site_rules', JSON.stringify(rls));
    localStorage.setItem('site_data_user_modified', 'true');
  };

  // Auth Session Handlers
  const handleLoginSuccess = (email: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    localStorage.setItem('site_logged_in', 'true');
    localStorage.setItem('site_user_email', email);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('site_logged_in', 'false');
  };

  // Password change modal states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [newPasswordValue, setNewPasswordValue] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<boolean>(false);

  const handleChangePassword = () => {
    setNewPasswordValue(localStorage.getItem('site_app_password') || '1234');
    setPasswordChangeSuccess(false);
    setIsPasswordModalOpen(true);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordValue.trim()) {
      return;
    }
    localStorage.setItem('site_app_password', newPasswordValue.trim());
    try {
      await saveAppPasswordDb(newPasswordValue.trim());
    } catch (err) {
      console.warn("Could not sync new password to Supabase:", err);
    }
    setPasswordChangeSuccess(true);
    setTimeout(() => {
      setIsPasswordModalOpen(false);
    }, 1500);
  };

  // State handlers - Transactions
  const handleAddTransaction = async (newTx: Transaction) => {
    const updated = [newTx, ...transactions];
    saveTransactions(updated);
    try {
      await upsertTransactionDb(newTx);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleAddTransactionsBulk = async (bulk: Transaction[]) => {
    const updated = [...bulk, ...transactions];
    saveTransactions(updated);
    try {
      for (const tx of bulk) {
        await upsertTransactionDb(tx);
      }
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    // If deleted, unmatch evidence side too
    const matchedEv = evidences.find(ev => ev.matchedTransactionId === id);
    if (matchedEv) {
      const updatedEvs = evidences.map(ev => 
        ev.id === matchedEv.id ? { ...ev, isMatched: false, matchedTransactionId: null } : ev
      );
      saveEvidences(updatedEvs);
      try {
        await upsertEvidenceDb({ ...matchedEv, isMatched: false, matchedTransactionId: null });
      } catch (e) {
        console.warn("DB offline save:", e);
      }
    }

    const updated = transactions.filter(t => t.id !== id);
    saveTransactions(updated);
    try {
      await deleteTransactionDb(id);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleUpdateCategory = async (id: string, category: string) => {
    const updated = transactions.map(t => t.id === id ? { ...t, category } : t);
    saveTransactions(updated);
    const target = updated.find(t => t.id === id);
    if (target) {
      try {
        await upsertTransactionDb(target);
      } catch (e) {
        console.warn("DB offline save:", e);
      }
    }
  };

  const handleUpdateMemo = async (id: string, memo: string) => {
    const updated = transactions.map(t => t.id === id ? { ...t, memo } : t);
    saveTransactions(updated);
    const target = updated.find(t => t.id === id);
    if (target) {
      try {
        await upsertTransactionDb(target);
      } catch (e) {
        console.warn("DB offline save:", e);
      }
    }
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const updated = transactions.map(t => t.id === updatedTx.id ? updatedTx : t);
    saveTransactions(updated);
    try {
      await upsertTransactionDb(updatedTx);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  // State Handlers - Evidence
  const handleAddEvidence = async (newEv: Evidence) => {
    const updated = [newEv, ...evidences];
    saveEvidences(updated);
    try {
      await upsertEvidenceDb(newEv);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    // Unmatch transaction side too
    const tx = transactions.find(t => t.evidenceId === id);
    if (tx) {
      const updatedTxs = transactions.map(t => 
        t.id === tx.id ? { ...t, evidenceId: null } : t
      );
      saveTransactions(updatedTxs);
      try {
        await upsertTransactionDb({ ...tx, evidenceId: null });
      } catch (e) {
        console.warn("DB offline save:", e);
      }
    }

    const updated = evidences.filter(e => e.id !== id);
    saveEvidences(updated);
    try {
      await deleteEvidenceDb(id);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  // Linking Handler
  const handleLinkTransaction = async (evidenceId: string, transactionId: string | null) => {
    // Unlink old connections first
    let refreshedTransactions = transactions.map(t => 
      t.evidenceId === evidenceId ? { ...t, evidenceId: null } : t
    );

    let refreshedEvidences = evidences.map(ev => 
      ev.id === evidenceId ? { ...ev, isMatched: false, matchedTransactionId: null } : ev
    );

    const oldTx = transactions.find(t => t.evidenceId === evidenceId);
    const targetEv = evidences.find(ev => ev.id === evidenceId);

    if (transactionId) {
      // Establish new connection
      refreshedTransactions = refreshedTransactions.map(t => 
        t.id === transactionId ? { ...t, evidenceId } : t
      );
      refreshedEvidences = refreshedEvidences.map(ev => 
        ev.id === evidenceId ? { ...ev, isMatched: true, matchedTransactionId: transactionId } : ev
      );
    }

    saveTransactions(refreshedTransactions);
    saveEvidences(refreshedEvidences);

    try {
      if (oldTx) {
        await upsertTransactionDb({ ...oldTx, evidenceId: null });
      }
      if (transactionId) {
        const newTx = refreshedTransactions.find(t => t.id === transactionId);
        if (newTx) await upsertTransactionDb(newTx);
      }
      if (targetEv) {
        await upsertEvidenceDb({
          ...targetEv,
          isMatched: !!transactionId,
          matchedTransactionId: transactionId
        });
      }
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleLinkEvidenceFromTable = async (transactionId: string, evidenceId: string | null) => {
    let refreshedTransactions = transactions.map(t => 
      t.id === transactionId ? { ...t, evidenceId } : t
    );

    let refreshedEvidences = evidences.map(e => {
      if (evidenceId && e.id === evidenceId) {
        return { ...e, isMatched: true, matchedTransactionId: transactionId };
      }
      if (e.matchedTransactionId === transactionId) {
        return { ...e, isMatched: false, matchedTransactionId: null };
      }
      return e;
    });

    saveTransactions(refreshedTransactions);
    saveEvidences(refreshedEvidences);

    try {
      const targetTx = refreshedTransactions.find(t => t.id === transactionId);
      if (targetTx) await upsertTransactionDb(targetTx);

      if (evidenceId) {
        const targetEv = refreshedEvidences.find(e => e.id === evidenceId);
        if (targetEv) await upsertEvidenceDb(targetEv);
      }
      
      const oldEvsToUnlink = evidences.filter(e => e.matchedTransactionId === transactionId && e.id !== evidenceId);
      for (const ev of oldEvsToUnlink) {
        await upsertEvidenceDb({ ...ev, isMatched: false, matchedTransactionId: null });
      }
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  // Auto classification engine
  const handleApplyRules = async () => {
    const updated = transactions.map(t => {
      // Find matching rule
      const matchingRule = rules.find(r => 
        t.partner.toLowerCase().includes(r.keyword.toLowerCase())
      );
      if (matchingRule) {
        return { ...t, category: matchingRule.category };
      }
      return t;
    });
    saveTransactions(updated);
    try {
      await uploadAllLocalData(updated, evidences, rules);
    } catch (e) {
      console.warn("DB offline sync failed:", e);
    }
  };

  // Automatic Evidence Transaction Matching Engine
  // Algorithm: match on exact amount, and nearest date within +/- 15 days
  const handleTriggerAutoMatch = async () => {
    let matchCount = 0;
    let tempTxs = [...transactions];
    let tempEvs = [...evidences];

    tempEvs.forEach((ev) => {
      if (ev.isMatched || !ev.ocrData) return;

      const targetAmount = ev.ocrData.amount;
      const targetDateStr = ev.ocrData.date; // "YYYY-MM-DD"
      const targetDate = new Date(targetDateStr).getTime();

      // Find an unmatched transaction with same amount
      let bestTxId: string | null = null;
      let minDayDiff = Infinity;

      tempTxs.forEach((tx) => {
        if (tx.evidenceId || tx.amount !== targetAmount) return;

        const txDate = new Date(tx.date).getTime();
        const diffDays = Math.abs(txDate - targetDate) / (1000 * 60 * 60 * 24);

        if (diffDays <= 15 && diffDays < minDayDiff) {
          minDayDiff = diffDays;
          bestTxId = tx.id;
        }
      });

      if (bestTxId) {
        // We have a match!
        matchCount++;
        ev.isMatched = true;
        ev.matchedTransactionId = bestTxId;

        tempTxs = tempTxs.map(tx => 
          tx.id === bestTxId ? { ...tx, evidenceId: ev.id } : tx
        );
      }
    });

    if (matchCount > 0) {
      saveTransactions(tempTxs);
      saveEvidences(tempEvs);
      try {
        await uploadAllLocalData(tempTxs, tempEvs, rules);
      } catch (e) {
        console.warn("DB offline sync failed:", e);
      }
    }

    return { matchedCount: matchCount };
  };

  // Rules CRUD
  const handleAddRule = async (newRule: Rule) => {
    const updated = [...rules, newRule];
    saveRules(updated);
    try {
      await upsertRuleDb(newRule);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    saveRules(updated);
    try {
      await deleteRuleDb(id);
    } catch (e) {
      console.warn("DB offline save:", e);
    }
  };

  if (!isLoggedIn) {
    return <LoginGate onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col antialiased">
      
      {/* Top Professional Admin Banner */}
      <header className="bg-indigo-950 text-white border-b border-indigo-900 shrink-0 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-900 border border-indigo-800 p-2 rounded-xl text-yellow-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight flex items-center gap-1.5 leading-none">
                <span>매입매출 증빙관리 스마트 포털</span>
                <span className="bg-indigo-900 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-indigo-800 font-mono">
                  v2.5_AI
                </span>
              </h1>
              <p className="text-[10px] text-indigo-300/85 mt-1 leading-none font-medium">
                개인 소상공인 및 소자본 창업자를 위한 OCR 전표 결합 장부
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="hidden sm:inline bg-indigo-900/60 text-indigo-250 font-mono px-3 py-1.5 rounded-lg border border-indigo-900 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-yellow-500 inline" />
              <span>사장님 로그인 마스터</span>
            </span>
            <button
              onClick={handleChangePassword}
              className="bg-indigo-900 hover:bg-indigo-850 border border-indigo-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition text-xs font-bold cursor-pointer"
              title="비밀번호 설정 변경"
            >
              <Key className="w-3.5 h-3.5 text-yellow-400" />
              <span>비번 변경</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-indigo-900 hover:bg-rose-950 border border-indigo-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition text-xs font-bold cursor-pointer shrink-0"
              title="안전 로그아웃"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* Primary Workspace Layout Wrapper */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Sidebar Drawer (md width 1/4) */}
        <aside className="md:w-64 shrink-0 space-y-4">
          <div className="bg-indigo-950 text-white rounded-2xl p-4 shadow-md space-y-2 border border-indigo-900 font-sans">
            <h3 className="text-xs font-bold text-indigo-340/80 px-2 tracking-widest uppercase mb-3">
              세무 관리 메뉴
            </h3>

            <nav className="space-y-1 text-xs">
              
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'dashboard' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>종합 분석 대시보드</span>
              </button>

              <button
                onClick={() => setActiveTab('evidence')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'evidence' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>AI 증빙 뷰 (OCR)</span>
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'transactions' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <ClipboardList className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>장부내역 및 누락 확인</span>
              </button>

              <button
                onClick={() => setActiveTab('rules')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'rules' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>자동 분류 매칭 규칙</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'reports' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>세무사 대장 내보내기</span>
              </button>

              <button
                onClick={() => setActiveTab('tax-guide')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                  activeTab === 'tax-guide' 
                    ? "bg-indigo-900 text-white border-l-4 border-yellow-400" 
                    : "text-indigo-200 hover:bg-indigo-900/40 hover:text-white"
                }`}
              >
                <HelpCircle className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>세정법 가이드 & 신고알림</span>
              </button>

              <button
                onClick={() => setActiveTab('supabase')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-extrabold transition-all text-left ${
                  activeTab === 'supabase' 
                    ? "bg-emerald-800 text-white border-l-4 border-yellow-400 shadow-sm" 
                    : "text-emerald-100 hover:bg-emerald-900/30 hover:text-white bg-emerald-950/20 border border-emerald-900/10"
                }`}
              >
                <Cloud className={`w-4 h-4 text-emerald-300 shrink-0 ${isCloudActive ? 'animate-pulse text-emerald-400' : ''}`} />
                <span className="flex items-center justify-between w-full">
                  <span>실시간 모바일 연동</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-black ${isCloudActive ? 'bg-emerald-405/20 text-emerald-300 border border-emerald-500/25' : 'bg-slate-800 text-slate-400'}`}>
                    {isCloudActive ? '연결됨' : '대기중'}
                  </span>
                </span>
              </button>

            </nav>
          </div>

          {/* Side Info card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-1.5 text-[11px] text-amber-900">
            <span className="font-bold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-amber-600 shimmer" /> 
              지출증빙 보관 의무 안내
            </span>
            <p className="leading-relaxed">
              소득세법상 사업자는 거래 건당 <strong>3만원 초과</strong> 비용 지출 시 세금계산서, 현금영수증, 정관 카드 전표 등 적격증빙 보관 의무(5년)가 발생하며 불이행 시 가산세 2% 과세가 붙으므로 누락 전표 결합에 각별한 주의가 요구됩니다.
            </p>
          </div>
        </aside>

        {/* Workspace Central Views Panel */}
        <main className="flex-1 min-w-0">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions}
              evidences={evidences}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceManager 
              evidences={evidences}
              transactions={transactions}
              onAddEvidence={handleAddEvidence}
              onDeleteEvidence={handleDeleteEvidence}
              onLinkTransaction={handleLinkTransaction}
              onTriggerAutoMatch={handleTriggerAutoMatch}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionManager 
              transactions={transactions}
              evidences={evidences}
              selectedMonth={selectedMonth}
              onAddTransaction={handleAddTransaction}
              onAddTransactionsBulk={handleAddTransactionsBulk}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateCategory={handleUpdateCategory}
              onUpdateMemo={handleUpdateMemo}
              onLinkEvidence={handleLinkEvidenceFromTable}
              onApplyRules={handleApplyRules}
              onUpdateTransaction={handleUpdateTransaction}
            />
          )}

          {activeTab === 'rules' && (
            <RuleManager 
              rules={rules}
              onAddRule={handleAddRule}
              onDeleteRule={handleDeleteRule}
              onApplyRules={handleApplyRules}
            />
          )}

           {activeTab === 'reports' && (
            <Reports 
              transactions={transactions}
              evidences={evidences}
              selectedMonth={selectedMonth}
            />
          )}

          {activeTab === 'tax-guide' && (
            <TaxGuide onNavigateToTab={setActiveTab} />
          )}

          {activeTab === 'supabase' && (
            <SupabaseSync 
              onSyncComplete={() => {
                setTriggerSyncCount(prev => prev + 1);
              }}
              transactionsCount={transactions.length}
              evidencesCount={evidences.length}
              rulesCount={rules.length}
              onUploadState={async () => {
                await uploadAllLocalData(transactions, evidences, rules);
                setTriggerSyncCount(prev => prev + 1);
              }}
              onDownloadState={async () => {
                await loadSupabaseData();
              }}
              isSynced={isCloudActive}
            />
          )}

        </main>

      </div>
      
      {/* Password Change Reactive Modal (No alert/prompt blocker) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-950 font-bold border-b border-slate-100 pb-3">
              <div className="bg-indigo-50 p-2 rounded-xl text-indigo-950">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">안전 접속 비밀번호 변경</h3>
                <p className="text-[10px] text-slate-400 font-normal">나만의 세무 포털 전용 마스터 키 재설정</p>
              </div>
            </div>

            {passwordChangeSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-250 flex items-center justify-center mx-auto animate-bounce">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-xs">비밀번호 변경 완료!</p>
                  <p className="text-[10px] text-slate-400 mt-1">다음 접속부터 새로운 비밀번호로 로그인해 주세요.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div className="space-y-1 text-xs">
                  <label className="block text-slate-700 font-bold">새로운 비밀번호 지정</label>
                  <input
                    type="text"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="새로운 비밀번호를 기입하세요"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:ring-0"
                    required
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    공란을 피해 사장님만 아는 비밀 기호를 조합해 주세요.
                  </p>
                </div>

                <div className="flex gap-2 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 rounded-xl transition"
                  >
                    닫기 / 취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-950 hover:bg-indigo-900 text-white font-extrabold py-2.5 rounded-xl transition shadow-xs"
                  >
                    새 패스워드 설정
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* Small footer copyright */}
      <footer className="bg-slate-100 border-t py-4 text-center text-xs text-slate-400 font-medium shrink-0">
        © 2026 자영업 종합 매입매출 증빙 자동화 AI 정산 시스템. Built using Gemini 3.5.
      </footer>

      {/* Floating AI Tax Assistant Bot Widget */}
      <AIChatBot 
        transactions={transactions}
        evidencesCount={evidences.length}
        rulesCount={rules.length}
      />

    </div>
  );
}
