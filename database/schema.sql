-- FINORA — DATABASE SCHEMA
-- Jalankan file ini terlebih dahulu di Supabase SQL Editor.
-- Urutan setup: schema.sql -> functions.sql -> policies.sql

-- gen_random_uuid() tersedia bawaan pada PostgreSQL 13+ (Supabase: PostgreSQL 15+).

-- =========================================================
-- PROFILES
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  currency text not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_valid
    check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_currency_supported
    check (currency = 'IDR')
);

comment on table public.profiles is 'Profil publik pengguna Finora.';

-- =========================================================
-- DEBTS & DEBT PAYMENTS
-- =========================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lender_name text not null,
  amount numeric(15, 2) not null,
  paid_amount numeric(15, 2) not null default 0,
  transaction_date date not null default current_date,
  due_date date,
  description text,
  status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debts_lender_name_valid
    check (char_length(btrim(lender_name)) between 1 and 120),
  constraint debts_amount_positive check (amount > 0),
  constraint debts_paid_amount_valid
    check (paid_amount >= 0 and paid_amount <= amount),
  constraint debts_description_length
    check (description is null or char_length(description) <= 500),
  constraint debts_status_valid
    check (status in ('unpaid', 'partial', 'paid')),
  constraint debts_due_date_valid
    check (due_date is null or due_date >= transaction_date),
  constraint debts_id_user_unique unique (id, user_id)
);

comment on table public.debts is 'Utang pribadi milik pengguna.';

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(15, 2) not null,
  payment_date date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  constraint debt_payments_amount_positive check (amount > 0),
  constraint debt_payments_description_length
    check (description is null or char_length(description) <= 500),
  constraint debt_payments_debt_owner_fkey
    foreign key (debt_id, user_id)
    references public.debts (id, user_id)
    on delete cascade
);

comment on table public.debt_payments is 'Riwayat pembayaran utang.';

-- =========================================================
-- RECEIVABLES & RECEIVABLE PAYMENTS
-- =========================================================
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  borrower_name text not null,
  amount numeric(15, 2) not null,
  received_amount numeric(15, 2) not null default 0,
  transaction_date date not null default current_date,
  due_date date,
  description text,
  status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_borrower_name_valid
    check (char_length(btrim(borrower_name)) between 1 and 120),
  constraint receivables_amount_positive check (amount > 0),
  constraint receivables_received_amount_valid
    check (received_amount >= 0 and received_amount <= amount),
  constraint receivables_description_length
    check (description is null or char_length(description) <= 500),
  constraint receivables_status_valid
    check (status in ('unpaid', 'partial', 'paid')),
  constraint receivables_due_date_valid
    check (due_date is null or due_date >= transaction_date),
  constraint receivables_id_user_unique unique (id, user_id)
);

comment on table public.receivables is 'Piutang pribadi milik pengguna.';

create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(15, 2) not null,
  payment_date date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  constraint receivable_payments_amount_positive check (amount > 0),
  constraint receivable_payments_description_length
    check (description is null or char_length(description) <= 500),
  constraint receivable_payments_owner_fkey
    foreign key (receivable_id, user_id)
    references public.receivables (id, user_id)
    on delete cascade
);

comment on table public.receivable_payments is 'Riwayat pengembalian piutang.';

-- =========================================================
-- SAVINGS & SAVINGS TRANSACTIONS
-- =========================================================
create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(15, 2) not null,
  current_amount numeric(15, 2) not null default 0,
  start_date date not null default current_date,
  target_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_name_valid
    check (char_length(btrim(name)) between 1 and 120),
  constraint savings_target_amount_positive check (target_amount > 0),
  constraint savings_current_amount_valid check (current_amount >= 0),
  constraint savings_description_length
    check (description is null or char_length(description) <= 500),
  constraint savings_target_date_valid
    check (target_date is null or target_date >= start_date),
  constraint savings_id_user_unique unique (id, user_id)
);

