-- FINORA — DATABASE FUNCTIONS, TRIGGERS & ATOMIC RPCS
-- Jalankan setelah schema.sql dan sebelum policies.sql.

-- =========================================================
-- PROFILES
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
begin
  v_full_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if v_full_name = '' then
    v_full_name := split_part(coalesce(new.email, 'pengguna'), '@', 1);
  end if;

  if char_length(v_full_name) > 120 then
    v_full_name := left(v_full_name, 120);
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, v_full_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- FINANCIAL INTEGRITY GUARDS
-- Nilai agregat selalu dihitung ulang dari tabel transaksi sehingga
-- pengguna tidak dapat memalsukan saldo, paid_amount, atau status.
-- =========================================================
create or replace function public.guard_debt_row()
returns trigger
language plpgsql
as $$
declare
  v_paid numeric(15, 2);
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.user_id <> old.user_id then
      raise exception 'Identitas utang tidak boleh diubah.';
    end if;
  end if;

  select coalesce(sum(p.amount), 0)
    into v_paid
  from public.debt_payments p
  where p.debt_id = new.id;

  new.paid_amount := v_paid;

  if new.paid_amount > new.amount then
    raise exception 'Nominal utang tidak boleh lebih kecil dari total pembayaran.';
  end if;

  if new.paid_amount <= 0 then
    new.status := 'unpaid';
  elsif new.paid_amount < new.amount then
    new.status := 'partial';
  else
    new.status := 'paid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists debts_guard on public.debts;
create trigger debts_guard
  before insert or update on public.debts
  for each row execute function public.guard_debt_row();

create or replace function public.guard_receivable_row()
returns trigger
language plpgsql
as $$
declare
  v_received numeric(15, 2);
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.user_id <> old.user_id then
      raise exception 'Identitas piutang tidak boleh diubah.';
    end if;
  end if;

  select coalesce(sum(p.amount), 0)
    into v_received
  from public.receivable_payments p
  where p.receivable_id = new.id;

  new.received_amount := v_received;

  if new.received_amount > new.amount then
    raise exception 'Nominal piutang tidak boleh lebih kecil dari total pengembalian.';
  end if;

  if new.received_amount <= 0 then
    new.status := 'unpaid';
  elsif new.received_amount < new.amount then
    new.status := 'partial';
  else
    new.status := 'paid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists receivables_guard on public.receivables;
create trigger receivables_guard
  before insert or update on public.receivables
  for each row execute function public.guard_receivable_row();

create or replace function public.guard_savings_row()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(15, 2);
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.user_id <> old.user_id then
      raise exception 'Identitas tabungan tidak boleh diubah.';
    end if;
  end if;

  select coalesce(
    sum(
      case
        when t.type = 'deposit' then t.amount
        when t.type = 'withdrawal' then -t.amount
        else 0
      end
    ),
    0
  )
    into v_balance
  from public.savings_transactions t
  where t.savings_id = new.id;

  if v_balance < 0 then
    raise exception 'Saldo tabungan tidak boleh negatif.';
  end if;

  new.current_amount := v_balance;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists savings_guard on public.savings;
create trigger savings_guard
  before insert or update on public.savings
  for each row execute function public.guard_savings_row();

-- =========================================================
-- RPC: RECORD DEBT PAYMENT
-- =========================================================
create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_payment_id uuid;
  v_amount numeric(15, 2);
  v_remaining numeric(15, 2);
