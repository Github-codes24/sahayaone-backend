
import mongoose from "mongoose";
import Scheme from "../models/scheme.js";


// =====================================================
// CREATE SCHEME
// =====================================================

export const createScheme = async (schemeData, bankId, bankOwnerId) => {
  const {
    schemeCode,
    schemeName,
    description,
    frequency,
    durationPlans,
    allowedAmounts,
    customAmountEnabled,
    customAmountMin,
    customAmountMax,
    status,
  } = schemeData;

  // ---------------------------------------------
  // Validate Bank ID
  // ---------------------------------------------

  if (!bankId) {
    const error = new Error("Bank ID is required");
    error.statusCode = 400;
    throw error;
  }

  // ---------------------------------------------
  // Validate Bank Owner
  // ---------------------------------------------

  if (!bankOwnerId) {
    const error = new Error("Bank Owner ID is required");
    error.statusCode = 400;
    throw error;
  }

  // ---------------------------------------------
  // Normalize scheme code
  // ---------------------------------------------

  const normalizedSchemeCode = schemeCode.toUpperCase();

  // ---------------------------------------------
  // Check duplicate scheme code
  // Only inside this bank
  // ---------------------------------------------

  const existingScheme = await Scheme.findOne({
    bankId,
    schemeCode: normalizedSchemeCode,
  });

  if (existingScheme) {
    const error = new Error(
      `Scheme with code ${normalizedSchemeCode} already exists for this bank`
    );

    error.statusCode = 409;
    throw error;
  }

  // ---------------------------------------------
  // Check duplicate duration
  // ---------------------------------------------

  const durations = durationPlans.map(
    (plan) => plan.durationMonths
  );

  if (new Set(durations).size !== durations.length) {
    const error = new Error(
      "Duplicate duration is not allowed"
    );

    error.statusCode = 400;
    throw error;
  }

  // ---------------------------------------------
  // Validate custom amount
  // ---------------------------------------------

  if (customAmountEnabled) {
    if (
      customAmountMin === undefined ||
      customAmountMin === null
    ) {
      const error = new Error(
        "Custom amount minimum is required"
      );

      error.statusCode = 400;
      throw error;
    }

    if (
      customAmountMax === undefined ||
      customAmountMax === null
    ) {
      const error = new Error(
        "Custom amount maximum is required"
      );

      error.statusCode = 400;
      throw error;
    }

    if (customAmountMax <= customAmountMin) {
      const error = new Error(
        "Custom amount maximum must be greater than minimum"
      );

      error.statusCode = 400;
      throw error;
    }
  }

  // ---------------------------------------------
  // Create Scheme
  // ---------------------------------------------

  const scheme = await Scheme.create({
    bankId,
    createdBy: bankOwnerId,

    schemeCode: normalizedSchemeCode,
    schemeName,
    description,
    frequency,
    durationPlans,
    allowedAmounts,
    customAmountEnabled,
    customAmountMin,
    customAmountMax,
    status,
  });

  return scheme;
};


// =====================================================
// GET ACTIVE SCHEMES
// =====================================================

export const getActiveSchemes = async (bankId) => {
  const filter = { status: "ACTIVE" };
  if (bankId) {
    filter.bankId = bankId;
  }

  const schemes = await Scheme.find(filter).sort({
    createdAt: -1,
  });

  return schemes;
};


// =====================================================
// GET SCHEME BY ID
// =====================================================

export const getSchemeById = async (
  schemeId,
  bankId
) => {
  if (!mongoose.Types.ObjectId.isValid(schemeId)) {
    const error = new Error("Invalid scheme ID");
    error.statusCode = 400;
    throw error;
  }

  const filter = { _id: schemeId };
  if (bankId) {
    filter.bankId = bankId;
  }

  const scheme = await Scheme.findOne(filter);

  if (!scheme) {
    const error = new Error("Scheme not found");
    error.statusCode = 404;
    throw error;
  }

  return scheme;
};


// =====================================================
// UPDATE SCHEME
// =====================================================

