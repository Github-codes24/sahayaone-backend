export class BaseRepository {
  constructor(model) {
    if (!model) {
      throw new Error('CRITICAL: BaseRepository cannot initialize without a Mongoose Model instance.');
    }
    this.model = model;
  }

  async create(payload, session = null) {
    const doc = new this.model(payload);
    return doc.save({ session });
  }

  async find(filter = {}, projection = null, options = {}) {
    return this.model.find(filter, projection, options).lean().exec();
  }

  async findOne(filter = {}, projection = null, options = {}) {
    return this.model.findOne(filter, projection, options).lean().exec();
  }

  async findById(id, projection = null, options = {}) {
    return this.model.findById(id, projection, options).lean().exec();
  }

  async update(filter, updateData, options = {}) {
    const mergedOptions = { new: true, runValidators: true, ...options };
    return this.model.findOneAndUpdate(filter, updateData, mergedOptions).exec();
  }

  async updateById(id, updateData, options = {}) {
    const mergedOptions = { new: true, runValidators: true, ...options };
    return this.model.findByIdAndUpdate(id, updateData, mergedOptions).exec();
  }

  async delete(filter) {
    return this.model.deleteMany(filter).exec();
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id).exec();
  }

  async softDelete(id, userId) {
    const updateData = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId
    };
    return this.model.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter).exec();
  }

  async paginate(filter = {}, options = {}) {
    const page = parseInt(options.page || '1', 10);
    const limit = parseInt(options.limit || '10', 10);
    const skip = (page - 1) * limit;
    const sort = options.sort || { createdAt: -1 };
    const populate = options.populate || '';

    let query = this.model.find(filter).sort(sort).skip(skip).limit(limit);
    
    if (populate) {
      query = query.populate(populate);
    }

    const [items, totalRecords] = await Promise.all([
      query.lean().exec(),
      this.model.countDocuments(filter).exec()
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}
