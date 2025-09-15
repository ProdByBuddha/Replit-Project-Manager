#!/usr/bin/env tsx
/**
 * Test Task Synchronization with Eric Parker/Tasks
 * Tests that task creation and status changes are properly reflected in Dart AI
 */

import { taskSyncService } from '../services/taskSync';
import { storage } from '../storage';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTaskSync() {
  console.log('🧪 Testing Task Synchronization with Eric Parker/Tasks...\n');
  
  try {
    // Get the sample family
    const families = await storage.getAllFamilies();
    const sampleFamily = families.find(f => f.name === 'Johnson Family');
    
    if (!sampleFamily) {
      console.error('❌ Sample family not found. Please run the application first.');
      process.exit(1);
    }
    
    console.log(`✅ Found sample family: ${sampleFamily.name} (${sampleFamily.id})`);
    
    // Get family tasks
    const familyTasks = await storage.getFamilyTasks(sampleFamily.id);
    console.log(`📋 Found ${familyTasks.length} tasks for this family\n`);
    
    if (familyTasks.length === 0) {
      console.log('⚠️  No tasks found for this family. Creating sample tasks...');
      
      // Get all task templates
      const taskTemplates = await storage.getAllTasks();
      
      if (taskTemplates.length === 0) {
        console.error('❌ No task templates found in the system.');
        process.exit(1);
      }
      
      // Create a few family tasks
      const taskToCreate = taskTemplates[0];
      const familyTask = await storage.addFamilyTask({
        familyId: sampleFamily.id,
        taskId: taskToCreate.id,
        status: 'not_started',
        notes: 'Test task for synchronization'
      });
      
      familyTasks.push(familyTask);
      console.log(`✅ Created test task: ${taskToCreate.title}`);
    }
    
    // Test syncing each task
    console.log('\n🔄 Syncing tasks to Eric Parker/Tasks...\n');
    
    for (const familyTask of familyTasks.slice(0, 3)) { // Test first 3 tasks
      const task = await storage.getAllTasks().then(tasks => 
        tasks.find(t => t.id === familyTask.taskId)
      );
      
      if (!task) continue;
      
      console.log(`📌 Syncing: ${task.title}`);
      console.log(`   Status: ${familyTask.status}`);
      
      const success = await taskSyncService.syncTask(familyTask.id);
      
      if (success) {
        const syncStatus = taskSyncService.getSyncStatus(familyTask.id);
        console.log(`   ✅ Synced successfully!`);
        if (syncStatus.dartTaskId) {
          console.log(`   Dart Task ID: ${syncStatus.dartTaskId}`);
        }
      } else {
        console.log(`   ❌ Failed to sync`);
      }
      
      console.log('');
    }
    
    // Test status change
    console.log('\n🔄 Testing status change synchronization...\n');
    
    const testTask = familyTasks[0];
    const task = await storage.getAllTasks().then(tasks => 
      tasks.find(t => t.id === testTask.taskId)
    );
    
    if (testTask && task) {
      console.log(`📝 Updating task status: ${task.title}`);
      console.log(`   Old status: ${testTask.status}`);
      
      const newStatus = testTask.status === 'not_started' ? 'in_progress' : 
                       testTask.status === 'in_progress' ? 'completed' : 'not_started';
      
      await storage.updateFamilyTaskStatus(testTask.id, newStatus, 'Status updated for testing');
      
      console.log(`   New status: ${newStatus}`);
      
      const success = await taskSyncService.syncTaskStatus(testTask.id, newStatus);
      
      if (success) {
        console.log(`   ✅ Status change synced successfully!`);
      } else {
        console.log(`   ❌ Failed to sync status change`);
      }
    }
    
    console.log('\n✨ Task synchronization test complete!');
    console.log('Check Eric Parker/Tasks dartboard on Dart AI to verify the tasks are visible.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testTaskSync();