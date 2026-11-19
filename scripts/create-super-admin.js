import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Admin } from '../src/models/admin.model.js';
import { cryptoUtil } from '../src/utils/crypto.util.js';
import { UserRole } from '../src/constants/user-role.constant.js';

import { connectDatabase, disconnectDatabase } from '../src/database/connection.js';

async function createSuperAdmin() {
  const targetEmail = process.env.SUPER_ADMIN_EMAIL || 'admin123@sahayaone.com';
  const targetPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@2001';
  const targetRole = UserRole.SUPER_ADMIN;

  try {
    await connectDatabase();
    console.log('MongoDB connected successfully.');

    // Check if an admin with this email exists
    let admin = await Admin.findOne({ email: targetEmail });

    const passwordHash = await cryptoUtil.hash(targetPassword);

    if (admin) {
      console.log(`Admin with email ${targetEmail} already exists. Updating account...`);
      admin.passwordHash = passwordHash;
      admin.role = targetRole;
      admin.status = 'ACTIVE';
      admin.permissions = ['ALL_PERMISSIONS'];
      admin.name = admin.name || 'Sahayaone Super Admin';
      if (!admin.phoneNumber) {
        admin.phoneNumber = '9999999999';
      }
      await admin.save();
      console.log(`Super Admin updated successfully!`);
    } else {
      console.log(`Creating new Super Admin account for ${targetEmail}...`);
      
      // Check if phone number 9999999999 is taken
      let phone = '9999999999';
      const existingPhone = await Admin.findOne({ phoneNumber: phone });
      if (existingPhone) {
        phone = '9999999991';
      }

      admin = new Admin({
        name: 'Sahayaone Super Admin',
        email: targetEmail,
        phoneNumber: phone,
        passwordHash,
        role: targetRole,
        status: 'ACTIVE',
        permissions: ['ALL_PERMISSIONS']
      });

      await admin.save();
      console.log(`Super Admin created successfully!`);
    }

    console.log('\n--- Account Details ---');
    console.log(`ID: ${admin._id}`);
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Phone: ${admin.phoneNumber}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Status: ${admin.status}`);
    console.log(`Permissions: ${JSON.stringify(admin.permissions)}`);

    // Verify password authentication
    const isValid = await cryptoUtil.compare(targetPassword, admin.passwordHash);
    console.log(`Password verification test: ${isValid ? 'PASSED (Match)' : 'FAILED'}`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

createSuperAdmin();
