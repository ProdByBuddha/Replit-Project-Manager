#!/usr/bin/env python3
"""
Test script for the Family Portal AI Assistant Service
Tests basic functionality, API endpoints, and family portal knowledge
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any

import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParlantServiceTester:
    """Test suite for the Family Portal AI service"""
    
    def __init__(self, base_url: str = "http://localhost:8800"):
        self.base_url = base_url
        self.session = None
        
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup test environment"""
        if self.session:
            await self.session.close()
    
    async def test_health_endpoint(self) -> bool:
        """Test the health endpoint"""
        try:
            logger.info("Testing health endpoint...")
            async with self.session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    logger.info("✅ Health endpoint is working")
                    return True
                else:
                    logger.error(f"❌ Health endpoint returned status {response.status}")
                    return False
        except Exception as e:
            logger.error(f"❌ Health endpoint test failed: {e}")
            return False
    
    async def test_chat_endpoint(self, message: str, expected_keywords: list = None) -> bool:
        """Test the chat endpoint with a message"""
        try:
            logger.info(f"Testing chat endpoint with message: '{message}'")
            
            payload = {
                "message": message,
                "session_id": "test_session_001"
            }
            
            async with self.session.post(
                f"{self.base_url}/api/chat",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status == 200:
                    response_data = await response.json()
                    ai_response = response_data.get("response", "")
                    
                    logger.info(f"✅ Chat endpoint working. AI Response: {ai_response[:100]}...")
                    
                    # Check for expected keywords if provided
                    if expected_keywords:
                        for keyword in expected_keywords:
                            if keyword.lower() in ai_response.lower():
                                logger.info(f"✅ Found expected keyword: '{keyword}'")
                            else:
                                logger.warning(f"⚠️ Expected keyword not found: '{keyword}'")
                    
                    return True
                else:
                    logger.error(f"❌ Chat endpoint returned status {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Chat endpoint test failed: {e}")
            return False
    
    async def test_family_portal_knowledge(self) -> bool:
        """Test AI knowledge about family portal concepts"""
        logger.info("Testing family portal specific knowledge...")
        
        test_cases = [
            {
                "message": "What is status correction?",
                "keywords": ["status", "correction", "process", "documentation", "requirements"]
            },
            {
                "message": "How do I upload documents?",
                "keywords": ["document", "upload", "file", "portal"]
            },
            {
                "message": "What is ministry legitimation?",
                "keywords": ["ministry", "legitimation", "checklist", "requirements"]
            },
            {
                "message": "How do I invite family members?",
                "keywords": ["invite", "family", "member", "portal"]
            },
            {
                "message": "What tasks do I need to complete?",
                "keywords": ["task", "complete", "checklist", "progress"]
            }
        ]
        
        all_passed = True
        for i, test_case in enumerate(test_cases, 1):
            logger.info(f"\n--- Test Case {i}/5 ---")
            success = await self.test_chat_endpoint(
                test_case["message"], 
                test_case["keywords"]
            )
            if not success:
                all_passed = False
            
            # Wait between requests
            await asyncio.sleep(1)
        
        return all_passed
    
    async def test_basic_conversation(self) -> bool:
        """Test basic conversation flow"""
        logger.info("\n=== Testing Basic Conversation Flow ===")
        
        conversation = [
            "Hello, I'm new to the family portal. Can you help me?",
            "What is the first thing I should do?",
            "How do I check my task list?",
            "Thank you for your help!"
        ]
        
        for i, message in enumerate(conversation, 1):
            logger.info(f"\n--- Conversation Step {i}/{len(conversation)} ---")
            success = await self.test_chat_endpoint(message)
            if not success:
                return False
            await asyncio.sleep(1)
        
        return True
    
    async def run_all_tests(self) -> Dict[str, bool]:
        """Run all test cases"""
        logger.info("=" * 60)
        logger.info("FAMILY PORTAL AI SERVICE TEST SUITE")
        logger.info("=" * 60)
        
        await self.setup()
        
        results = {}
        
        try:
            # Wait a moment for service to be ready
            logger.info("Waiting for service to be ready...")
            await asyncio.sleep(2)
            
            # Test health endpoint
            results["health"] = await self.test_health_endpoint()
            await asyncio.sleep(1)
            
            # Test chat endpoint
            results["chat"] = await self.test_chat_endpoint("Hello, can you help me?")
            await asyncio.sleep(1)
            
            # Test family portal knowledge
            results["portal_knowledge"] = await self.test_family_portal_knowledge()
            
            # Test conversation flow
            results["conversation"] = await self.test_basic_conversation()
            
            # Summary
            logger.info("\n" + "=" * 60)
            logger.info("TEST RESULTS SUMMARY")
            logger.info("=" * 60)
            
            passed = sum(1 for result in results.values() if result)
            total = len(results)
            
            for test_name, result in results.items():
                status = "✅ PASSED" if result else "❌ FAILED"
                logger.info(f"{test_name.upper()}: {status}")
            
            logger.info(f"\nOverall: {passed}/{total} tests passed")
            
            if passed == total:
                logger.info("🎉 All tests passed! Family Portal AI service is working correctly.")
            else:
                logger.warning(f"⚠️ {total - passed} test(s) failed. Please check the service configuration.")
            
        except Exception as e:
            logger.error(f"Test suite failed with error: {e}")
            results["error"] = str(e)
        
        finally:
            await self.cleanup()
        
        return results

async def main():
    """Main test execution"""
    print("Starting Family Portal AI Service Tests...")
    print("Make sure the Parlant service is running on port 8800!")
    print("You can start it with: python3 parlant_service.py")
    print()
    
    # Wait for user confirmation
    input("Press Enter when the service is running...")
    
    tester = ParlantServiceTester()
    results = await tester.run_all_tests()
    
    return results

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test failed: {e}")