import { ApiError } from './api.error.js';

export class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async create(payload, session = null) {
    return this.repository.create(payload, session);
  }

  async getAll(filter = {}, projection = null, options = {}) {
    return this.repository.find(filter, projection, options);
  }

  async getById(id) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw ApiError.notFound('Requested entity record not found in system storage.');
    }
    return record;
  }

  async update(id, updateData, userId, options = {}) {
    const updatedRecord = await this.repository.updateById(id, {
      ...updateData,
      updatedBy: userId
    }, options);

    if (!updatedRecord) {
      throw ApiError.notFound('Requested record update targets a non-existent entity.');
    }
    return updatedRecord;
  }

  async delete(id) {
    const deletedRecord = await this.repository.deleteById(id);
    if (!deletedRecord) {
      throw ApiError.notFound('Requested record deletion targets a non-existent entity.');
    }
    return deletedRecord;
  }

  async softDelete(id, userId) {
    const record = await this.repository.softDelete(id, userId);
    if (!record) {
      throw ApiError.notFound('Requested record soft-deletion targets a non-existent entity.');
    }
    return record;
  }

  async getPaginated(filter = {}, options = {}) {
    return this.repository.paginate(filter, options);
  }
}
