import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import { seedSuperAdmin, seedSubAdmin } from './super-admin.seed.js';
import { seedEmployee } from './employee.seed.js';
import { seedOnboardingTeam } from './onboarding.seed.js';
import { seedCatalog } from './catalog.seed.js';
import { seedEmiCard } from './emi-card.seed.js';
import { seedBankAccount } from './bank-account.seed.js';
import { seedLoan } from './loan.seed.js';
import { seedEmiSlabs } from './emi-slab.seed.js';
import { seedSettings } from './setting.seed.js';
import { logger } from '../../utils/logger.util.js';

dotenv.config();

async function runSeeders() {
  logger.info('SEED MANAGER: Initialization started...');
  
  try {
    await connectDatabase();

    logger.info('SEED MANAGER: Executing seed sequences...');
    await seedSuperAdmin();
    await seedSubAdmin();
    await seedCatalog();
    await seedEmiCard();
    await seedEmployee();
    await seedOnboardingTeam();
    await seedBankAccount();
    await seedLoan();
    await seedEmiSlabs();
    await seedSettings();

    logger.info('SEED MANAGER: All seeds executed successfully.');
  } catch (error) {
    logger.error(`SEED MANAGER EXCEPTION: Failed execution run: ${error.message}`);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

runSeeders();