begin
  if v_user_id is null then
    raise exception 'Sesi tidak valid. Silakan masuk kembali.'
      using errcode = '42501';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih besar dari nol.';
  end if;

  if v_amount > 9999999999999.99 then
    raise exception 'Nominal pembayaran terlalu besar.';
  end if;

  if p_payment_date is null then
    raise exception 'Tanggal pembayaran wajib diisi.';
  end if;

  select *
    into v_debt
  from public.debts
  where id = p_debt_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Utang tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  v_remaining := v_debt.amount - v_debt.paid_amount;

  if v_remaining <= 0 then
    raise exception 'Utang ini sudah lunas.';
  end if;

  if v_amount > v_remaining then
    raise exception 'Nominal pembayaran melebihi sisa utang.';
  end if;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    payment_date,
    description
  )
  values (
    p_debt_id,
    v_user_id,
    v_amount,
    p_payment_date,
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning id into v_payment_id;

  update public.debts
  set paid_amount = v_debt.paid_amount + v_amount,
      status = case
        when v_debt.paid_amount + v_amount >= v_debt.amount then 'paid'
        else 'partial'
      end,
      updated_at = now()
  where id = p_debt_id
    and user_id = v_user_id;

  return v_payment_id;
end;
$$;

comment on function public.record_debt_payment(uuid, numeric, date, text)
  is 'Mencatat pembayaran utang secara atomik setelah validasi sisa utang.';

-- =========================================================
-- RPC: RECORD RECEIVABLE PAYMENT
-- =========================================================
create or replace function public.record_receivable_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_receivable public.receivables%rowtype;
  v_payment_id uuid;
  v_amount numeric(15, 2);
  v_remaining numeric(15, 2);
begin
  if v_user_id is null then
    raise exception 'Sesi tidak valid. Silakan masuk kembali.'
      using errcode = '42501';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Nominal pengembalian harus lebih besar dari nol.';
  end if;

  if v_amount > 9999999999999.99 then
    raise exception 'Nominal pengembalian terlalu besar.';
  end if;

  if p_payment_date is null then
    raise exception 'Tanggal pengembalian wajib diisi.';
  end if;

  select *
    into v_receivable
  from public.receivables
  where id = p_receivable_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Piutang tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  v_remaining := v_receivable.amount - v_receivable.received_amount;

  if v_remaining <= 0 then
    raise exception 'Piutang ini sudah lunas.';
  end if;

  if v_amount > v_remaining then
    raise exception 'Nominal pengembalian melebihi sisa piutang.';
  end if;

  insert into public.receivable_payments (
    receivable_id,
    user_id,
    amount,
    payment_date,
    description
  )
  values (
    p_receivable_id,
    v_user_id,
    v_amount,
    p_payment_date,
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning id into v_payment_id;

  update public.receivables
  set received_amount = v_receivable.received_amount + v_amount,
      status = case
        when v_receivable.received_amount + v_amount >= v_receivable.amount
          then 'paid'
        else 'partial'
      end,
      updated_at = now()
  where id = p_receivable_id
    and user_id = v_user_id;

  return v_payment_id;
end;
$$;

comment on function public.record_receivable_payment(uuid, numeric, date, text)
  is 'Mencatat pengembalian piutang secara atomik setelah validasi sisa piutang.';

-- =========================================================
-- RPC: RECORD SAVINGS TRANSACTION
-- =========================================================
create or replace function public.record_savings_transaction(
  p_savings_id uuid,
  p_type text,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_savings public.savings%rowtype;
  v_transaction_id uuid;
  v_type text := lower(btrim(coalesce(p_type, '')));
  v_amount numeric(15, 2);
begin
  if v_user_id is null then
    raise exception 'Sesi tidak valid. Silakan masuk kembali.'
      using errcode = '42501';
  end if;

  if v_type not in ('deposit', 'withdrawal') then
    raise exception 'Jenis transaksi tabungan tidak valid.';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Nominal transaksi harus lebih besar dari nol.';
  end if;

  if v_amount > 9999999999999.99 then
    raise exception 'Nominal transaksi terlalu besar.';
  end if;

  if p_transaction_date is null then
    raise exception 'Tanggal transaksi wajib diisi.';
  end if;

  select *
    into v_savings
  from public.savings
  where id = p_savings_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Tabungan tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_type = 'withdrawal' and v_amount > v_savings.current_amount then
    raise exception 'Saldo tabungan tidak mencukupi untuk penarikan ini.';
  end if;

  insert into public.savings_transactions (
    savings_id,
    user_id,
    type,
    amount,
    transaction_date,
    description
  )
  values (
    p_savings_id,
    v_user_id,
    v_type,
    v_amount,
    p_transaction_date,
    nullif(btrim(coalesce(p_description, '')), '')
  )
  returning id into v_transaction_id;

  update public.savings
  set current_amount = case
        when v_type = 'deposit' then v_savings.current_amount + v_amount
        else v_savings.current_amount - v_amount
      end,
      updated_at = now()
  where id = p_savings_id
    and user_id = v_user_id;

  return v_transaction_id;
end;
$$;

comment on function public.record_savings_transaction(uuid, text, numeric, date, text)
  is 'Mencatat setoran/penarikan tabungan secara atomik dan menjaga saldo tidak negatif.';
