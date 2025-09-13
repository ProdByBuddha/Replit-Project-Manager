#!/usr/bin/env python3
"""
Family Portal AI Assistant Service
Powered by Parlant - Conversational AI for the Family Portal Application

This service provides AI assistance for families navigating the portal,
including help with status correction, ministry legitimation, task management,
document uploads, and general portal navigation.
"""

import asyncio
import logging
import os
import json
import re
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from parlant.client import AsyncParlantClient
from parlant.client import GuidelineContent, Tag
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API Models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    success: bool
    error: Optional[str] = None

# Security
security = HTTPBearer()

class FamilyPortalAI:
    """Family Portal AI Assistant powered by Parlant with US Code integration"""
    
    def __init__(self, parlant_base_url: str, port: int = 8800, api_key: Optional[str] = None):
        self.port = port
        self.api_key = api_key or os.getenv("PARLANT_API_KEY")
        self.shared_secret = os.getenv("PARLANT_SHARED_SECRET", "family-portal-ai-secret-2024")
        self.parlant_client = None
        self.app = FastAPI(
            title="Family Portal AI Assistant",
            description="AI assistance for families navigating the portal with US Code integration",
            version="1.0.0"
        )
        self.setup_middleware()
        self.setup_routes()
        
        # Parlant configuration
        self.parlant_base_url = parlant_base_url
        
        # US Code integration configuration
        self.backend_base_url = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:5000")
        self.backend_secret = os.getenv("PARLANT_SHARED_SECRET", "family-portal-ai-secret-2024")
        
        # Legal question detection patterns
        self.legal_keywords = {
            'constitutional': ['constitution', 'constitutional', 'bill of rights', 'amendment', 'first amendment', 'fourth amendment'],
            'criminal': ['criminal', 'crime', 'felony', 'misdemeanor', 'arrest', 'prosecution', 'police', 'law enforcement'],
            'civil_rights': ['civil rights', 'discrimination', 'equal protection', 'due process', 'civil liberties'],
            'immigration': ['immigration', 'visa', 'green card', 'citizenship', 'naturalization', 'deportation'],
            'tax': ['tax', 'taxes', 'taxation', 'irs', 'income tax', 'property tax'],
            'business': ['business', 'corporation', 'LLC', 'partnership', 'securities', 'commerce'],
            'family_law': ['marriage', 'divorce', 'custody', 'adoption', 'family court'],
            'property': ['property', 'real estate', 'ownership', 'deed', 'mortgage', 'zoning'],
            'contract': ['contract', 'agreement', 'breach', 'damages', 'liability'],
            'employment': ['employment', 'labor', 'workplace', 'wages', 'discrimination', 'unemployment'],
            'government': ['government', 'federal', 'state', 'local', 'agency', 'regulation', 'administrative'],
            'legal_process': ['court', 'lawsuit', 'litigation', 'judge', 'trial', 'appeal', 'legal process']
        }
        
    def setup_middleware(self):
        """Configure CORS and other middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://127.0.0.1:5000", "http://localhost:5000"],  # Only allow local frontend
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )
        
    def setup_routes(self):
        """Setup FastAPI routes"""
        
        async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
            """Verify the shared secret token"""
            if credentials.credentials != self.shared_secret:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid authentication token"
                )
            return credentials.credentials
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {
                "status": "healthy",
                "service": "Family Portal AI Assistant",
                "parlant_connected": self.parlant_client is not None
            }
        
        @self.app.post("/api/chat", response_model=ChatResponse)
        async def chat(request: ChatRequest, token: str = Depends(verify_token)):
            """Main chat endpoint"""
            try:
                if not self.parlant_client:
                    raise HTTPException(
                        status_code=503,
                        detail="Parlant service not available"
                    )
                
                # Process the chat request with family portal context
                response = await self.process_chat(request)
                return response
                
            except Exception as e:
                logger.error(f"Chat error: {e}")
                return ChatResponse(
                    response="I'm sorry, I'm having trouble processing your request right now. Please try again later.",
                    session_id=request.session_id or "error",
                    success=False,
                    error=str(e)
                )
    
    async def setup_parlant_client(self):
        """Initialize the Parlant client"""
        logger.info("Setting up Parlant client...")
        
        try:
            self.parlant_client = AsyncParlantClient(
                base_url=self.parlant_base_url,
                timeout=30.0
            )
            
            # Test the connection
            await self.test_parlant_connection()
            
            logger.info("Parlant client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to setup Parlant client: {e}")
            # Continue without Parlant for now, return helpful errors
            self.parlant_client = None
    
    async def test_parlant_connection(self):
        """Test the connection to Parlant service"""
        try:
            # Try to list sessions to test connectivity
            # Note: Actual API call depends on Parlant service availability
            logger.info("Testing Parlant connection...")
            # For now, just log that we would test it
            logger.info("Parlant connection test skipped - service endpoint needs configuration")
            
        except Exception as e:
            logger.warning(f"Parlant connection test failed: {e}")
    
    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """Process chat request with family portal specific logic and US Code integration"""
        try:
            # Add family portal context to the message
            enhanced_message = self.enhance_message_with_context(request.message, request.context)
            
            # Check if this is a legal question that could benefit from US Code search
            legal_context = self.detect_legal_question(request.message)
            uscode_results = None
            
            if legal_context['is_legal_question']:
                logger.info(f"Detected legal question with context: {legal_context['categories']}")
                # Search US Code for relevant information
                uscode_results = await self.search_uscode(request.message, legal_context)
            
            # Generate response with US Code integration
            response_text = await self.generate_enhanced_response(
                enhanced_message, 
                request.context, 
                legal_context, 
                uscode_results
            )
            
            return ChatResponse(
                response=response_text,
                session_id=request.session_id or "fp-session-1",
                success=True
            )
            
        except Exception as e:
            logger.error(f"Error processing chat: {e}")
            raise
    
    def enhance_message_with_context(self, message: str, context: Optional[Dict[str, Any]]) -> str:
        """Enhance the message with family portal context"""
        if not context:
            return f"Family Portal Question: {message}"
        
        context_info = []
        if context.get("user_role"):
            context_info.append(f"User role: {context['user_role']}")
        if context.get("family_id"):
            context_info.append(f"Family ID: {context['family_id']}")
        if context.get("current_page"):
            context_info.append(f"Current page: {context['current_page']}")
        
        context_str = " | ".join(context_info) if context_info else ""
        return f"Family Portal Question [{context_str}]: {message}"
    
    def detect_legal_question(self, message: str) -> Dict[str, Any]:
        """Detect if a message contains legal questions and categorize them"""
        message_lower = message.lower()
        
        # Look for direct legal indicators
        legal_indicators = [
            'law', 'legal', 'code', 'statute', 'regulation', 'usc', 'u.s.c',
            'federal law', 'title', 'section', 'chapter', 'citation'
        ]
        
        has_legal_indicator = any(indicator in message_lower for indicator in legal_indicators)
        
        # Categorize by legal domain
        detected_categories = []
        for category, keywords in self.legal_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_categories.append(category)
        
        # Check for citation patterns (e.g., "15 USC 1", "Title 8", "Section 1101")
        citation_patterns = [
            r'\b(\d+)\s+u\.?s\.?c\.?\s+§?\s*(\d+)',  # 15 USC 1
            r'\btitle\s+(\d+)',  # Title 8
            r'\bsection\s+(\d+)',  # Section 1101
            r'\b(\d+)\s+cfr\s+(\d+)',  # CFR references
        ]
        
        has_citation = False
        for pattern in citation_patterns:
            if re.search(pattern, message_lower):
                has_citation = True
                break
        
        # Determine if this is a legal question
        is_legal_question = (
            has_legal_indicator or 
            len(detected_categories) > 0 or 
            has_citation or
            any(word in message_lower for word in [
                'what is the law', 'what does the law say', 'is it legal',
                'what are my rights', 'legal requirement', 'federal law',
                'what code', 'what statute', 'legal definition'
            ])
        )
        
        return {
            'is_legal_question': is_legal_question,
            'categories': detected_categories,
            'has_citation': has_citation,
            'confidence': len(detected_categories) + (1 if has_legal_indicator else 0) + (1 if has_citation else 0)
        }
    
    async def search_uscode(self, query: str, legal_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Search US Code database for relevant legal information"""
        try:
            # Prepare search query for US Code API
            search_params = {
                'q': query,
                'limit': 5,  # Limit for AI response
                'type': 'fulltext'
            }
            
            # Adjust search based on legal context
            if legal_context.get('categories'):
                # Could map categories to specific titles if needed
                if 'immigration' in legal_context['categories']:
                    search_params['title'] = 8  # Immigration law
                elif 'tax' in legal_context['categories']:
                    search_params['title'] = 26  # Tax code
                elif 'criminal' in legal_context['categories']:
                    search_params['title'] = 18  # Criminal code
                elif 'business' in legal_context['categories']:
                    search_params['title'] = 15  # Commerce and trade
            
            # Make request to backend US Code API
            async with httpx.AsyncClient() as client:
                headers = {
                    'Authorization': f'Bearer {self.backend_secret}',
                    'Content-Type': 'application/json'
                }
                
                logger.info(f"Searching US Code with params: {search_params}")
                response = await client.get(
                    f"{self.backend_base_url}/api/uscode/search",
                    params=search_params,
                    headers=headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"US Code search failed: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error searching US Code: {e}")
            return None
    
    def format_uscode_results(self, results: Dict[str, Any]) -> str:
        """Format US Code search results for inclusion in AI response"""
        if not results or not results.get('success') or not results.get('data'):
            return ""
        
        sections = results['data'].get('sections', [])
        if not sections:
            return ""
        
        formatted_results = ["**Relevant US Code Sections:**\n"]
        
        for i, section in enumerate(sections[:3]):  # Limit to top 3 results
            title_name = section.get('title', {}).get('name', 'Unknown Title')
            citation = section.get('citation', 'Unknown Citation')
            heading = section.get('heading', 'No heading available')
            
            # Truncate content for AI response
            content = section.get('content', '')
            if len(content) > 300:
                content = content[:300] + "..."
            
            formatted_results.append(f"**{citation}** - {heading}")
            formatted_results.append(f"*From: {title_name}*")
            formatted_results.append(f"{content}\n")
        
        formatted_results.append("*Note: This information is provided for general reference. For specific legal advice, consult with a qualified attorney.*")
        
        return "\n".join(formatted_results)
    
    async def generate_enhanced_response(
        self, 
        message: str, 
        context: Optional[Dict[str, Any]], 
        legal_context: Dict[str, Any], 
        uscode_results: Optional[Dict[str, Any]]
    ) -> str:
        """Generate enhanced response combining family portal guidance with US Code information"""
        
        # Get base family portal response
        base_response = await self.generate_family_portal_response(message, context)
        
        # If no legal context, return base response
        if not legal_context.get('is_legal_question') or not uscode_results:
            return base_response
        
        # Format US Code results
        legal_info = self.format_uscode_results(uscode_results)
        
        if not legal_info:
            return base_response
        
        # Combine responses
        enhanced_response = f"{base_response}\n\n---\n\n{legal_info}"
        
        return enhanced_response
    
    async def generate_family_portal_response(self, message: str, context: Optional[Dict[str, Any]]) -> str:
        """Generate helpful responses for family portal questions"""
        
        # Simple keyword-based responses for common family portal topics
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["status correction", "status", "correct"]):
            return """Status correction is a step-by-step process in the family portal. Here's what you need to know:

1. **Review your task checklist** - Each family has specific tasks that must be completed in order
2. **Complete prerequisite tasks first** - Some tasks depend on others being finished
3. **Upload required documents** - Each task may require specific documentation
4. **Check task dependencies** - The system will show you which tasks are available to work on

You can find your task checklist on your dashboard. Tasks that are ready to work on will be highlighted in blue, while those waiting for prerequisites will be grayed out.

Would you like help with a specific task or document requirement?"""

        elif any(word in message_lower for word in ["ministry", "legitimation", "legitimate"]):
            return """Ministry legitimation involves several important steps:

1. **Complete the legitimation checklist** - Found in your task list under "Ministry Legitimation"
2. **Gather required documents** - This typically includes articles of incorporation, bylaws, and other organizational documents
3. **Submit documentation** - Upload documents through the Document Center
4. **Wait for review** - Admin will review your submission and provide feedback

The process ensures your ministry meets all legal requirements. Check your task list for specific items that need attention.

Do you need help finding specific documents or understanding a particular requirement?"""

        elif any(word in message_lower for word in ["task", "checklist", "complete", "finish"]):
            return """The task management system helps you track your progress:

**Understanding Your Tasks:**
- **Blue tasks** - Ready to work on now
- **Gray tasks** - Waiting for prerequisites to be completed
- **Green tasks** - Already completed

**How to Complete Tasks:**
1. Click on an available task to see details
2. Follow the instructions provided
3. Upload any required documents
4. Mark the task as complete when finished

**Task Dependencies:**
Some tasks must be completed before others become available. The system automatically unlocks new tasks as you progress.

Which specific task would you like help with?"""

        elif any(word in message_lower for word in ["document", "upload", "file", "paperwork"]):
            return """The Document Center helps you manage all your paperwork:

**Uploading Documents:**
1. Go to the Document Center from your dashboard
2. Click "Upload Documents"
3. Select your files (PDF, DOC, JPG supported)
4. Add descriptions to help organize your files
5. Click upload

**Document Organization:**
- Files are automatically organized by family
- You can add tags and descriptions for easy searching
- Admins can view documents when reviewing your tasks

**Required Documents:**
Each task in your checklist will specify which documents are needed. Common documents include:
- Articles of Incorporation
- Bylaws
- Financial statements
- Identification documents

Need help with a specific document requirement?"""

        elif any(word in message_lower for word in ["invite", "family", "member", "add"]):
            return """Adding family members to your portal account:

**Inviting Family Members:**
1. Go to your dashboard and click "Manage Family"
2. Click "Invite Family Member"
3. Enter their email address
4. Add a personal message if desired
5. Send the invitation

**What Happens Next:**
- They'll receive an email with instructions
- They can create their account using your family code
- They'll have access to the same tasks and documents
- Multiple family members can work together on tasks

**Family Member Roles:**
All family members have the same access level and can help complete tasks and upload documents.

Would you like help with sending an invitation or managing existing family members?"""

        elif any(word in message_lower for word in ["message", "admin", "help", "contact"]):
            return """Communicating with administrators:

**Message Center:**
- Access through your dashboard
- Send messages directly to administrators
- Get responses within 1-2 business days
- View message history

**When to Contact Admin:**
- Questions about specific legal requirements
- Issues with document submissions
- Problems with task completion
- Technical difficulties with the portal

**Self-Service First:**
Many questions can be answered through:
- Task descriptions and instructions
- The help section of each page
- This AI assistant for general guidance

**Response Times:**
Admins typically respond within 1-2 business days. For urgent matters, please indicate the urgency in your message.

What specific question would you like help with?"""

        else:
            return """I'm here to help you navigate the Family Portal! I can assist with:

**Common Topics:**
- **Status Correction Process** - Understanding tasks and requirements
- **Ministry Legitimation** - Steps and documentation needed
- **Task Management** - How to complete tasks and understand dependencies
- **Document Upload** - Using the Document Center effectively
- **Family Management** - Inviting members and managing your account
- **Communication** - How to contact administrators

**Getting Started:**
1. Check your dashboard for an overview of your progress
2. Review your task checklist to see what's next
3. Use the Document Center to upload required paperwork
4. Invite family members to help with the process

**Need Specific Help?**
Try asking about:
- "How do I complete status correction tasks?"
- "What documents do I need for ministry legitimation?"
- "How do I invite family members?"
- "How do I upload documents?"

What would you like help with today?"""

    async def start_server(self):
        """Start the FastAPI server"""
        logger.info(f"Starting Family Portal AI REST server on 127.0.0.1:{self.port}")
        
        config = uvicorn.Config(
            app=self.app,
            host="127.0.0.1",  # Bind to localhost only for security
            port=self.port,
            log_level="info"
        )
        server = uvicorn.Server(config)
        
        logger.info(f"Family Portal AI service is running at http://127.0.0.1:{self.port}")
        logger.info("API endpoints available:")
        logger.info(f"  - Chat: POST http://127.0.0.1:{self.port}/api/chat")
        logger.info(f"  - Health: GET http://127.0.0.1:{self.port}/health")
        
        await server.serve()
        
    async def run(self):
        """Main execution method"""
        try:
            await self.setup_parlant_client()
            await self.start_server()
            
        except Exception as e:
            logger.error(f"Error running Family Portal AI service: {e}")
            raise

async def main():
    """Entry point for the Family Portal AI service"""
    port = int(os.getenv("PARLANT_PORT", "8800"))
    parlant_base_url = os.getenv("PARLANT_BASE_URL", "https://api.parlant.ai")
    
    logger.info("=" * 60)
    logger.info("FAMILY PORTAL AI ASSISTANT SERVICE")
    logger.info("Powered by Parlant")
    logger.info("=" * 60)
    
    family_portal_ai = FamilyPortalAI(
        parlant_base_url=parlant_base_url,
        port=port
    )
    await family_portal_ai.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Family Portal AI service stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise