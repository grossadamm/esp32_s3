#!/bin/bash

# Update voice agent with GPU container STT
set -e

JETSON_IP="192.168.1.108"

echo "🔄 Updating Voice Agent with GPU Container STT"
echo "=============================================="

# Copy updated voice agent code
echo "📁 Copying updated voice agent..."
rsync -avz voice-agent/src/ nvidia@${JETSON_IP}:~/voice-agent/voice-agent/src/

# Rebuild and restart on Jetson
ssh nvidia@${JETSON_IP} << 'EOF'
cd ~/voice-agent

echo "🔨 Rebuilding voice agent..."
cd voice-agent && npm run build && cd ..

echo "🛑 Stopping voice agent..."
if [ -f voice-agent.pid ]; then
    kill $(cat voice-agent.pid) 2>/dev/null || true
    rm voice-agent.pid
fi

echo "🚀 Starting voice agent with GPU container STT..."
export STT_PREFER_LOCAL=true
export NODE_ENV=production

nohup node voice-agent/dist/index.js > logs/voice-agent.log 2>&1 &
echo $! > voice-agent.pid

sleep 3
curl -s http://localhost:3000/health && echo "✅ Voice agent restarted with GPU support"

# Show STT status
echo ""
echo "📊 STT Service Status:"
curl -s http://localhost:3000/api/stt-status | python3 -m json.tool || echo "STT status check failed"

EOF

echo ""
echo "🎉 Voice Agent Updated!"
echo "====================="
echo "✅ GPU Container STT: Enabled"
echo "✅ Voice Agent: http://${JETSON_IP}:3000"
echo ""
echo "🧪 Test with GPU acceleration:"
echo "curl -X POST -F 'audio=@voice-agent/tests/audio/monthly-expenses.wav' http://${JETSON_IP}:3000/api/audio --output gpu-response.mp3" 