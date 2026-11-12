import { requireSupabase } from '../supabase.js';
import { HISTORY_GROUPS } from '../utils.js';
import { isOnline } from '../offline/network.js';
import { isNetworkError } from '../offline/errors.js';
import { readCachedUserRows, writeAll } from '../offline/db.js';

const VIEW = 'transaction_history';
const HISTORY_FIELDS =
  'id, user_id, category, title, description, amount, direction, transaction_date, created_at';

const SORT_OPTIONS = {
  newest: { column: 'transaction_date', ascending: false },
  oldest: { column: 'transaction_date', ascending: true },
  amount_desc: { column: 'amount', ascending: false },
  amount_asc: { column: 'amount', ascending: true }
};

function sanitizeSearchTerm(term) {
  return String(term || '')
    .trim()
    .replace(/[(),"\\]/g, ' ')
    .replace(/\s+/g, ' ');
}

export async function listHistory({
  userId,
  group = 'all',
  dateFrom = '',
  dateTo = '',
  search = '',
  sort = 'newest',
  page = 1,
  pageSize = 10
}) {
  const supabase = requireSupabase();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 10));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from(VIEW)
    .select(HISTORY_FIELDS, { count: 'exact' })
    .eq('user_id', userId);

  if (group !== 'all' && HISTORY_GROUPS[group]) {
    query = query.in('category', HISTORY_GROUPS[group]);
  }

  if (dateFrom) {
    query = query.gte('transaction_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('transaction_date', dateTo);
  }

  const searchTerm = sanitizeSearchTerm(search);

  if (searchTerm) {
    query = query.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
    );
  }

  const sortOption = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;
  query = query
    .order(sortOption.column, { ascending: sortOption.ascending })
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, VIEW)).map((row) => ({
        ...row,
        amount: Number(row.amount) || 0
      }));
      const normalizedSearch = searchTerm.toLowerCase();
      const filtered = cached.filter((row) => {
        if (group !== 'all' && HISTORY_GROUPS[group]) {
          if (!HISTORY_GROUPS[group].includes(row.category)) {
            return false;
          }
        }

        const transactionDate = String(row.transaction_date || '');

        if (dateFrom && transactionDate < dateFrom) {
          return false;
        }

        if (dateTo && transactionDate > dateTo) {
          return false;
        }

        if (normalizedSearch) {
          const haystack = `${row.title || ''} ${row.description || ''}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        }

        return true;
      });
      const sorted = [...filtered].sort((first, second) => {
        const direction = sortOption.ascending ? 1 : -1;
        const comparison =
          sortOption.column === 'amount'
            ? Number(first.amount) - Number(second.amount)
            : String(first.transaction_date || '').localeCompare(
                String(second.transaction_date || '')
              );

        if (comparison !== 0) {
          return comparison * direction;
        }

        return String(second.created_at || '').localeCompare(
          String(first.created_at || '')
        );
      });
      const totalCount = sorted.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
      const start = (safePage - 1) * safePageSize;
      const end = start + safePageSize;

      return {
        rows: sorted.slice(start, end),
        count: totalCount,
        page: safePage,
        pageSize: safePageSize,
        totalPages
      };
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(VIEW, rows);

  const totalCount = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  return {
    rows,
    count: totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages
  };
}

export async function listRecentHistory(userId, limit = 6) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(VIEW)
    .select(HISTORY_FIELDS)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = [...(await readCachedUserRows(userId, VIEW))].sort((first, second) =>
        String(second.transaction_date || '').localeCompare(String(first.transaction_date || '')) ||
        String(second.created_at || '').localeCompare(String(first.created_at || ''))
      );
      return cached.slice(0, limit);
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(VIEW, rows);

  return rows;
}
