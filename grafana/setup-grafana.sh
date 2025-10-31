#!/bin/bash

echo "📊 Setting up Grafana directory structure..."
echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p grafana/provisioning/datasources
mkdir -p grafana/provisioning/dashboards

# Create prometheus.yml
echo "📝 Creating prometheus.yml..."
cat > grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create dashboard.yml
echo "📝 Creating dashboard.yml..."
cat > grafana/provisioning/dashboards/dashboard.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'BullMQ'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# Check if bullmq-dashboard.json exists, if not create a placeholder
if [ ! -f grafana/provisioning/dashboards/bullmq-dashboard.json ]; then
    echo "⚠️  bullmq-dashboard.json not found"
    echo "📝 Creating placeholder (you should replace this with the full dashboard)"
    cat > grafana/provisioning/dashboards/bullmq-dashboard.json << 'EOF'
{
  "title": "BullMQ Queue Monitoring",
  "uid": "bullmq-dashboard",
  "version": 0,
  "panels": []
}
EOF
    echo ""
    echo "⚠️  IMPORTANT: Replace grafana/provisioning/dashboards/bullmq-dashboard.json"
    echo "   with the full dashboard JSON from the outputs!"
else
    echo "✅ bullmq-dashboard.json already exists"
fi

echo ""
echo "✅ Grafana directory structure created!"
echo ""
echo "📂 Directory structure:"
find grafana -type f -o -type d
echo ""
echo "🎯 What was created:"
echo "  ✓ grafana/provisioning/datasources/prometheus.yml"
echo "  ✓ grafana/provisioning/dashboards/dashboard.yml"
echo "  ✓ grafana/provisioning/dashboards/bullmq-dashboard.json"
echo ""
