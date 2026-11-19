import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

export const BannerPortalType = Object.freeze({
  ONBOARDING_APP: 'ONBOARDING_APP',
  EXECUTIVE_APP: 'EXECUTIVE_APP',
  CUSTOMER_APP: 'CUSTOMER_APP'
});

const bannerSchema = new mongoose.Schema(
  {
    portalType: {
      type: String,
      required: true,
      enum: Object.values(BannerPortalType),
      uppercase: true,
      trim: true,
      index: true
    },
    bannerType: {
      type: String,
      required: true,
      trim: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    imageKey: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
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

bannerSchema.plugin(softDeletePlugin);

export const Banner = mongoose.model('Banner', bannerSchema);
