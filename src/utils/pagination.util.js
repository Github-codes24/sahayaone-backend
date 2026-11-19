export const paginationUtil = {
  parse: (query) => {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip
    };
  },

  getPaginationMeta: (totalRecords, page = 1, limit = 10) => {
    const total = Math.max(0, parseInt(totalRecords || '0', 10));
    const p = Math.max(1, parseInt(page || '1', 10));
    const l = Math.max(1, parseInt(limit || '10', 10));
    const totalPages = Math.ceil(total / l) || 1;

    return {
      totalRecords: total,
      limit: l,
      page: p,
      totalPages,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1
    };
  }
};
