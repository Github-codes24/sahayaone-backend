import {
  createBankCustomerSIP,
} from "../services/bank-sip.service.js";

import {
  createSIPSchema,
} from "../validators/bank-sip.validation.js";

export const createBankCustomerSIPController = async (
  req,
  res
) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | STEP 1: Check authentication
    |--------------------------------------------------------------------------
    |
    | req.user must be created by your authentication middleware.
    |
    */

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 2: Get employee context from authenticated user
    |--------------------------------------------------------------------------
    |
    | NEVER take these values from req.body.
    |
    */

    // const employeeContext = {
    //   employeeId: req.user.id,
    //   bankId: req.user.bankId,
    //   branchId: req.user.branchId,
    // };

  const employeeContext = {
  employeeId: req.user.id,
  bankId: req.society?.bankId,
  branchId: req.society?.branchId,
  isBankOwner: req.society?.isBankOwner === true,
};

    /*
    |--------------------------------------------------------------------------
    | STEP 3: Validate employee context
    |--------------------------------------------------------------------------
    */

    if (!employeeContext.employeeId) {
      return res.status(401).json({
        success: false,
        message: "Employee not authenticated",
      });
    }

    if (!employeeContext.bankId) {
      return res.status(403).json({
        success: false,
        message: "Employee bank information not found",
      });
    }

    // if (!employeeContext.branchId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Employee branch information not found",
    //   });
    // }
    const isBankOwner = req.society?.isBankOwner;

    if (!isBankOwner && !employeeContext.branchId) {
      return res.status(403).json({
        success: false,
        message: "Employee branch information not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 4: Validate request body
    |--------------------------------------------------------------------------
    */

    const { error, value } =
      createSIPSchema.validate(
        req.body,
        {
          abortEarly: false,
          stripUnknown: true,
        }
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(
          (err) => err.message
        ),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | STEP 5: Create SIP
    |--------------------------------------------------------------------------
    |
    | Service handles:
    |
    | - Customer validation
    | - Account validation
    | - Bank scheme validation
    | - Branch context
    | - Amount validation
    | - Duration validation
    | - Interest rate
    | - SIP dates
    | - Installments
    | - SIP creation
    |
    */

    const sip = await createBankCustomerSIP(
      employeeContext,
      value
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 6: Success response
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      success: true,
      message: "SIP created successfully",
      data: sip,
    });

  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | STEP 7: Error handling
    |--------------------------------------------------------------------------
    */

    console.error(
      "Create Bank Customer SIP Error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to create SIP",
    });
  }
};