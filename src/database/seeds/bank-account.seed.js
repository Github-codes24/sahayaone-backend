import { User } from '../../models/user.model.js';
import { BankAccount } from '../../models/bank-account.model.js';
import { logger } from '../../utils/logger.util.js';

export async function seedBankAccount() {
  logger.info('SEEDER: Seeding Customer Bank Account resources...');

  // Locate the Postman test customer user '9876543210'
  const testPhone = '9876543210';
  const user = await User.findOne({ phoneNumber: testPhone });
  
  if (!user) {
    logger.warn(`SEEDER WARNING: Could not seed bank accounts. Customer user ${testPhone} was not found.`);
    return;
  }

  // Clear existing bank accounts for this user
  await BankAccount.deleteMany({ userId: user._id });

  // Seed SBI
  const sbiAccount = await BankAccount.create({
    userId: user._id,
    bankName: 'State Bank Of India',
    accountNumber: '35207845339',
    ifsc: 'SBIN0001234',
    accountHolder: 'Priya Sharma',
    isPrimary: true,
    status: 'ACTIVE'
  });

  // Seed HDFC
  const hdfcAccount = await BankAccount.create({
    userId: user._id,
    bankName: 'HDFC Bank',
    accountNumber: '35207845340',
    ifsc: 'HDFC0001234',
    accountHolder: 'Priya Sharma',
    isPrimary: false,
    status: 'ACTIVE'
  });

  logger.info(`SEEDER: Seeded linked bank accounts [State Bank Of India, HDFC Bank] for customer user [${testPhone}]`);
}
