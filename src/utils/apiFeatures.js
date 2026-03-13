/**
 * API Features class for pagination, filtering, sorting, and field limiting
 * Enhanced with pagination metadata support
 */
export class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString || {};
    this.page = 1;
    this.limit = 30;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v -password');
    }
    return this;
  }

  paginate() {
    this.page = this.queryString.page * 1 || 1;
    this.limit = this.queryString.limit * 1 || 30;
    const skip = (this.page - 1) * this.limit;

    this.query = this.query.skip(skip).limit(this.limit);
    return this;
  }

  /**
   * Execute the query and return results with pagination metadata
   * @returns {Promise<{data: Array, pagination: {page: number, limit: number, total: number, pages: number}}>}
   */
  async execute() {
    // Clone query for count (before skip/limit)
    const countQuery = this.query.model.find(this.query.getFilter());
    const total = await countQuery.countDocuments();

    // Execute the main query
    const data = await this.query;

    return {
      data,
      pagination: {
        page: this.page,
        limit: this.limit,
        total,
        pages: Math.ceil(total / this.limit),
      },
    };
  }
}
