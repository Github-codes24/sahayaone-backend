import { EmiSlab } from '../../models/emi-slab.model.js';
import { logger } from '../../utils/logger.util.js';

export async function seedEmiSlabs() {
  logger.info('SEEDER: Seeding EMI Slab configurations...');

  const defaultSlabs = [
    { tenureMonths: 6, interestPercentage: 9, minProductPrice: 0 },
    { tenureMonths: 9, interestPercentage: 11, minProductPrice: 25001 },
    { tenureMonths: 12, interestPercentage: 14, minProductPrice: 50001 },
    { tenureMonths: 15, interestPercentage: 17, minProductPrice: 75001 },
    { tenureMonths: 18, interestPercentage: 20, minProductPrice: 100001 },
    { tenureMonths: 24, interestPercentage: 26, minProductPrice: 130001 }
  ];

  for (const slab of defaultSlabs) {
    await EmiSlab.findOneAndUpdate(
      { tenureMonths: slab.tenureMonths },
      slab,
      { upsert: true, new: true }
    );
  }

  logger.info('SEEDER: EMI Slab configurations seeded successfully.');
}
