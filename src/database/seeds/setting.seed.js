import { Setting } from '../../models/setting.model.js';
import { logger } from '../../utils/logger.util.js';

export async function seedSettings() {
  logger.info('SEEDER: Seeding System Configurations settings...');

  const defaultSettings = [
    { key: 'EMI_CARD_CHARGES', value: 499, description: 'Flat charge fee for new or renewed EMI cards.' },
    { key: 'LOAN_INSURANCE_AMOUNT', value: 550, description: 'Flat charge fee for optional loan insurance coverage.' },
    { key: 'LOAN_INTEREST_PERCENTAGE', value: 8, description: 'Percentage rate for dealer interest or loan interest calculations.' },
    { key: 'VERIFICATION_CREDIT_PRICE', value: 50, description: 'Price per verification credit for bank onboarding.' },
    { key: 'MIN_EMI_CARD_LIMIT', value: 100, description: 'Minimum purchase limit for EMI cards during bank onboarding.' },
    { key: 'MIN_VERIFICATION_CREDIT_LIMIT', value: 200, description: 'Minimum purchase limit for verification credits during bank onboarding.' }
  ];

  for (const setting of defaultSettings) {
    await Setting.findOneAndUpdate(
      { key: setting.key },
      setting,
      { upsert: true, new: true }
    );
  }

  logger.info('SEEDER: System Configurations settings seeded successfully.');
}
