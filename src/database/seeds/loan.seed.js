import { User } from '../../models/user.model.js';
import { Variant } from '../../models/variant.model.js';
import { Loan } from '../../models/loan.model.js';
import { logger } from '../../utils/logger.util.js';

const getMonthName = (date) => {
  return date.toLocaleString('default', { month: 'long' });
};

const makeDateOffset = (monthsOffset) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOffset);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function seedLoan() {
  logger.info('SEEDER: Seeding Customer Loan & EMI installment resources...');

  // 1. Clear existing loans
  await Loan.deleteMany({});

  // 2. Locate Postman test customer
  const testPhone = '9876543210';
  const user = await User.findOne({ phoneNumber: testPhone });

  if (!user) {
    logger.warn(`SEEDER WARNING: Could not seed loans. Customer user ${testPhone} was not found.`);
    return;
  }

  // 3. Locate active variants
  const sageVariant = await Variant.findOne({ color: 'Sage' }) || await Variant.findOne({});
  const tealVariant = await Variant.findOne({ color: 'Teal' }) || await Variant.findOne({});
  const blackVariant = await Variant.findOne({ color: 'Black' }) || await Variant.findOne({});
  const lavenderVariant = await Variant.findOne({ color: 'Lavender' }) || await Variant.findOne({});

  if (!sageVariant || !tealVariant || !blackVariant || !lavenderVariant) {
    logger.warn('SEEDER WARNING: Product variants must be seeded first to link loans.');
    return;
  }

  // ==========================================
  // LOAN 1: New Application (status: NEW)
  // ==========================================
  const loan1Price = sageVariant.price || 94999;
  const loan1TotalAmount = loan1Price + 1500 + 1200;
  const loan1DownPayment = 24999;
  const loan1NetLoan = loan1TotalAmount - loan1DownPayment;
  const loan1Payable = loan1NetLoan + 1600 + 1000;
  const loan1EmiAmount = Math.round(loan1Payable / 6);

  const schedule1 = [];
  for (let i = 0; i < 6; i++) {
    const dueDate = makeDateOffset(i);
    schedule1.push({
      monthName: getMonthName(dueDate),
      amount: loan1EmiAmount,
      dueDate,
      status: 'UPCOMING'
    });
  }

  await Loan.create({
    applicationId: 'APPL5655946',
    customerId: user._id,
    variantId: sageVariant._id,
    status: 'NEW',
    disbursedAt: null,
    productPrice: loan1Price,
    emiCardCharges: 1500,
    processingFees: 1200,
    totalAmount: loan1TotalAmount,
    downPayment: loan1DownPayment,
    totalLoanAmount: loan1NetLoan,
    interestAmount: 1600,
    insuranceAmount: 1000,
    totalPayableAmount: loan1Payable,
    emiAmount: loan1EmiAmount,
    tenureMonths: 6,
    paidEmisCount: 0,
    outstandingAmount: loan1Payable,
    nextEmiDueDate: makeDateOffset(0),
    schedule: schedule1
  });

  // ==========================================
  // LOAN 2: Active Loan (status: ACTIVE, 3 of 6 EMIs Paid)
  // ==========================================
  const loan2Price = tealVariant.price || 79999;
  const loan2TotalAmount = loan2Price + 1500 + 1200;
  const loan2DownPayment = 22700;
  const loan2NetLoan = loan2TotalAmount - loan2DownPayment;
  const loan2Payable = loan2NetLoan + 1600 + 1000;
  const loan2EmiAmount = Math.round(loan2Payable / 6);

  const schedule2 = [];
  for (let i = -3; i < 3; i++) {
    const dueDate = makeDateOffset(i);
    let status = 'UPCOMING';
    let paidAt = null;

    if (i < 0) {
      status = 'PAID';
      paidAt = new Date(dueDate);
      paidAt.setDate(5); // Paid on 5th of that month
    } else if (i === 0) {
      status = 'DUE';
    }

    schedule2.push({
      monthName: getMonthName(dueDate),
      amount: loan2EmiAmount,
      dueDate,
      status,
      paidAt
    });
  }

  await Loan.create({
    applicationId: 'APPL1928374',
    customerId: user._id,
    variantId: tealVariant._id,
    status: 'ACTIVE',
    disbursedAt: makeDateOffset(-3),
    productPrice: loan2Price,
    emiCardCharges: 1500,
    processingFees: 1200,
    totalAmount: loan2TotalAmount,
    downPayment: loan2DownPayment,
    totalLoanAmount: loan2NetLoan,
    interestAmount: 1600,
    insuranceAmount: 1000,
    totalPayableAmount: loan2Payable,
    emiAmount: loan2EmiAmount,
    tenureMonths: 6,
    paidEmisCount: 3,
    outstandingAmount: loan2Payable - (loan2EmiAmount * 3),
    nextEmiDueDate: makeDateOffset(0),
    schedule: schedule2
  });

  // ==========================================
  // LOAN 3: Completed Loan (status: COMPLETED)
  // ==========================================
  const loan3Price = blackVariant.price || 79999;
  const loan3TotalAmount = loan3Price + 1500 + 1200;
  const loan3DownPayment = 22700;
  const loan3NetLoan = loan3TotalAmount - loan3DownPayment;
  const loan3Payable = loan3NetLoan + 1600 + 1000;
  const loan3EmiAmount = Math.round(loan3Payable / 6);

  const schedule3 = [];
  for (let i = -6; i < 0; i++) {
    const dueDate = makeDateOffset(i);
    const paidAt = new Date(dueDate);
    paidAt.setDate(5);
    schedule3.push({
      monthName: getMonthName(dueDate),
      amount: loan3EmiAmount,
      dueDate,
      status: 'PAID',
      paidAt
    });
  }

  await Loan.create({
    applicationId: 'APPL8273948',
    customerId: user._id,
    variantId: blackVariant._id,
    status: 'COMPLETED',
    disbursedAt: makeDateOffset(-6),
    productPrice: loan3Price,
    emiCardCharges: 1500,
    processingFees: 1200,
    totalAmount: loan3TotalAmount,
    downPayment: loan3DownPayment,
    totalLoanAmount: loan3NetLoan,
    interestAmount: 1600,
    insuranceAmount: 1000,
    totalPayableAmount: loan3Payable,
    emiAmount: loan3EmiAmount,
    tenureMonths: 6,
    paidEmisCount: 6,
    outstandingAmount: 0,
    nextEmiDueDate: null,
    nocKey: 'noc/customer_9876543210_appl8273948.pdf',
    schedule: schedule3
  });

  // ==========================================
  // LOAN 4: Rejected Loan (status: REJECTED)
  // ==========================================
  const loan4Price = lavenderVariant.price || 94999;
  const loan4TotalAmount = loan4Price + 1500 + 1200;
  const loan4DownPayment = 24999;
  const loan4NetLoan = loan4TotalAmount - loan4DownPayment;
  const loan4Payable = loan4NetLoan + 1600 + 1000;
  const loan4EmiAmount = Math.round(loan4Payable / 6);

  await Loan.create({
    applicationId: 'APPL9482710',
    customerId: user._id,
    variantId: lavenderVariant._id,
    status: 'REJECTED',
    disbursedAt: null,
    productPrice: loan4Price,
    emiCardCharges: 1500,
    processingFees: 1200,
    totalAmount: loan4TotalAmount,
    downPayment: loan4DownPayment,
    totalLoanAmount: loan4NetLoan,
    interestAmount: 1600,
    insuranceAmount: 1000,
    totalPayableAmount: loan4Payable,
    emiAmount: loan4EmiAmount,
    tenureMonths: 6,
    paidEmisCount: 0,
    outstandingAmount: loan4Payable,
    nextEmiDueDate: null,
    schedule: []
  });

  logger.info('SEEDER: Successfully seeded 4 customer loan records.');
}
