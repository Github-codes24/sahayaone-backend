import mongoose from "mongoose";

const durationPlanSchema = new mongoose.Schema(
  {
    durationMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      required: true,
    },

    interestRate: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const schemeSchema = new mongoose.Schema(
  {
    // Bank that owns this scheme
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },

    // Bank Owner who created this scheme
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // change this if your Bank Owner model has another name
      required: true,
      index: true,
    },

    schemeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    schemeName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    frequency: {
      type: String,
      enum: ["DAILY"],
      default: "DAILY",
    },

    durationPlans: {
      type: [durationPlanSchema],
      required: true,
      validate: {
        validator: function (plans) {
          return plans.length > 0;
        },
        message: "At least one duration plan is required",
      },
    },

    allowedAmounts: {
      type: [Number],
      required: true,
      validate: {
        validator: function (amounts) {
          return amounts.length > 0;
        },
        message: "At least one SIP amount is required",
      },
    },

    customAmountEnabled: {
      type: Boolean,
      default: true,
    },

    customAmountMin: {
      type: Number,
      default: 5000,
      min: 5000,
    },

    customAmountMax: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const Scheme = mongoose.model("Scheme", schemeSchema);

export default Scheme;
