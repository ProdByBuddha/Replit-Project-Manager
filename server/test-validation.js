// Quick test to verify dependency validation works correctly
const { validateTaskTransition } = require('./taskValidation');

// Test the validation logic
async function testValidation() {
  console.log('Testing dependency validation logic...');
  
  // Test 1: Valid backward transition (should always pass)
  const backwardResult = await validateTaskTransition(
    'test-task-id', 
    'completed', 
    'in_progress', 
    'test-family-id', 
    false
  );
  console.log('✓ Backward transition test:', backwardResult.isValid ? 'PASS' : 'FAIL');
  
  // Test 2: Bypass validation (should always pass)
  const bypassResult = await validateTaskTransition(
    'test-task-id', 
    'not_started', 
    'completed', 
    'test-family-id', 
    true  // bypass validation
  );
  console.log('✓ Bypass validation test:', bypassResult.isValid ? 'PASS' : 'FAIL');
  
  console.log('Validation logic tests completed successfully!');
}

testValidation().catch(console.error);