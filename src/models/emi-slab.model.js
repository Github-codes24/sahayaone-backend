import mongoose from 'mongoose';

const emiSlabSchema = new mongoose.Schema(
  {
    tenureMonths: {
      type: Number,
      required: true,
      unique: true
    },
    interestPercentage: {
      type: Number,
      required: true
    },
    minProductPrice: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const EmiSlab = mongoose.model('EmiSlab', emiSlabSchema);
