import mongoose from "mongoose";
import SIP from "../models/SIP.js";
import Scheme from "../models/scheme.js";
import { User } from "../../models/user.model.js";
import { BankAccount } from "../../models/bank-account.model.js";
import { Branch } from "../../models/branch.model.js";

/*
|--------------------------------------------------------------------------
| Helper: Create application error
|--------------------------------------------------------------------------
*/
const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/*
|--------------------------------------------------------------------------
| Helper: Validate MongoDB ObjectId
|--------------------------------------------------------------------------
*/
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/*
|--------------------------------------------------------------------------
| Helper: Calculate maturity date
|--------------------------------------------------------------------------
*/
const calculateMaturityDate = (startDate, durationMonths) => {
  const maturityDate = new Date(startDate);
  maturityDate.setMonth(maturityDate.getMonth() + Number(durationMonths));
  return maturityDate;
};

/*
|--------------------------------------------------------------------------
| Helper: Calculate total DAILY installments
|--------------------------------------------------------------------------
*/
const calculateTotalInstallments = (startDate, maturityDate) => {
  const start = new Date(startDate);
  const maturity = new Date(maturityDate);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.ceil((maturity - start) / millisecondsPerDay);
  return Math.max(totalDays, 1);
};

/*
|--------------------------------------------------------------------------
| Helper: Calculate next DAILY installment date
|--------------------------------------------------------------------------
*/
const calculateNextDueDate = (startDate) => {
  const nextDate = new Date(startDate);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate;
};

