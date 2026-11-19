import { ApiError } from '../../../../common/api.error.js';
import Vendor from '../models/vendor.model.js';
import Asset from '../models/Itemsasset.model.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class VendorService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  async createVendor(context, payload) {
    const scope = this.buildSocietyScope(context);
    const codeUpper = payload.code.toUpperCase();

    const existingCode = await Vendor.findOne({
      societyId: scope.societyId,
      code: codeUpper
    });
    if (existingCode) {
      throw ApiError.conflict(`Vendor with code [${codeUpper}] already exists.`);
    }

    if (payload.gstNumber && payload.gstNumber.trim() !== '') {
      const gstUpper = payload.gstNumber.trim().toUpperCase();
      const existingGst = await Vendor.findOne({
        societyId: scope.societyId,
        gstNumber: gstUpper
      });
      if (existingGst) {
        throw ApiError.conflict(`Vendor with GST Number [${gstUpper}] already exists.`);
      }
    }

    const vendor = await Vendor.create({
      societyId: scope.societyId,
      name: payload.name,
      code: codeUpper,
      contactPerson: payload.contactPerson || '',
      phone: payload.phone || '',
      email: payload.email || '',
      address: payload.address || '',
      gstNumber: payload.gstNumber ? payload.gstNumber.trim().toUpperCase() : ''
    });

    return vendor;
  }

  async getVendorById(context, vendorId) {
    const scope = this.buildSocietyScope(context);
    const vendor = await Vendor.findOne({ _id: vendorId, societyId: scope.societyId }).lean();
    if (!vendor) {
      throw ApiError.notFound('Vendor not found for this society.');
    }
    return vendor;
  }

  async updateVendor(context, vendorId, payload) {
    const scope = this.buildSocietyScope(context);
    const vendor = await Vendor.findOne({ _id: vendorId, societyId: scope.societyId });
    if (!vendor) {
      throw ApiError.notFound('Vendor not found for this society.');
    }

    if (payload.code) {
      const codeUpper = payload.code.toUpperCase();
      const existingCode = await Vendor.findOne({
        societyId: scope.societyId,
        code: codeUpper,
        _id: { $ne: vendorId }
      });
      if (existingCode) {
        throw ApiError.conflict(`Vendor with code [${codeUpper}] already exists.`);
      }
      vendor.code = codeUpper;
    }

    if (payload.gstNumber !== undefined) {
      const gstTrimmed = (payload.gstNumber || '').trim().toUpperCase();
      if (gstTrimmed !== '') {
        const existingGst = await Vendor.findOne({
          societyId: scope.societyId,
          gstNumber: gstTrimmed,
          _id: { $ne: vendorId }
        });
        if (existingGst) {
          throw ApiError.conflict(`Vendor with GST Number [${gstTrimmed}] already exists.`);
        }
      }
      vendor.gstNumber = gstTrimmed;
    }

    if (payload.name !== undefined) vendor.name = payload.name;
    if (payload.contactPerson !== undefined) vendor.contactPerson = payload.contactPerson;
    if (payload.phone !== undefined) vendor.phone = payload.phone;
    if (payload.email !== undefined) vendor.email = payload.email;
    if (payload.address !== undefined) vendor.address = payload.address;
    if (payload.status !== undefined) vendor.status = payload.status;

    await vendor.save();
    return vendor;
  }

  async deleteVendor(context, vendorId) {
    const scope = this.buildSocietyScope(context);
    const vendor = await Vendor.findOne({ _id: vendorId, societyId: scope.societyId });
    if (!vendor) {
      throw ApiError.notFound('Vendor not found for this society.');
    }

    const assetCount = await Asset.countDocuments({ vendorId, societyId: scope.societyId });
    if (assetCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete Vendor [${vendor.name}] because ${assetCount} registered asset(s) are linked to this vendor. Deactivate the vendor instead.`
      );
    }

    await Vendor.findByIdAndDelete(vendorId);
    return { id: vendorId, deleted: true, message: `Vendor [${vendor.name}] deleted successfully.` };
  }

  async listVendors(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(query.search), 'i') },
        { code: new RegExp(escapeRegex(query.search), 'i') },
        { contactPerson: new RegExp(escapeRegex(query.search), 'i') },
        { phone: new RegExp(escapeRegex(query.search), 'i') },
        { gstNumber: new RegExp(escapeRegex(query.search), 'i') }
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      Vendor.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
      Vendor.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }
}

export const vendorService = new VendorService();