comment on table public.savings is 'Target tabungan milik pengguna.';

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  savings_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  amount numeric(15, 2) not null,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint savings_transactions_type_valid
    check (type in ('deposit', 'withdrawal')),
  constraint savings_transactions_amount_positive check (amount > 0),
  constraint savings_transactions_description_length
    check (description is null or char_length(description) <= 500),
  constraint savings_transactions_savings_owner_fkey
    foreign key (savings_id, user_id)
    references public.savings (id, user_id)
    on delete cascade
);

comment on table public.savings_transactions is 'Riwayat setoran dan penarikan tabungan.';

-- =========================================================
-- INDEXES
-- =========================================================
create index if not exists debts_user_date_idx
  on public.debts (user_id, transaction_date desc);
create index if not exists debts_user_status_idx
  on public.debts (user_id, status);
create index if not exists debts_user_due_date_idx
  on public.debts (user_id, due_date)
  where due_date is not null;

create index if not exists debt_payments_debt_idx
  on public.debt_payments (debt_id, payment_date desc);
create index if not exists debt_payments_user_idx
  on public.debt_payments (user_id);

create index if not exists receivables_user_date_idx
  on public.receivables (user_id, transaction_date desc);
create index if not exists receivables_user_status_idx
  on public.receivables (user_id, status);
create index if not exists receivables_user_due_date_idx
  on public.receivables (user_id, due_date)
  where due_date is not null;

create index if not exists receivable_payments_receivable_idx
  on public.receivable_payments (receivable_id, payment_date desc);
create index if not exists receivable_payments_user_idx
  on public.receivable_payments (user_id);

create index if not exists savings_user_idx
  on public.savings (user_id, created_at desc);

create index if not exists savings_transactions_savings_idx
  on public.savings_transactions (savings_id, transaction_date desc);
create index if not exists savings_transactions_user_date_idx
  on public.savings_transactions (user_id, transaction_date desc);

-- =========================================================
-- TRANSACTION HISTORY VIEW
-- =========================================================
create or replace view public.transaction_history
with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  'debt_created'::text as category,
  ('Utang kepada ' || d.lender_name)::text as title,
  coalesce(d.description, '')::text as description,
  d.amount,
  '+'::text as direction,
  d.transaction_date,
  d.created_at
from public.debts d

union all

select
  p.id,
  p.user_id,
  'debt_payment'::text as category,
  ('Pembayaran utang kepada ' || d.lender_name)::text as title,
  coalesce(p.description, '')::text as description,
  p.amount,
  '-'::text as direction,
  p.payment_date,
  p.created_at
from public.debt_payments p
join public.debts d on d.id = p.debt_id

union all

select
  r.id,
  r.user_id,
  'receivable_created'::text as category,
  ('Piutang kepada ' || r.borrower_name)::text as title,
  coalesce(r.description, '')::text as description,
  r.amount,
  '-'::text as direction,
  r.transaction_date,
  r.created_at
from public.receivables r

union all

select
  rp.id,
  rp.user_id,
  'receivable_payment'::text as category,
  ('Pengembalian piutang dari ' || r.borrower_name)::text as title,
  coalesce(rp.description, '')::text as description,
  rp.amount,
  '+'::text as direction,
  rp.payment_date,
  rp.created_at
from public.receivable_payments rp
join public.receivables r on r.id = rp.receivable_id

union all

select
  st.id,
  st.user_id,
  case
    when st.type = 'deposit' then 'savings_deposit'
    else 'savings_withdrawal'
  end::text as category,
  case
    when st.type = 'deposit' then ('Setoran tabungan ' || s.name)
    else ('Penarikan tabungan ' || s.name)
  end::text as title,
  coalesce(st.description, '')::text as description,
  st.amount,
  case when st.type = 'deposit' then '-' else '+' end::text as direction,
  st.transaction_date,
  st.created_at
from public.savings_transactions st
join public.savings s on s.id = st.savings_id;

comment on view public.transaction_history
  is 'Gabungan seluruh aktivitas keuangan pengguna untuk halaman riwayat.';
