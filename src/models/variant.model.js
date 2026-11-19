import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      required: true,
      trim: true,
      default: 'Default'
    },
    storage: {
      type: String,
      required: true,
      trim: true,
      default: 'Default'
    },
    warranty: {
      type: String,
      required: true,
      trim: true,
      default: '1 Year'
    },
    image: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

variantSchema.plugin(softDeletePlugin);

export const Variant = mongoose.model('Variant', variantSchema);
