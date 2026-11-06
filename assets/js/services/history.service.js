import { requireSupabase } from '../supabase.js';
import { HISTORY_GROUPS } from '../utils.js';

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
    throw error;
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  return {
    rows: data || [],
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
    throw error;
  }

  return data || [];
}
