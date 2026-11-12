-- FINORA — ROW LEVEL SECURITY & PRIVILEGES
-- Jalankan terakhir setelah schema.sql dan functions.sql.

alter table public.profiles enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.receivables enable row level security;
alter table public.receivable_payments enable row level security;
alter table public.savings enable row level security;
alter table public.savings_transactions enable row level security;

-- =========================================================
-- PROFILES POLICIES
-- =========================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================
-- DEBTS POLICIES
-- =========================================================
drop policy if exists debts_select_own on public.debts;
create policy debts_select_own
  on public.debts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists debts_insert_own on public.debts;
create policy debts_insert_own
  on public.debts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists debts_update_own on public.debts;
create policy debts_update_own
  on public.debts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists debts_delete_own on public.debts;
create policy debts_delete_own
  on public.debts for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- DEBT PAYMENTS POLICIES
-- =========================================================
drop policy if exists debt_payments_select_own on public.debt_payments;
create policy debt_payments_select_own
  on public.debt_payments for select
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- RECEIVABLES POLICIES
-- =========================================================
drop policy if exists receivables_select_own on public.receivables;
create policy receivables_select_own
  on public.receivables for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists receivables_insert_own on public.receivables;
create policy receivables_insert_own
  on public.receivables for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists receivables_update_own on public.receivables;
create policy receivables_update_own
  on public.receivables for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists receivables_delete_own on public.receivables;
create policy receivables_delete_own
  on public.receivables for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- RECEIVABLE PAYMENTS POLICIES
-- =========================================================
drop policy if exists receivable_payments_select_own on public.receivable_payments;
create policy receivable_payments_select_own
  on public.receivable_payments for select
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- SAVINGS POLICIES
-- =========================================================
drop policy if exists savings_select_own on public.savings;
create policy savings_select_own
  on public.savings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists savings_insert_own on public.savings;
create policy savings_insert_own
  on public.savings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists savings_update_own on public.savings;
create policy savings_update_own
  on public.savings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists savings_delete_own on public.savings;
create policy savings_delete_own
  on public.savings for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- SAVINGS TRANSACTIONS POLICIES
-- =========================================================
drop policy if exists savings_transactions_select_own on public.savings_transactions;
create policy savings_transactions_select_own
  on public.savings_transactions for select
  to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- PRIVILEGES
-- Transaksi keuangan (payments & savings_transactions) hanya dapat
-- ditulis melalui RPC SECURITY DEFINER yang memvalidasi saldo.
-- =========================================================
grant usage on schema public to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

revoke all on public.debts from anon, authenticated;
grant select, insert, update, delete on public.debts to authenticated;

revoke all on public.debt_payments from anon, authenticated;
grant select on public.debt_payments to authenticated;

revoke all on public.receivables from anon, authenticated;
grant select, insert, update, delete on public.receivables to authenticated;

revoke all on public.receivable_payments from anon, authenticated;
grant select on public.receivable_payments to authenticated;

revoke all on public.savings from anon, authenticated;
grant select, insert, update, delete on public.savings to authenticated;

revoke all on public.savings_transactions from anon, authenticated;
grant select on public.savings_transactions to authenticated;

revoke all on public.transaction_history from anon, authenticated;
grant select on public.transaction_history to authenticated;

revoke all on function public.record_debt_payment(uuid, numeric, date, text, uuid) from public;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, uuid) to authenticated;

revoke all on function public.record_receivable_payment(uuid, numeric, date, text, uuid) from public;
grant execute on function public.record_receivable_payment(uuid, numeric, date, text, uuid) to authenticated;

revoke all on function public.record_savings_transaction(uuid, text, numeric, date, text, uuid) from public;
grant execute on function public.record_savings_transaction(uuid, text, numeric, date, text, uuid) to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.guard_debt_row() from public;
revoke all on function public.guard_receivable_row() from public;
revoke all on function public.guard_savings_row() from public;
