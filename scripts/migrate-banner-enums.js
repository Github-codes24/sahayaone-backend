import mongoose from 'mongoose';
import { databaseConfig } from '../src/config/database.config.js';
import { Banner } from '../src/models/banner.model.js';

async function migrate() {
  await mongoose.connect(databaseConfig.uri, databaseConfig.options);
  console.log('Connected to DB');

  const r1 = await Banner.updateMany(
    { portalType: { $in: ['Loan Executive App', 'Executive App', 'Employee App', 'LOAN_EXECUTIVE_APP'] } },
    { $set: { portalType: 'EXECUTIVE_APP' } }
  );
  console.log('Executive banners updated:', r1);

  const r2 = await Banner.updateMany(
    { portalType: { $in: ['Customer App', 'Customer', 'CUSTOMER'] } },
    { $set: { portalType: 'CUSTOMER_APP' } }
  );
  console.log('Customer banners updated:', r2);

  const r3 = await Banner.updateMany(
    { portalType: { $in: ['Onboarding App', 'Bank Onboarding', 'Onboarding Team', 'ONBOARDING'] } },
    { $set: { portalType: 'ONBOARDING_APP' } }
  );
  console.log('Onboarding banners updated:', r3);

  const all = await Banner.find({}).lean();
  console.log('Final banners in DB:', JSON.stringify(all, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
