create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text not null default 'expense',
  transaction_date date not null,
  vendor text,
  title text,
  category text,
  amount numeric not null default 0,
  vat numeric default 0,
  payment_method text,
  evidence_status text default 'none',
  memo text,
  matched_document_id uuid,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  file_name text not null,
  file_type text,
  file_url text,
  doc_type text,
  vendor text,
  document_date date,
  total_amount numeric default 0,
  supply_amount numeric default 0,
  vat numeric default 0,
  shipping_fee numeric default 0,
  duty_tax numeric default 0,
  currency text default 'KRW',
  exchange_rate numeric default 1,
  extracted_json jsonb,
  status text default 'needs_review',
  created_at timestamptz default now()
);

create table if not exists vendor_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  vendor_keyword text not null,
  default_category text,
  default_type text,
  memo text,
  created_at timestamptz default now()
);

insert into vendor_rules (vendor_keyword, default_category, default_type, memo)
values
('SUPER DELIVERY', '상품매입', 'expense', '일본 도매 매입'),
('슈퍼딜리버리', '상품매입', 'expense', '일본 도매 매입'),
('우체국', '배송비', 'expense', '택배/등기'),
('관세', '관부가세', 'expense', '수입 관부가세'),
('네이버', '매출/수수료', 'income', '스마트스토어 정산')
on conflict do nothing;

alter table transactions enable row level security;
alter table documents enable row level security;
alter table vendor_rules enable row level security;

drop policy if exists "allow all transactions" on transactions;
drop policy if exists "allow all documents" on documents;
drop policy if exists "allow all vendor rules" on vendor_rules;

create policy "allow all transactions" on transactions for all using (true) with check (true);
create policy "allow all documents" on documents for all using (true) with check (true);
create policy "allow all vendor rules" on vendor_rules for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('evidence-files', 'evidence-files', true)
on conflict (id) do nothing;
