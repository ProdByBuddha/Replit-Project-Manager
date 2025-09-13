// RBAC Migration Script - Safe Data Migration for Legacy Admin Users
// This script safely migrates existing admin users to the new RBAC system

import { storage } from "./storage";

export async function migrateAdminUsers(): Promise<void> {
  console.log("🔄 Starting RBAC migration for legacy admin users...");

  try {
    // Get all users with the legacy 'admin' role
    const legacyAdmins = await storage.getAdminUsers();

    console.log(`📊 Found ${legacyAdmins.length} legacy admin users to migrate`);

    if (legacyAdmins.length === 0) {
      console.log("✅ No legacy admin users found - migration not needed");
      return;
    }

    // Migrate each legacy admin user
    for (const user of legacyAdmins) {
      console.log(`🔄 Migrating user: ${user.email} (${user.id})`);
      
      // Update user role from 'admin' to 'ministry_admin'
      const updatedUser = {
        ...user,
        role: 'ministry_admin' as const
      };

      await storage.upsertUser(updatedUser);
      console.log(`✅ Successfully migrated ${user.email} to ministry_admin role`);
    }

    console.log("🎉 RBAC migration completed successfully!");
    console.log(`📈 Migrated ${legacyAdmins.length} admin users to ministry_admin role`);

  } catch (error) {
    console.error("❌ Error during RBAC migration:", error);
    throw error;
  }
}

// Function to verify migration was successful
export async function verifyMigration(): Promise<boolean> {
  console.log("🔍 Verifying RBAC migration...");

  try {
    const legacyAdmins = await storage.getAdminUsers();
    // Note: We don't have getAllUsers, so we'll just check if legacy admins still exist

    console.log(`📊 Legacy admin users remaining: ${legacyAdmins.length}`);

    if (legacyAdmins.length === 0) {
      console.log("✅ Migration verification passed - no legacy admin users found");
      return true;
    } else {
      console.log("⚠️ Migration verification failed - legacy admin users still exist");
      return false;
    }
  } catch (error) {
    console.error("❌ Error during migration verification:", error);
    return false;
  }
}