import mongoose from 'mongoose';

const priceSettingSchema = new mongoose.Schema(
  {
    emiCardPriceForBank: {
      type: Number,
      required: true,
      default: 499,
      min: 0
    },
    emiCardMinPurchaseQuantity: {
      type: Number,
      required: true,
      default: 100,
      min: 1
    },
    verificationCreditPriceForBank: {
      type: Number,
      required: true,
      default: 50,
      min: 0
    },
    verificationCreditMinPurchaseQuantity: {
      type: Number,
      required: true,
      default: 200,
      min: 1
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

export const PriceSetting = mongoose.model('PriceSetting', priceSettingSchema);
