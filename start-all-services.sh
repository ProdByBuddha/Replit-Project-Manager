#!/bin/bash

# Family Portal - Start All Services
# Starts both the Node.js application and Parlant AI service in parallel

echo "=================================="
echo "STARTING FAMILY PORTAL SERVICES"
echo "=================================="

# Set environment variables
export NODE_ENV=development
export PORT=5000
export PARLANT_PORT=8800

echo "Starting services in parallel..."
echo "- Node.js application on port 5000"
echo "- Parlant AI service on port 8800"

# Start both services in parallel using background processes
npm run dev &
NODEJS_PID=$!

python3 parlant_service.py &
PARLANT_PID=$!

echo "Node.js PID: $NODEJS_PID"
echo "Parlant PID: $PARLANT_PID"

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $NODEJS_PID 2>/dev/null
    kill $PARLANT_PID 2>/dev/null
    echo "Services stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Wait for both processes
wait $NODEJS_PID $PARLANT_PID

echo "All services have exited."