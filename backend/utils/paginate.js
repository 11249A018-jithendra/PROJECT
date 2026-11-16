// Opt-in pagination: when the request has `?page=`, list endpoints return
// `{ items, total, page, limit, pages }`; without it they keep returning a
// plain array, so older screens keep working.
const MAX_LIMIT = 100;

const parsePage = (req, defaultLimit = 25) => {
  if (req.query.page === undefined) return null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
};

const pageResponse = (items, total, p) => ({
  items,
  total,
  page: p.page,
  limit: p.limit,
  pages: Math.max(1, Math.ceil(total / p.limit)),
});

module.exports = { parsePage, pageResponse };