export const updateScheme = async (
  schemeId,
  updateData,
  bankId,
  bankOwnerId
) => {
  // ---------------------------------------------
  // Validate Scheme ID
  // ---------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(schemeId)) {
    const error = new Error("Invalid scheme ID");
    error.statusCode = 400;
    throw error;
  }

  // ---------------------------------------------
  // Find scheme ONLY inside owner's bank
  // ---------------------------------------------

  const scheme = await Scheme.findOne({
    _id: schemeId,
    bankId,
  });

  if (!scheme) {
    const error = new Error("Scheme not found");
    error.statusCode = 404;
    throw error;
  }

  // ---------------------------------------------
  // Prevent changing ownership
  // ---------------------------------------------

  delete updateData.bankId;
  delete updateData.createdBy;

  // ---------------------------------------------
  // If scheme code is being updated
  // ---------------------------------------------

  if (updateData.schemeCode) {
    updateData.schemeCode =
      updateData.schemeCode.toUpperCase();

    const duplicateScheme = await Scheme.findOne({
      bankId,
      schemeCode: updateData.schemeCode,
      _id: { $ne: schemeId },
    });

    if (duplicateScheme) {
      const error = new Error(
        `Scheme with code ${updateData.schemeCode} already exists for this bank`
      );

      error.statusCode = 409;
      throw error;
    }
  }

  // ---------------------------------------------
  // Validate duration plans
  // ---------------------------------------------

  if (updateData.durationPlans) {
    const durations = updateData.durationPlans.map(
      (plan) => plan.durationMonths
    );

    if (new Set(durations).size !== durations.length) {
      const error = new Error(
        "Duplicate duration is not allowed"
      );

      error.statusCode = 400;
      throw error;
    }
  }

  // ---------------------------------------------
  // Validate custom amount
  // ---------------------------------------------

  const customEnabled =
    updateData.customAmountEnabled !== undefined
      ? updateData.customAmountEnabled
      : scheme.customAmountEnabled;

  const customMin =
    updateData.customAmountMin !== undefined
      ? updateData.customAmountMin
      : scheme.customAmountMin;

  const customMax =
    updateData.customAmountMax !== undefined
      ? updateData.customAmountMax
      : scheme.customAmountMax;

  if (customEnabled) {
    if (
      customMin === undefined ||
      customMin === null
    ) {
      const error = new Error(
        "Custom amount minimum is required"
      );

      error.statusCode = 400;
      throw error;
    }

    if (
      customMax === undefined ||
      customMax === null
    ) {
      const error = new Error(
        "Custom amount maximum is required"
      );

      error.statusCode = 400;
      throw error;
    }

    if (customMax <= customMin) {
      const error = new Error(
        "Custom amount maximum must be greater than minimum"
      );

      error.statusCode = 400;
      throw error;
    }
  }

  // ---------------------------------------------
  // Apply update
  // ---------------------------------------------

  Object.assign(scheme, updateData);

  // Keep ownership unchanged
  scheme.bankId = bankId;

  // Optional: track latest updater
  // Only use this if your model has updatedBy
  // scheme.updatedBy = bankOwnerId;

  await scheme.save();

  return scheme;
};


// =====================================================
// UPDATE SCHEME STATUS
// =====================================================

export const updateSchemeStatus = async (
  schemeId,
  status,
  bankId
) => {
  // ---------------------------------------------
  // Validate Scheme ID
  // ---------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(schemeId)) {
    const error = new Error("Invalid scheme ID");
    error.statusCode = 400;
    throw error;
  }

  // ---------------------------------------------
  // Find scheme inside current bank only
  // ---------------------------------------------

  const scheme = await Scheme.findOne({
    _id: schemeId,
    bankId,
  });

  if (!scheme) {
    const error = new Error("Scheme not found");
    error.statusCode = 404;
    throw error;
  }

  // ---------------------------------------------
  // Validate status
  // ---------------------------------------------

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    const error = new Error(
      "Status must be ACTIVE or INACTIVE"
    );

    error.statusCode = 400;
    throw error;
  }

  scheme.status = status;

  await scheme.save();

  return scheme;
};










// import Scheme from "../models/scheme.js";

// export const createScheme = async (schemeData) => {
//   const {
//     schemeCode,
//     schemeName,
//     description,
//     frequency,
//     durationPlans,
//     allowedAmounts,
//     customAmountEnabled,
//     customAmountMin,
//     customAmountMax,
//     status,
//   } = schemeData;

//   const existingScheme = await Scheme.findOne({
//     schemeCode: schemeCode.toUpperCase(),
//   });

//   if (existingScheme) {
//     const error = new Error(
//       `Scheme with code ${schemeCode} already exists`
//     );

//     error.statusCode = 409;
//     throw error;
//   }

//   const durations = durationPlans.map(
//     (plan) => plan.durationMonths
//   );

//   if (new Set(durations).size !== durations.length) {
//     const error = new Error(
//       "Duplicate duration is not allowed"
//     );

//     error.statusCode = 400;
//     throw error;
//   }

//   const scheme = await Scheme.create({
//     schemeCode: schemeCode.toUpperCase(),
//     schemeName,
//     description,
//     frequency,
//     durationPlans,
//     allowedAmounts,
//     customAmountEnabled,
//     customAmountMin,
//     customAmountMax,
//     status,
//   });

//   return scheme;
// };


// // GET ACTIVE SCHEMES
// export const getActiveSchemes = async () => {
//   const schemes = await Scheme.find({
//     status: "ACTIVE",
//   }).sort({
//     createdAt: -1,
//   });

//   return schemes;
// };


// // GET SCHEME BY ID
// export const getSchemeById = async (schemeId) => {
//   const scheme = await Scheme.findById(schemeId);

//   if (!scheme) {
//     const error = new Error("Scheme not found");

//     error.statusCode = 404;
//     throw error;
//   }

//   return scheme;
// };


// // UPDATE SCHEME
// export const updateScheme = async (
//   schemeId,
//   updateData
// ) => {
//   const scheme = await Scheme.findById(schemeId);

//   if (!scheme) {
//     const error = new Error("Scheme not found");

//     error.statusCode = 404;
//     throw error;
//   }

//   if (updateData.durationPlans) {
//     const durations = updateData.durationPlans.map(
//       (plan) => plan.durationMonths
//     );

//     if (new Set(durations).size !== durations.length) {
//       const error = new Error(
//         "Duplicate duration is not allowed"
//       );

//       error.statusCode = 400;
//       throw error;
//     }
//   }

//   Object.assign(scheme, updateData);

//   await scheme.save();

//   return scheme;
// };



// // UPDATE SCHEME STATUS
// export const updateSchemeStatus = async (
//   schemeId,
//   status
// ) => {
//   const scheme = await Scheme.findById(schemeId);

//   if (!scheme) {
//     const error = new Error("Scheme not found");

//     error.statusCode = 404;
//     throw error;
//   }

//   scheme.status = status;

//   await scheme.save();

//   return scheme;
// };