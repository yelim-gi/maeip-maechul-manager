import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, Evidence, Rule } from '../types';

let supabaseClient: SupabaseClient | null = null;

// Clean base64 strings if they are too big for standard text, but Postgres handles high-volume TEXT perfectly.
// We preserve base64 to allow photo viewing on both desktop and mobile safely.

export function getSupabaseCredentials() {
  const url = localStorage.getItem('supabase_url') || '';
  const key = localStorage.getItem('supabase_anon_key') || '';
  return { url, key };
}

export function initSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) {
    supabaseClient = null;
    return null;
  }
  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    return supabaseClient;
  } catch (error) {
    console.error('Supabase initialization failed:', error);
    supabaseClient = null;
    return null;
  }
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  return initSupabase();
}

// Map helper to convert snake_case (Postgres DB) to camelCase (React/TypeScript App)
export function mapTransactionFromDb(row: any): Transaction {
  return {
    id: row.id,
    date: row.date,
    partner: row.partner,
    amount: Number(row.amount || 0),
    tax: Number(row.tax || 0),
    shippingFee: Number(row.shipping_fee || row.shippingFee || 0),
    customsFee: Number(row.customs_fee || row.customsFee || 0),
    category: row.category,
    source: row.source,
    memo: row.memo || '',
    evidenceId: row.evidence_id || row.evidenceId || null,
  };
}

export function mapTransactionToDb(test: Transaction): any {
  return {
    id: test.id,
    date: test.date,
    partner: test.partner,
    amount: test.amount,
    tax: test.tax,
    shipping_fee: test.shippingFee,
    customs_fee: test.customsFee,
    category: test.category,
    source: test.source,
    memo: test.memo,
    evidence_id: test.evidenceId,
  };
}

export function mapEvidenceFromDb(row: any): Evidence {
  return {
    id: row.id,
    fileName: row.file_name || row.fileName,
    fileType: row.file_type || row.fileType,
    fileSize: Number(row.file_size || row.fileSize || 0),
    uploadedAt: row.uploaded_at || row.uploadedAt,
    ocrData: row.ocr_data || row.ocrData || null,
    ocrStatus: row.ocr_status || row.ocrStatus || 'pending',
    isMatched: !!row.is_matched || !!row.isMatched,
    matchedTransactionId: row.matched_transaction_id || row.matchedTransactionId || null,
    fileDataUrl: row.file_data_url || row.fileDataUrl || undefined,
  };
}

export function mapEvidenceToDb(ev: Evidence): any {
  return {
    id: ev.id,
    file_name: ev.fileName,
    file_type: ev.fileType,
    file_size: ev.fileSize,
    uploaded_at: ev.uploadedAt,
    ocr_data: ev.ocrData,
    ocr_status: ev.ocrStatus,
    is_matched: ev.isMatched,
    matched_transaction_id: ev.matchedTransactionId,
    file_data_url: ev.fileDataUrl,
  };
}

export function mapRuleFromDb(row: any): Rule {
  return {
    id: row.id,
    keyword: row.keyword,
    category: row.category,
  };
}

export function mapRuleToDb(rule: Rule): any {
  return {
    id: rule.id,
    keyword: rule.keyword,
    category: rule.category,
  };
}

// Database API helper calls
export async function testConnection(url: string, key: string): Promise<boolean> {
  try {
    const tempClient = createClient(url, key);
    const { error } = await tempClient.from('rules').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, that's fine for connection test, but auth or credentials failure is key
      const status = (error as any).status;
      if (status === 401 || status === 403 || error.message.includes('API key')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Fetch all elements
export async function fetchAllData(): Promise<{
  transactions: Transaction[];
  evidences: Evidence[];
  rules: Rule[];
} | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const [txRes, evRes, ruleRes] = await Promise.all([
      client.from('transactions').select('*').order('date', { ascending: false }),
      client.from('evidences').select('*').order('uploaded_at', { ascending: false }),
      client.from('rules').select('*')
    ]);

    if (txRes.error) throw txRes.error;
    if (evRes.error) throw evRes.error;
    if (ruleRes.error) throw ruleRes.error;

    return {
      transactions: (txRes.data || []).map(mapTransactionFromDb),
      evidences: (evRes.data || []).map(mapEvidenceFromDb),
      rules: (ruleRes.data || []).map(mapRuleFromDb),
    };
  } catch (error) {
    console.error('Error fetching data from Supabase:', error);
    throw error;
  }
}

// Sync single updates
export async function upsertTransactionDb(tx: Transaction): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('transactions').upsert(mapTransactionToDb(tx));
  if (error) {
    console.error('Failed to upsert transaction:', error);
    throw error;
  }
}

export async function deleteTransactionDb(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete transaction:', error);
    throw error;
  }
}

