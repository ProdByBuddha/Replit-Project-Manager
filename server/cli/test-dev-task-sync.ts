#!/usr/bin/env tsx
/**
 * Test Development Task Synchronization with Eric Parker/Tasks
 * Tests that development/coding tasks are properly reflected in Dart AI
 */

import { agentTaskHook } from '../services/agentTaskHook';
import { devTaskSyncService, DevTask } from '../services/devTaskSync';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

async function testDevTaskSync() {
  console.log('🧪 Testing Development Task Synchronization with Eric Parker/Tasks...\n');
  
  try {
    // Create sample development tasks
    const sampleTasks: DevTask[] = [
      {
        id: 'task-1',
        title: 'Implement user authentication',
        description: 'Add OAuth2 authentication with Google and GitHub providers',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task-2',
        title: 'Add database migration for user roles',
        description: 'Create migration to add RBAC tables and relationships',
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        architect_reviewed: 'yes'
      },
      {
        id: 'task-3',
        title: 'Fix bug in file upload handler',
        description: 'Files over 10MB are failing to upload to cloud storage',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task-4',
        title: 'Optimize database queries',
        description: 'Add indexes and optimize slow queries identified in performance testing',
        status: 'completed_pending_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    console.log('📝 Creating sample development tasks...\n');
    
    // Simulate the agent writing tasks
    await agentTaskHook.onTaskListUpdated(sampleTasks);
    
    console.log('✅ Sample tasks created and saved\n');
    
    // Give it a moment to sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔄 Tasks should now be syncing to Eric Parker/Tasks...\n');
    
    // Test status change
    console.log('📊 Testing status change synchronization...\n');
    
    // Update task status
    sampleTasks[0].status = 'completed';
    sampleTasks[0].updatedAt = new Date().toISOString();
    sampleTasks[0].architect_reviewed = 'yes';
    sampleTasks[0].architect_reviewed_reason = 'Code review passed, good implementation';
    
    await agentTaskHook.onTaskListUpdated(sampleTasks);
    
    console.log('✅ Status change triggered for "Implement user authentication" -> completed\n');
    
    // Give it a moment to sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add a new task
    console.log('➕ Testing new task creation...\n');
    
    const newTask: DevTask = {
      id: 'task-5',
      title: 'Implement real-time notifications',
      description: 'Add WebSocket-based notifications for task updates and messages',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    sampleTasks.push(newTask);
    await agentTaskHook.onTaskListUpdated(sampleTasks);
    
    console.log('✅ New task added: "Implement real-time notifications"\n');
    
    // Final sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✨ Development task synchronization test complete!\n');
    console.log('📋 Summary of synced tasks:');
    console.log('  1. Implement user authentication (completed)');
    console.log('  2. Add database migration for user roles (completed)');
    console.log('  3. Fix bug in file upload handler (pending)');
    console.log('  4. Optimize database queries (in review)');
    console.log('  5. Implement real-time notifications (pending)');
    console.log('\n🎯 Check Eric Parker/Tasks dartboard on Dart AI to verify the development tasks are visible.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testDevTaskSync();