/*
|--------------------------------------------------------------------------
| CREATE SIP FOR BANK CUSTOMER
|--------------------------------------------------------------------------
*/
export const createBankCustomerSIP = async (employeeContext, sipData) => {
  /*
  |--------------------------------------------------------------------------
  | STEP 1: Authenticated context
  |--------------------------------------------------------------------------
  */
  const {
    employeeId,
    bankId,
    branchId: contextBranchId,
    isBankOwner,
  } = employeeContext || {};

  /*
  |--------------------------------------------------------------------------
  | STEP 2: Validate authenticated context
  |--------------------------------------------------------------------------
  */
  if (!employeeId) {
    throw createError("Employee information is missing", 401);
  }

  if (!bankId) {
    throw createError("Bank context is missing", 403);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 3: Validate authenticated IDs
  |--------------------------------------------------------------------------
  */
  if (!isValidObjectId(employeeId)) {
    throw createError("Invalid employee ID", 401);
  }

  if (!isValidObjectId(bankId)) {
    throw createError("Invalid bank ID", 403);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 4: Get request data
  |--------------------------------------------------------------------------
  */
  const {
    customerId,
    accountId,
    schemeId,
    branchId,
    amount,
    frequency,
    durationMonths,
  } = sipData || {};

  /*
  |--------------------------------------------------------------------------
  | STEP 5: Resolve final branch
  |--------------------------------------------------------------------------
  */
  const requestedBranchId = branchId;
  let finalBranchId;

  if (isBankOwner) {
    finalBranchId = requestedBranchId;
    if (!finalBranchId) {
      throw createError("Branch ID is required", 400);
    }
  } else {
    if (!contextBranchId) {
      throw createError("Branch context is missing", 403);
    }
    finalBranchId = contextBranchId;

    if (
      requestedBranchId &&
      String(requestedBranchId) !== String(contextBranchId)
    ) {
      throw createError("You cannot create SIP for another branch", 403);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 6: Validate final branch ID
  |--------------------------------------------------------------------------
  */
  if (!isValidObjectId(finalBranchId)) {
    throw createError("Invalid branch ID", 400);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 7: Verify branch belongs to authenticated bank
  |--------------------------------------------------------------------------
  */
  const branch = await Branch.findOne({
    _id: finalBranchId,
    bankId,
    status: "ACTIVE",
    isDeleted: { $ne: true },
  }).select("_id bankId status");

  if (!branch) {
    throw createError(
      "Branch not found, inactive, or does not belong to this bank",
      404
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 8: Validate request IDs
  |--------------------------------------------------------------------------
  */
  if (!isValidObjectId(customerId)) {
    throw createError("Invalid customer ID", 400);
  }

  if (!isValidObjectId(accountId)) {
    throw createError("Invalid account ID", 400);
  }

  if (!isValidObjectId(schemeId)) {
    throw createError("Invalid scheme ID", 400);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 9: Validate frequency
  |--------------------------------------------------------------------------
  */
  if (frequency !== "DAILY") {
    throw createError("Only DAILY SIP frequency is supported", 400);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 10: Validate duration
  |--------------------------------------------------------------------------
  */
  const validDurations = [1, 3, 6, 12];
  if (!validDurations.includes(Number(durationMonths))) {
    throw createError(
      "Invalid SIP duration. Allowed durations are 1, 3, 6 or 12 months",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 11: Validate amount
  |--------------------------------------------------------------------------
  */
  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount < 100) {
    throw createError(
      "SIP amount must be an integer greater than or equal to 100",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 12: Find customer
  |--------------------------------------------------------------------------
  */
  const customer = await User.findById(customerId).select("_id status");
  if (!customer) {
    throw createError("Customer not found", 404);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 13: Check Customer Account & KYC Status
  |--------------------------------------------------------------------------
  */
  if (customer.status !== "ACTIVE") {
    throw createError(
      "Customer account is not active or KYC is pending",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 14: Find Customer Active Bank Account
  |--------------------------------------------------------------------------
  */
  const account = await BankAccount.findOne({
    _id: accountId,
    userId: customerId,
    status: "ACTIVE",
  }).select("_id userId status");

  if (!account) {
    throw createError("Customer active bank account not found", 404);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 15: Find Active Scheme
  |--------------------------------------------------------------------------
  */
  const scheme = await Scheme.findOne({
    _id: schemeId,
    bankId,
    status: "ACTIVE",
  }).select(
    "bankId schemeCode schemeName frequency durationPlans allowedAmounts customAmountEnabled customAmountMin customAmountMax"
  );

  if (!scheme) {
    throw createError(
      "SIP scheme not found, inactive, or does not belong to this bank",
      404
    );
  }

  if (scheme.frequency !== "DAILY") {
    throw createError("Selected scheme does not support DAILY SIP", 400);
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 16: Find Selected Duration in Scheme
  |--------------------------------------------------------------------------
  */
  const selectedDuration = scheme.durationPlans?.find(
    (plan) => Number(plan.durationMonths) === Number(durationMonths)
  );

  if (!selectedDuration) {
    throw createError(
      `This scheme does not support ${durationMonths} months`,
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 17: Validate SIP Amount Against Scheme
  |--------------------------------------------------------------------------
  */
  const fixedAmountAllowed =
    Array.isArray(scheme.allowedAmounts) &&
    scheme.allowedAmounts.some(
      (allowedAmount) => Number(allowedAmount) === numericAmount
    );

  const customAmountAllowed =
    scheme.customAmountEnabled === true &&
    scheme.customAmountMin !== null &&
    scheme.customAmountMin !== undefined &&
    scheme.customAmountMax !== null &&
    scheme.customAmountMax !== undefined &&
    numericAmount >= Number(scheme.customAmountMin) &&
    numericAmount <= Number(scheme.customAmountMax);

  if (!fixedAmountAllowed && !customAmountAllowed) {
    throw createError(
      "Selected SIP amount is not allowed for this scheme",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 18: Get Interest Rate from Scheme
  |--------------------------------------------------------------------------
  */
  const interestRate = Number(selectedDuration.interestRate);
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    throw createError(
      "Invalid interest rate configured for selected scheme",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | STEP 19: Calculate SIP Dates & Installments
  |--------------------------------------------------------------------------
  */
  const startDate = new Date();
  const maturityDate = calculateMaturityDate(startDate, durationMonths);
  const nextDueDate = calculateNextDueDate(startDate);
  const totalInstallments = calculateTotalInstallments(startDate, maturityDate);

  const expectedTotalInvestment = numericAmount * totalInstallments;
  const estimatedInterest =
    expectedTotalInvestment *
    (interestRate / 100) *
    (Number(durationMonths) / 12);
  const maturityAmount = expectedTotalInvestment + estimatedInterest;

  /*
  |--------------------------------------------------------------------------
  | STEP 20: Create SIP Document
  |--------------------------------------------------------------------------
  */
  const sip = await SIP.create({
    customerId,
    accountId,
    schemeId,
    branchId: finalBranchId,
    bankId,
    schemeCode: scheme.schemeCode,
    schemeName: scheme.schemeName,
    amount: numericAmount,
    frequency: "DAILY",
    durationMonths: Number(durationMonths),
    interestRate,
    startDate,
    maturityDate,
    nextDueDate,
    totalInstallments,
    paidInstallments: 0,
    totalInvested: 0,
    totalInterestEarned: 0,
    maturityAmount,
    mandateId: null,
    createdBy: employeeId,
    status: "PENDING",
  });

  return sip;
};