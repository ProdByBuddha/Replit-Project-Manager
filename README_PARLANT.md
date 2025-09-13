# Family Portal AI Assistant Service

## Overview

The Family Portal AI Assistant is a conversational AI service powered by Parlant that provides intelligent assistance for families navigating the family portal application. The service understands the complexities of status correction processes, ministry legitimation requirements, task management, document uploads, and general portal navigation.

## Architecture

- **Service Framework**: Parlant (Conversational AI)
- **Port**: 8800 (separate from the main Node.js app on port 5000)
- **Language**: Python 3.11
- **API**: RESTful HTTP endpoints

## Features

### Family Portal Expertise
- **Status Correction Guidance**: Understands the complex status correction process with task dependencies and documentation requirements
- **Ministry Legitimation Support**: Provides guidance on legitimation checklist items and requirements
- **Task Management Help**: Assists with understanding task workflows, dependencies, and completion processes
- **Document Management**: Helps with document upload processes, file organization, and requirements
- **Portal Navigation**: Guides users through different portal sections and features
- **Communication Support**: Explains how to communicate with administrators and use messaging features

### Behavioral Guidelines
- **Simple Language**: Uses everyday language that families can easily understand
- **Empathetic Communication**: Patient and supportive throughout all interactions
- **Process Awareness**: Understands task dependencies and workflow automation
- **Privacy Focused**: Respects family privacy and confidentiality
- **Problem-Solving Oriented**: Takes systematic troubleshooting approaches

## Service Files

### Core Service
- `parlant_service.py` - Main Parlant service implementation with family portal configuration

### Startup and Testing
- `start-all-services.sh` - Script to start both Node.js and Parlant services in parallel
- `test_parlant_service.py` - Comprehensive test suite for validating service functionality

## Starting the Service

### Option 1: Parlant Service Only
```bash
python3 parlant_service.py
```

### Option 2: Both Services (Node.js + Parlant)
```bash
./start-all-services.sh
```

The startup script will run both services in parallel:
- Node.js application on port 5000
- Parlant AI service on port 8800

## API Endpoints

### Health Check
```
GET http://localhost:8800/health
```

### Chat Interface
```
POST http://localhost:8800/api/chat
Content-Type: application/json

{
  "message": "Hello, can you help me with status correction?",
  "session_id": "user_session_123"
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you with status correction! This is a complex process with multiple steps and documentation requirements. Let me guide you through what you need to know...",
  "session_id": "user_session_123"
}
```

## Testing the Service

### Automated Tests
Run the comprehensive test suite:
```bash
python3 test_parlant_service.py
```

The test suite includes:
- Health endpoint verification
- Chat endpoint functionality
- Family portal knowledge testing
- Conversation flow validation

### Manual Testing
1. Start the service: `python3 parlant_service.py`
2. Open another terminal and test with curl:
```bash
curl -X POST http://localhost:8800/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is status correction?", "session_id": "test"}'
```

## Environment Configuration

The service uses the following environment variables:
- `PARLANT_PORT`: Port for the Parlant service (default: 8800)
- `PORT`: Port for the Node.js application (default: 5000)

## Integration with Frontend

The Parlant service provides a REST API that can be integrated into the React frontend. Future implementation will include:

1. **Chat Component**: React component for conversational interface
2. **API Client**: Frontend service to communicate with Parlant endpoints
3. **Context Awareness**: Integration with user's current portal section and data
4. **Session Management**: Persistent conversation sessions tied to user accounts

### Example Frontend Integration
```typescript
// Future implementation example
const response = await fetch('http://localhost:8800/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userMessage,
    session_id: user.id,
    context: {
      currentPage: 'status-correction',
      familyId: user.familyId,
      completedTasks: userTasks.filter(t => t.status === 'completed')
    }
  })
});
```

## Knowledge Areas

The AI assistant is configured with expertise in:

### Status Correction Process
- Task dependencies and prerequisites
- Documentation requirements
- Process timeline and stages
- Common issues and troubleshooting

### Ministry Legitimation
- Checklist requirements
- Document submission processes
- Legitimation timeline
- Compliance requirements

### Portal Navigation
- Dashboard functionality
- Task management interface
- Document center usage
- Message center communication
- Family invitation system
- Notification preferences

### Technical Support
- Document upload troubleshooting
- File format requirements
- Browser compatibility
- Access control and permissions

## Service Dependencies

### Python Packages
- `parlant>=3.0.2` - Core conversational AI framework
- `aiohttp` - For async HTTP testing
- Standard library modules for logging, asyncio, etc.

### System Requirements
- Python 3.11+
- Available ports 8800 and 5000
- Internet access for Parlant model downloads (first run)

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```
   Error: Port 8800 is already in use
   ```
   Solution: Check for existing processes or change PARLANT_PORT environment variable

2. **Import Errors**
   ```
   ModuleNotFoundError: No module named 'parlant'
   ```
   Solution: Ensure parlant is installed: `pip install parlant>=3.0.2`

3. **Service Not Responding**
   - Check if the service started successfully
   - Verify port accessibility
   - Check logs for initialization errors

### Logs and Debugging

The service provides detailed logging:
- Service startup and configuration
- API request/response logging  
- Error details and stack traces
- Performance metrics

## Future Enhancements

- **Context-Aware Responses**: Integration with user's current portal state
- **Proactive Assistance**: Suggestions based on user progress
- **Multi-language Support**: Support for additional languages
- **Voice Interface**: Speech-to-text and text-to-speech capabilities
- **Analytics**: Usage patterns and common questions analysis
- **Advanced Workflows**: Complex multi-step guidance automation

---

For questions or issues, please check the test suite output and service logs for detailed error information.