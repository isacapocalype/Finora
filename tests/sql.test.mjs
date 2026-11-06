import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

async function readSql(name) {
  return readFile(path.join(root, 'database', name), 'utf8');
}

async function runAs(userId, callback) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId
  ]);
  await db.exec('set role authenticated');

  try {
    return await callback();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

test('FINORA database schema, RLS, dan RPC keuangan', async (t) => {
  await t.test('menyiapkan Supabase auth tiruan dan menjalankan SQL project', async () => {
    await db.exec(`
      create schema auth;

      create role anon nologin;
      create role authenticated nologin;

      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb
      );

      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);

    await db.exec(await readSql('schema.sql'));
    await db.exec(await readSql('functions.sql'));
    await db.exec(await readSql('policies.sql'));
  });

  t.after(async () => {
    await db.close();
  });

  await t.test('trigger auth membuat profil dengan nama yang benar', async () => {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, $3::jsonb), ($4, $5, $6::jsonb)`,
      [
        USER_A,
        'ani@example.com',
        JSON.stringify({ full_name: 'Ani Wijaya' }),
        USER_B,
        'budi@example.com',
        JSON.stringify({})
      ]
    );

    const result = await db.query(
      'select id, full_name, currency from public.profiles order by id'
    );
    const profileA = result.rows.find((row) => row.id === USER_A);
    const profileB = result.rows.find((row) => row.id === USER_B);

    assert.equal(result.rows.length, 2);
    assert.equal(profileA.full_name, 'Ani Wijaya');
    assert.equal(profileB.full_name, 'budi');
    assert.equal(profileA.currency, 'IDR');
  });

  await t.test('constraint database menolak nominal dan tanggal tidak valid', async () => {
    await assert.rejects(
      () =>
        db.query(
          `insert into public.debts (user_id, lender_name, amount, transaction_date)
           values ($1, 'Tidak Valid', 0, '2026-01-01')`,
          [USER_A]
        ),
      /check constraint|violates/i
    );

    await assert.rejects(
      () =>
        db.query(
          `insert into public.debts (user_id, lender_name, amount, transaction_date, due_date)
           values ($1, 'Tidak Valid', 1000, '2026-02-01', '2026-01-01')`,
          [USER_A]
        ),
      /check constraint|violates/i
    );
  });

  const debtA = await db
    .query(
      `insert into public.debts (user_id, lender_name, amount, transaction_date, due_date)
       values ($1, 'Budi Santoso', 1000, '2026-01-01', '2026-02-01')
       returning id, paid_amount, status`,
      [USER_A]
    )
    .then((result) => result.rows[0]);

  const debtB = await db
    .query(
      `insert into public.debts (user_id, lender_name, amount, transaction_date)
       values ($1, 'Orang Lain', 2000, '2026-01-01')
       returning id`,
      [USER_B]
    )
    .then((result) => result.rows[0]);

  const receivableA = await db
    .query(
      `insert into public.receivables (user_id, borrower_name, amount, transaction_date)
       values ($1, 'Siti Aminah', 500, '2026-01-02')
       returning id, received_amount, status`,
      [USER_A]
    )
    .then((result) => result.rows[0]);

  const receivableB = await db
    .query(
      `insert into public.receivables (user_id, borrower_name, amount, transaction_date)
       values ($1, 'Peminjam Lain', 800, '2026-01-02')
       returning id`,
      [USER_B]
    )
    .then((result) => result.rows[0]);

  const savingsA = await db
    .query(
      `insert into public.savings (user_id, name, target_amount, start_date)
       values ($1, 'Dana Darurat', 1000, '2026-01-01')
       returning id, current_amount`,
      [USER_A]
    )
    .then((result) => result.rows[0]);

  const savingsB = await db
    .query(
      `insert into public.savings (user_id, name, target_amount, start_date)
       values ($1, 'Tabungan Lain', 1500, '2026-01-01')
       returning id`,
      [USER_B]
    )
    .then((result) => result.rows[0]);

  await t.test('trigger keuangan menghitung status awal dengan benar', () => {
    assert.equal(debtA.paid_amount, '0.00');
    assert.equal(debtA.status, 'unpaid');
    assert.equal(receivableA.received_amount, '0.00');
    assert.equal(receivableA.status, 'unpaid');
    assert.equal(savingsA.current_amount, '0.00');
  });

  await t.test('RLS mengisolasi data pengguna dan mencegah manipulasi lintas pengguna', async () => {
    await runAs(USER_A, async () => {
      const debts = await db.query(
        'select id, user_id from public.debts order by id'
      );
      assert.equal(debts.rows.length, 1);
      assert.equal(debts.rows[0].user_id, USER_A);

      const profiles = await db.query('select id from public.profiles');
      assert.equal(profiles.rows.length, 1);
      assert.equal(profiles.rows[0].id, USER_A);

      const updateOther = await db.query(
        'update public.debts set amount = 999 where id = $1 returning id',
        [debtB.id]
      );
      assert.equal(updateOther.rows.length, 0);

      const deleteOther = await db.query(
        'delete from public.debts where id = $1 returning id',
        [debtB.id]
      );
      assert.equal(deleteOther.rows.length, 0);

      const savings = await db.query('select id, user_id from public.savings');
      assert.equal(savings.rows.length, 1);
      assert.equal(savings.rows[0].user_id, USER_A);

      await assert.rejects(
        () =>
          db.query(
            `insert into public.debts (user_id, lender_name, amount, transaction_date)
             values ($1, 'Penyusup', 100, '2026-01-01')`,
            [USER_B]
          ),
        /row-level security|violates/i
      );

      await assert.rejects(
        () =>
          db.query(
            `insert into public.debt_payments (debt_id, user_id, amount, payment_date)
             values ($1, $2, 10, '2026-01-01')`,
            [debtA.id, USER_A]
          ),
        /permission denied/i
      );
    });
  });

  await t.test('role anon tidak memiliki akses ke tabel data pengguna', async () => {
    await db.exec('set role anon');

    try {
      await assert.rejects(
        () => db.query('select id from public.debts'),
        /permission denied/i
      );
      await assert.rejects(
        () => db.query('select id from public.transaction_history'),
        /permission denied/i
      );
    } finally {
      await db.exec('reset role');
    }
  });

  await t.test('RPC utang atomik memvalidasi sisa dan memperbarui status', async () => {
    await runAs(USER_A, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.record_debt_payment($1, $2, $3, $4)`,
            [debtB.id, 100, '2026-01-03', 'Lintas pengguna']
          ),
        /Utang tidak ditemukan/i
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.record_debt_payment($1, $2, $3, $4)`,
            [debtA.id, 1200, '2026-01-03', 'Melebihi sisa']
          ),
        /melebihi sisa utang/i
      );

      await db.query(
        `select public.record_debt_payment($1, $2, $3, $4)`,
        [debtA.id, 300, '2026-01-03', 'Pembayaran pertama']
      );

      let debt = await db.query(
        'select paid_amount, status from public.debts where id = $1',
        [debtA.id]
      );
      assert.equal(debt.rows[0].paid_amount, '300.00');
      assert.equal(debt.rows[0].status, 'partial');

      await db.query(
        `select public.record_debt_payment($1, $2, $3, $4)`,
        [debtA.id, 700, '2026-01-04', 'Pelunasan']
      );

      debt = await db.query(
        'select paid_amount, status from public.debts where id = $1',
        [debtA.id]
      );
      assert.equal(debt.rows[0].paid_amount, '1000.00');
      assert.equal(debt.rows[0].status, 'paid');

      await assert.rejects(
        () =>
          db.query(
            `select public.record_debt_payment($1, $2, $3, $4)`,
            [debtA.id, 1, '2026-01-05', 'Setelah lunas']
          ),
        /sudah lunas/i
      );
    });
  });

  await t.test('RPC piutang atomik memvalidasi sisa pengembalian', async () => {
    await runAs(USER_A, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.record_receivable_payment($1, $2, $3, $4)`,
            [receivableB.id, 100, '2026-01-03', 'Lintas pengguna']
          ),
        /Piutang tidak ditemukan/i
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.record_receivable_payment($1, $2, $3, $4)`,
            [receivableA.id, 600, '2026-01-03', 'Melebihi sisa']
          ),
        /melebihi sisa piutang/i
      );

      await db.query(
        `select public.record_receivable_payment($1, $2, $3, $4)`,
        [receivableA.id, 200, '2026-01-03', 'Dikembalikan sebagian']
      );

      let receivable = await db.query(
        'select received_amount, status from public.receivables where id = $1',
        [receivableA.id]
      );
      assert.equal(receivable.rows[0].received_amount, '200.00');
      assert.equal(receivable.rows[0].status, 'partial');

      await db.query(
        `select public.record_receivable_payment($1, $2, $3, $4)`,
        [receivableA.id, 300, '2026-01-04', 'Pelunasan']
      );

      receivable = await db.query(
        'select received_amount, status from public.receivables where id = $1',
        [receivableA.id]
      );
      assert.equal(receivable.rows[0].received_amount, '500.00');
      assert.equal(receivable.rows[0].status, 'paid');
    });
  });

  await t.test('RPC tabungan menjaga saldo dan menghitung ulang saldo palsu', async () => {
    await runAs(USER_A, async () => {
      await db.query(
        `select public.record_savings_transaction($1, 'deposit', $2, $3, $4)`,
        [savingsA.id, 500, '2026-01-02', 'Setoran pertama']
      );

      let savings = await db.query(
        'select current_amount from public.savings where id = $1',
        [savingsA.id]
      );
      assert.equal(savings.rows[0].current_amount, '500.00');

      await db.query(
        `select public.record_savings_transaction($1, 'withdrawal', $2, $3, $4)`,
        [savingsA.id, 200, '2026-01-03', 'Penarikan']
      );

      savings = await db.query(
        'select current_amount from public.savings where id = $1',
        [savingsA.id]
      );
      assert.equal(savings.rows[0].current_amount, '300.00');

      await assert.rejects(
        () =>
          db.query(
            `select public.record_savings_transaction($1, 'withdrawal', $2, $3, $4)`,
            [savingsA.id, 400, '2026-01-04', 'Melebihi saldo']
          ),
        /Saldo tabungan tidak mencukupi/i
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.record_savings_transaction($1, 'withdrawal', $2, $3, $4)`,
            [savingsB.id, 10, '2026-01-04', 'Lintas pengguna']
          ),
        /Tabungan tidak ditemukan/i
      );

      const forged = await db.query(
        'update public.savings set current_amount = 999 where id = $1 returning current_amount',
        [savingsA.id]
      );
      assert.equal(forged.rows[0].current_amount, '300.00');
    });
  });

  await t.test('view riwayat hanya menampilkan transaksi milik pengguna', async () => {
    await runAs(USER_A, async () => {
      const history = await db.query(
        'select user_id, category from public.transaction_history order by category'
      );
      const categories = history.rows.map((row) => row.category);

      assert.ok(history.rows.every((row) => row.user_id === USER_A));
      assert.ok(categories.includes('debt_created'));
      assert.ok(categories.includes('debt_payment'));
      assert.ok(categories.includes('receivable_created'));
      assert.ok(categories.includes('receivable_payment'));
      assert.ok(categories.includes('savings_deposit'));
      assert.ok(categories.includes('savings_withdrawal'));
    });

    await runAs(USER_B, async () => {
      const history = await db.query(
        'select user_id, category from public.transaction_history'
      );
      assert.ok(history.rows.every((row) => row.user_id === USER_B));
      assert.equal(history.rows.length, 2);
    });
  });

  await t.test('RLS aktif pada seluruh tabel data pengguna', async () => {
    const result = await db.query(`
      select relname, relrowsecurity
      from pg_class
      where relname in (
        'profiles',
        'debts',
        'debt_payments',
        'receivables',
        'receivable_payments',
        'savings',
        'savings_transactions'
      )
      order by relname
    `);

    assert.equal(result.rows.length, 7);
    assert.ok(result.rows.every((row) => row.relrowsecurity === true));
  });

});
