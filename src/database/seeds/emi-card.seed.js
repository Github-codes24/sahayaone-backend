import { User } from '../../models/user.model.js';
import { CustomerProfile } from '../../models/customer-profile.model.js';
import { Bank } from '../../models/bank.model.js';
import { Branch } from '../../models/branch.model.js';
import { EmiCard } from '../../models/emi-card.model.js';
import { cryptoUtil } from '../../utils/crypto.util.js';
import { logger } from '../../utils/logger.util.js';

export async function seedEmiCard() {
  logger.info('SEEDER: Seeding Bank, Branch, and EMI Card resources...');

  // 1. Clear existing bank-related collections
  await EmiCard.deleteMany({});
  await Branch.deleteMany({});
  await Bank.deleteMany({});

  // 2. Seed default Bank
  const bank = await Bank.create({
    name: 'Pune Co-operative Bank',
    code: 'PCB101',
    status: 'APPROVED',
    logo: 'https://sahayaone-backend.onrender.com/public/mocks/logo-society.png'
  });
  logger.info(`SEEDER: Seeded Bank: ${bank.name} (${bank.code})`);

  // 3. Seed default Branch
  const branch = await Branch.create({
    bankId: bank._id,
    name: 'Pune Main Branch',
    code: 'PCB-BR01',
    cardStock: 200,
    status: 'ACTIVE'
  });
  logger.info(`SEEDER: Seeded Branch: ${branch.name} (${branch.code})`);

  // 4. Locate or create Postman test customer user '9876543210'
  const testPhone = '9876543210';
  let user = await User.findOne({ phoneNumber: testPhone });
  
  if (!user) {
    const mpinHash = await cryptoUtil.hash('4321');
    user = await User.create({
      phoneNumber: testPhone,
      role: 'CUSTOMER',
      userType: 'CUSTOMER',
      status: 'ACTIVE',
      mpinHash
    });
    logger.info(`SEEDER: Seeded test customer user: ${testPhone}`);
  } else {
    user.status = 'ACTIVE';
    user.userType = 'CUSTOMER';
    if (!user.mpinHash) {
      user.mpinHash = await cryptoUtil.hash('4321');
    }
    await user.save();
  }

  // 5. Locate or create profile for test customer
  let profile = await CustomerProfile.findOne({ userId: user._id });
  if (!profile) {
    profile = await CustomerProfile.create({
      userId: user._id,
      firstName: 'Priya',
      lastName: 'Sharma',
      gender: 'FEMALE',
      dob: new Date('1997-12-05'),
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '987654321012',
      currentPinCode: '411061',
      kycStatus: 'VERIFIED'
    });
    logger.info(`SEEDER: Seeded customer profile: ${profile.firstName} ${profile.lastName}`);
  } else {
    profile.kycStatus = 'VERIFIED';
    await profile.save();
  }

  // 6. Seed allotted EMI card for the test user
  const emiCard = await EmiCard.create({
    bankId: bank._id,
    branchId: branch._id,
    customerId: user._id,
    cardNumber: '4321876543210101',
    cardHolderName: `${profile.firstName} ${profile.lastName}`,
    validThru: '12/30',
    cvv: '999',
    cardLimit: 150000,
    availableLimit: 150000,
    status: 'ACTIVE',
    allotmentStatus: 'ALLOTTED',
    allottedAt: new Date()
  });

  logger.info(`SEEDER: Seeded active EMI Card [${emiCard.cardNumber}] for Customer [${emiCard.cardHolderName}]`);
}
