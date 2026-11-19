import SIP from "../models/SIP.js";
import Scheme from "../models/scheme.js";


export const createCustomerSIP = async (
  customerId,
  sipData
) => {
  const {
    schemeId,
    durationMonths,
    amount,
  } = sipData;

  // ==========================================
  // 1. FIND ACTIVE SCHEME
  // ==========================================

  const scheme = await Scheme.findOne({
    _id: schemeId,
    status: "ACTIVE",
  });

  if (!scheme) {
    const error = new Error(
      "SIP scheme not found or inactive"
    );

    error.statusCode = 404;
    throw error;
  }

  // ==========================================
  // 2. FIND CUSTOMER SELECTED DURATION
  // ==========================================

  const selectedDuration =
    scheme.durationPlans.find(
      (plan) =>
        plan.durationMonths === durationMonths
    );

  if (!selectedDuration) {
    const error = new Error(
      `This scheme does not support ${durationMonths} months duration`
    );

    error.statusCode = 400;
    throw error;
  }

  // ==========================================
  // 3. VALIDATE AMOUNT
  // ==========================================

  const fixedAmountAllowed =
    scheme.allowedAmounts.includes(amount);

  const customAmountAllowed =
    scheme.customAmountEnabled === true &&
    amount >= scheme.customAmountMin &&
    amount <= scheme.customAmountMax;

  if (
    !fixedAmountAllowed &&
    !customAmountAllowed
  ) {
    const error = new Error(
      "Selected SIP amount is not allowed"
    );

    error.statusCode = 400;
    throw error;
  }

  // ==========================================
  // 4. GET BANK-DEFINED INTEREST
  // ==========================================

  const interestRate =
    selectedDuration.interestRate;

  // ==========================================
  // 5. DATE CALCULATION
  // ==========================================

  const startDate = new Date();

  const maturityDate = new Date(startDate);

  maturityDate.setMonth(
    maturityDate.getMonth() + durationMonths
  );

  const nextDueDate = new Date(startDate);

  nextDueDate.setDate(
    nextDueDate.getDate() + 1
  );

  // ==========================================
  // 6. CALCULATE TOTAL INSTALLMENTS
  // ==========================================

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const totalInstallments = Math.ceil(
    (maturityDate - startDate) /
      millisecondsPerDay
  );

  // ==========================================
  // 7. CREATE SIP
  // ==========================================

  const sip = await SIP.create({
    customerId,

    schemeId,

    schemeCode: scheme.schemeCode,

    schemeName: scheme.schemeName,

    amount,

    frequency: scheme.frequency,

    durationMonths,

    // IMPORTANT:
    // This comes from BANK configuration.
    interestRate,

    startDate,

    maturityDate,

    nextDueDate,

    totalInstallments,

    paidInstallments: 0,

    totalInvested: 0,

    totalInterestEarned: 0,

    maturityAmount: 0,

    mandateId: null,

    status: "PENDING",
  });

  return sip;
};


// ==========================================
// GET ALL SIPS FOR A CUSTOMER
// ==========================================
export const getCustomerSIPs = async (customerId) => {
  const sips = await SIP.find({ customerId })
    .populate("schemeId", "schemeCode schemeName description frequency status")
    .sort({ createdAt: -1 });

  return sips;
};


// ==========================================
// GET SPECIFIC SIP BY ID FOR CUSTOMER
// ==========================================
export const getSIPById = async (sipId, customerId) => {
  const query = { _id: sipId };
  if (customerId) {
    query.customerId = customerId;
  }

  const sip = await SIP.findOne(query)
    .populate("schemeId", "schemeCode schemeName description frequency status");

  if (!sip) {
    const error = new Error("SIP subscription not found");
    error.statusCode = 404;
    throw error;
  }

  return sip;
};