export async function upsertEvidenceDb(ev: Evidence): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('evidences').upsert(mapEvidenceToDb(ev));
  if (error) {
    console.error('Failed to upsert evidence:', error);
    throw error;
  }
}

export async function deleteEvidenceDb(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('evidences').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete evidence:', error);
    throw error;
  }
}

export async function upsertRuleDb(rule: Rule): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('rules').upsert(mapRuleToDb(rule));
  if (error) {
    console.error('Failed to upsert rule:', error);
    throw error;
  }
}

export async function deleteRuleDb(id: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('rules').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete rule:', error);
    throw error;
  }
}

// Bulk/Sequential upsert for first-time synchronization with deep diagnostics
export async function uploadAllLocalData(
  transactions: Transaction[],
  evidences: Evidence[],
  rules: Rule[]
): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client is not configured.');

  try {
    // 1. Check for table existence first so we fail fast with a friendly message
    const { error: testErr } = await client.from('rules').select('count', { count: 'exact', head: true });
    if (testErr) {
      if (testErr.code === '42P01') {
        throw new Error('TABLES_NOT_FOUND');
      }
      if (testErr.code === '42501') {
        throw new Error('RLS_VIOLATION');
      }
      throw testErr;
    }

    // 2. Upload Rules
    if (rules.length > 0) {
      for (const rule of rules) {
        const { error } = await client.from('rules').upsert(mapRuleToDb(rule));
        if (error) {
          if (error.code === '42P01') throw new Error('TABLES_NOT_FOUND');
          if (error.code === '42501') throw new Error('RLS_VIOLATION');
          throw error;
        }
      }
    }
    
    // 3. Upload Evidences (Sequentially to prevent 413 Payload Too Large / Network Timeout with base64 images)
    if (evidences.length > 0) {
      for (const ev of evidences) {
        const { error } = await client.from('evidences').upsert(mapEvidenceToDb(ev));
        if (error) {
          if (error.code === '42P01') throw new Error('TABLES_NOT_FOUND');
          if (error.code === '42501') throw new Error('RLS_VIOLATION');
          console.warn(`Individual evidence upload failed for ID: ${ev.id}`, error);
          throw error;
        }
      }
    }

    // 4. Upload Transactions
    if (transactions.length > 0) {
      for (const tx of transactions) {
        const { error } = await client.from('transactions').upsert(mapTransactionToDb(tx));
        if (error) {
          if (error.code === '42P01') throw new Error('TABLES_NOT_FOUND');
          if (error.code === '42501') throw new Error('RLS_VIOLATION');
          console.warn(`Individual transaction upload failed for ID: ${tx.id}`, error);
          throw error;
        }
      }
    }
  } catch (error: any) {
    console.error('Bulk upload of local data failed:', error);
    
    // Convert to very clear Korean explanations
    if (error.message === 'TABLES_NOT_FOUND' || error.code === '42P01') {
      throw new Error(
        '데이터베이스 테이블이 아직 생성되지 않았습니다. 우측 2번째 패널의 파란색 [SQL 전체 복사] 버튼을 누르신 뒤, Supabase 대시보드 좌측 SQL Editor에 붙여넣고 초록색 [Run] 버튼을 반드시 누르고 와주세요!'
      );
    }
    if (error.message === 'RLS_VIOLATION' || error.code === '42501') {
      throw new Error(
        'Supabase 행 보안(RLS) 정책이 켜져 있어 업로드를 차단했습니다. SQL Editor 화면 상단 경고 표시에서 반드시 주황색 "Run without RLS (RLS 없이 실행)" 버튼을 누르시거나, SQL 스크립트를 재실행해 주세요!'
      );
    }
    if (error.status === 413 || error.message?.includes('payload too large') || error.message?.includes('413')) {
      throw new Error(
        '첨부된 영수증 사진 이미지 파일들의 전체 보관 용량이 너무 큽니다. 사진 중 화질이 비정상적으로 높은 파일이 있는지 확인해 보시고, 다시 한번 시도해 주세요.'
      );
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error(
        '인증 실패: 입력하신 Supabase URL 또는 공용 Anon Key 정보가 올바르지 않습니다. 복사 붙여넣기 시 공백 문자는 없는지 확인해 주세요.'
      );
    }
    
    throw new Error(error.message || 'Supabase 클라우드 네트워크 연결 실패가 발생했습니다.');
  }
}

// Fetch App Password from Supabase settings table if exists
export async function fetchAppPasswordDb(): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.from('settings').select('value').eq('key', 'app_password').maybeSingle();
    if (error) return null;
    return data?.value || null;
  } catch (e) {
    console.warn('Failed to fetch password from DB settings:', e);
    return null;
  }
}

// Save App Password to Supabase settings table
export async function saveAppPasswordDb(password: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from('settings').upsert({ key: 'app_password', value: password });
  } catch (e) {
    console.warn('Failed to save password to DB settings:', e);
  }
}
