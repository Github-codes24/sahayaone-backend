
import {
  createScheme,
  getActiveSchemes,
  getSchemeById,
  updateScheme,
  updateSchemeStatus,
} from "../services/scheme.service.js";

import {
  createSchemeSchema,
} from "../validators/scheme.validation.js";


// ==========================================
// CREATE SCHEME
// ==========================================

export const createSchemeController = async (req, res) => {
  try {
    // --------------------------------------
    // Get bank/user from authenticated context
    // --------------------------------------

    const bankId = req.society?.bankId;
    const bankOwnerId = req.society?.userId;

    if (!bankId) {
      return res.status(400).json({
        success: false,
        message: "Bank context is missing",
      });
    }

    if (!bankOwnerId) {
      return res.status(400).json({
        success: false,
        message: "Bank Owner context is missing",
      });
    }

    // --------------------------------------
    // Validate request body
    // --------------------------------------

    const { error, value } = createSchemeSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    // --------------------------------------
    // Create scheme
    // bankId and bankOwnerId come from auth
    // --------------------------------------

    const scheme = await createScheme(
      value,
      bankId,
      bankOwnerId
    );

    // --------------------------------------
    // Response
    // --------------------------------------

    return res.status(201).json({
      success: true,
      message: "SIP scheme created successfully",
      data: scheme,
    });

  } catch (error) {
    console.error("Create Scheme Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to create SIP scheme",
    });
  }
};


// ==========================================
// GET ACTIVE SCHEMES
// ==========================================

export const getActiveSchemesController = async (req, res) => {
  try {
    const bankId =
      req.society?.bankId ||
      req.query.bankId ||
      req.headers["x-bank-id"] ||
      req.headers["x-society-id"];

    const schemes = await getActiveSchemes(bankId);

    return res.status(200).json({
      success: true,
      message: "Active SIP schemes fetched successfully",
      data: schemes,
    });

  } catch (error) {
    console.error("Get Active Schemes Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to fetch SIP schemes",
    });
  }
};


// ==========================================
// GET SCHEME BY ID
// ==========================================

export const getSchemeByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const bankId =
      req.society?.bankId ||
      req.query.bankId ||
      req.headers["x-bank-id"] ||
      req.headers["x-society-id"];

    const scheme = await getSchemeById(
      id,
      bankId
    );

    return res.status(200).json({
      success: true,
      message: "SIP scheme fetched successfully",
      data: scheme,
    });

  } catch (error) {
    console.error("Get Scheme Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to fetch SIP scheme",
    });
  }
};


// ==========================================
// UPDATE SCHEME
// ==========================================

export const updateSchemeController = async (req, res) => {
  try {
    const { id } = req.params;

    const bankId = req.society?.bankId;
    const bankOwnerId = req.society?.userId;

    if (!bankId) {
      return res.status(400).json({
        success: false,
        message: "Bank context is missing",
      });
    }

    if (!bankOwnerId) {
      return res.status(400).json({
        success: false,
        message: "Bank Owner context is missing",
      });
    }

    // --------------------------------------
    // Update scheme
    // --------------------------------------

    const scheme = await updateScheme(
      id,
      req.body,
      bankId,
      bankOwnerId
    );

    return res.status(200).json({
      success: true,
      message: "SIP scheme updated successfully",
      data: scheme,
    });

  } catch (error) {
    console.error("Update Scheme Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to update SIP scheme",
    });
  }
};


// ==========================================
// UPDATE SCHEME STATUS
// ==========================================

export const updateSchemeStatusController = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    const bankId = req.society?.bankId;

    if (!bankId) {
      return res.status(400).json({
        success: false,
        message: "Bank context is missing",
      });
    }

    // --------------------------------------
    // Validate status
    // --------------------------------------

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    // --------------------------------------
    // Update status
    // --------------------------------------

    const scheme = await updateSchemeStatus(
      id,
      status,
      bankId
    );

    return res.status(200).json({
      success: true,
      message: "SIP scheme status updated successfully",
      data: scheme,
    });

  } catch (error) {
    console.error(
      "Update Scheme Status Error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Failed to update SIP scheme status",
    });
  }
};





// import {
//   createScheme,
//   getActiveSchemes,
//   getSchemeById,
//   updateScheme,
//   updateSchemeStatus,
// } from "../services/scheme.service.js";

// import {
//   createSchemeSchema,
// } from "../validators/scheme.validation.js";


// // ==========================================
// // CREATE SCHEME
// // ==========================================

// export const createSchemeController = async (req, res) => {
//   try {
//     // 1. Validate request body
//     const { error, value } = createSchemeSchema.validate(
//       req.body,
//       {
//         abortEarly: false,
//       }
//     );

//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: error.details.map((err) => err.message),
//       });
//     }

//     // 2. Create scheme using service
//     const scheme = await createScheme(value);

//     // 3. Send response
//     return res.status(201).json({
//       success: true,
//       message: "SIP scheme created successfully",
//       data: scheme,
//     });
    

//   } catch (error) {
//     console.error("Create Scheme Error:", error);

//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message:
//         error.message || "Failed to create SIP scheme",
//     });
//   }
// };


// // ==========================================
// // GET ACTIVE SCHEMES
// // ==========================================

// export const getActiveSchemesController = async (req, res) => {
//   try {
//     const schemes = await getActiveSchemes();

//     return res.status(200).json({
//       success: true,
//       message: "Active SIP schemes fetched successfully",
//       data: schemes,
//     });

//   } catch (error) {
//     console.error("Get Active Schemes Error:", error);

//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message:
//         error.message || "Failed to fetch SIP schemes",
//     });
//   }
// };


// // ==========================================
// // GET SCHEME BY ID
// // ==========================================

// export const getSchemeByIdController = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const scheme = await getSchemeById(id);

//     return res.status(200).json({
//       success: true,
//       message: "SIP scheme fetched successfully",
//       data: scheme,
//     });

//   } catch (error) {
//     console.error("Get Scheme Error:", error);

//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message:
//         error.message || "Failed to fetch SIP scheme",
//     });
//   }
// };


// // ==========================================
// // UPDATE SCHEME
// // ==========================================

// export const updateSchemeController = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const scheme = await updateScheme(
//       id,
//       req.body
//     );

//     return res.status(200).json({
//       success: true,
//       message: "SIP scheme updated successfully",
//       data: scheme,
//     });

//   } catch (error) {
//     console.error("Update Scheme Error:", error);

//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message:
//         error.message || "Failed to update SIP scheme",
//     });
//   }
// };


// // ==========================================
// // UPDATE SCHEME STATUS
// // ==========================================

// export const updateSchemeStatusController = async (
//   req,
//   res
// ) => {
//   try {
//     const { id } = req.params;

//     const { status } = req.body;

//     // Validate status
//     if (!["ACTIVE", "INACTIVE"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Status must be ACTIVE or INACTIVE",
//       });
//     }

//     const scheme = await updateSchemeStatus(
//       id,
//       status
//     );

//     return res.status(200).json({
//       success: true,
//       message: "SIP scheme status updated successfully",
//       data: scheme,
//     });

//   } catch (error) {
//     console.error(
//       "Update Scheme Status Error:",
//       error
//     );

//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message:
//         error.message ||
//         "Failed to update SIP scheme status",
//     });
//   }
// };