import mongoose from 'mongoose';
import softDeletePlugin from '../../../../database/plugins/soft-delete.plugin.js';

const societyInventorySchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true
    },
    assets: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

societyInventorySchema.index(
  { bankId: 1, branchId: 1, assets: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
societyInventorySchema.index({ bankId: 1, branchId: 1, createdAt: -1 });
societyInventorySchema.plugin(softDeletePlugin);

export const SocietyInventory =
  mongoose.models.SocietyInventory || mongoose.model('SocietyInventory', societyInventorySchema);

export default SocietyInventory;
