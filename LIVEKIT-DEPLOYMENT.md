# LiveKit Self-Hosted Deployment Guide

**Complete guide for deploying LiveKit server and integrating with TeamSync**

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Docker Compose Setup (Recommended)](#docker-compose-setup)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Provider Guides](#cloud-provider-guides)
6. [Integration with TeamSync](#integration-with-teamsync)
7. [Troubleshooting](#troubleshooting)
8. [Performance Tuning](#performance-tuning)
9. [Security Best Practices](#security-best-practices)
10. [Cost Estimation](#cost-estimation)

---

## Prerequisites

Before deploying LiveKit, ensure you have:

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Domain** with SSL certificate (Let's Encrypt recommended)
- **Open ports**: 7880 (signaling), 7881 (TURN), 7882 (WebRTC)
- **Minimum specs**: 2 vCPU, 4GB RAM (for up to 25 concurrent users)
- **Operating System**: Linux (Ubuntu 22.04 LTS recommended)

### Recommended Server Specifications by User Count

| Concurrent Users | vCPUs | RAM    | Bandwidth       |
|------------------|-------|--------|-----------------|
| 1-25             | 2     | 4 GB   | 10 Mbps up/down |
| 26-50            | 4     | 8 GB   | 25 Mbps up/down |
| 51-100           | 8     | 16 GB  | 50 Mbps up/down |
| 101-250          | 16    | 32 GB  | 100 Mbps up/down|

---

## Deployment Options

### Option A: Docker Compose (Easiest) ✅ Recommended
**Best for**: Small to medium teams (< 50 users), single server deployment

### Option B: Kubernetes
**Best for**: Large teams, high availability, auto-scaling needs

### Option C: Cloud Managed Services
**Best for**: Quick deployment, managed infrastructure
- AWS ECS with Fargate
- Google Cloud Run
- DigitalOcean App Platform

---

## Docker Compose Setup

### Step 1: Create Project Directory

```bash
mkdir livekit-server && cd livekit-server
```

### Step 2: Create livekit.yaml Configuration

Create `livekit.yaml`:

```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  # Replace with your server's public IP
  node_ip: "YOUR_SERVER_IP"

keys:
  # Generate with: openssl rand -base64 32
  devkey: "YOUR_API_KEY"
  devsecretsecret: "YOUR_API_SECRET"

turn:
  enabled: true
  domain: "turn.yourdomain.com"
  tls_port: 5349
  udp_port: 3478

logging:
  level: info
  # Enable for development, disable in production
  pion_level: warn
  sample: false

room:
  auto_create: true
  enable_recording: false
  max_participants: 50
  empty_timeout: 60
```

### Step 3: Generate API Credentials

```bash
# Generate API Key
export LIVEKIT_API_KEY=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 24)
echo "API Key: $LIVEKIT_API_KEY"

# Generate API Secret
export LIVEKIT_API_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
echo "API Secret: $LIVEKIT_API_SECRET"

# Save these! You'll need them for TeamSync configuration
```

### Step 4: Create docker-compose.yml

```yaml
version: '3.9'

services:
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    environment:
      - LIVEKIT_KEYS=${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}
    ports:
      - "7880:7880"
      - "7881:7881/tcp"
      - "7882:7882/tcp"
      - "50000-60000:50000-60000/udp"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### Step 5: Configure Domain and SSL

#### Option A: Using Nginx Reverse Proxy (Recommended)

Install Nginx and Certbot:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create Nginx configuration `/etc/nginx/sites-available/livekit`:

```nginx
# WebSocket proxy for LiveKit
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name livekit.yourdomain.com;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/livekit.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/livekit.yourdomain.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings for long-lived connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name livekit.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable site and obtain SSL certificate:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d livekit.yourdomain.com

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: Start Services

```bash
# Start LiveKit and Redis
docker-compose up -d

# Check logs
docker-compose logs -f livekit

# Verify it's running
curl https://livekit.yourdomain.com
```

---

## Kubernetes Deployment

### Step 1: Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 2: Add LiveKit Helm Repository

```bash
helm repo add livekit https://helm.livekit.io
helm repo update
```

### Step 3: Create values.yaml

```yaml
livekit:
  domain: livekit.yourdomain.com
  numReplicas: 2
  
  config:
    port: 7880
    rtc:
      port_range_start: 50000
      port_range_end: 60000
    keys:
      LIVEKIT_KEY_devkey: "YOUR_API_KEY"
      LIVEKIT_SECRET_devkey: "YOUR_API_SECRET"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    - secretName: livekit-tls
      hosts:
        - livekit.yourdomain.com

redis:
  enabled: true
  architecture: standalone
```

### Step 4: Deploy

```bash
helm install livekit livekit/livekit-server -f values.yaml --namespace livekit --create-namespace
```

---

## Cloud Provider Guides

### AWS ECS Deployment

1. **Create ECS Cluster**
```bash
aws ecs create-cluster --cluster-name livekit-cluster
```

2. **Create Task Definition** (save as `livekit-task.json`):
```json
{
  "family": "livekit",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "livekit",
      "image": "livekit/livekit-server:latest",
      "portMappings": [
        {"containerPort": 7880, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "LIVEKIT_KEYS", "value": "YOUR_KEY:YOUR_SECRET"}
      ]
    }
  ]
}
```

3. **Deploy Service**
```bash
aws ecs create-service \
  --cluster livekit-cluster \
  --service-name livekit \
  --task-definition livekit \
  --desired-count 2 \
  --launch-type FARGATE
```

### Google Cloud Run

```bash
gcloud run deploy livekit \
  --image livekit/livekit-server:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars LIVEKIT_KEYS=YOUR_KEY:YOUR_SECRET \
  --port 7880 \
  --allow-unauthenticated
```

### DigitalOcean App Platform

1. Create `app.yaml`:
```yaml
name: livekit
services:
  - name: livekit-server
    image:
      registry_type: DOCKER_HUB
      registry: livekit
      repository: livekit-server
      tag: latest
    envs:
      - key: LIVEKIT_KEYS
        value: YOUR_KEY:YOUR_SECRET
    http_port: 7880
```

2. Deploy:
```bash
doctl apps create --spec app.yaml
```

---

## Integration with TeamSync

### Step 1: Get Your Credentials

You should have:
- **Server URL**: `wss://livekit.yourdomain.com` (or `https://` for HTTP)
- **API Key**: The key you generated earlier
- **API Secret**: The secret you generated earlier

### Step 2: Configure in TeamSync Admin Panel

1. Log in to TeamSync as an admin
2. Navigate to **Admin → LiveKit Configuration**
3. Enter your credentials:
   - **LiveKit Server URL**: `wss://livekit.yourdomain.com`
   - **API Key**: `YOUR_API_KEY`
   - **API Secret**: `YOUR_API_SECRET`
4. Click **Save Configuration**

### Step 3: Test Connection

1. Click **"Start Call"** in any TeamSync channel
2. Allow microphone/camera permissions
3. Verify you can see/hear yourself in the preview
4. Click **"Join Call"**
5. Invite another user to test audio/video

### Step 4: Verify in Logs

Check LiveKit logs to confirm connections:

```bash
docker-compose logs -f livekit
```

You should see:
```
INFO    participant joined      {"room": "channel-xyz", "participant": "user-123"}
```

---

## Troubleshooting

### Issue: "Failed to join call"

**Causes**:
- LiveKit server not running
- Incorrect API credentials
- Firewall blocking ports

**Solutions**:
```bash
# Check LiveKit status
docker-compose ps

# Check LiveKit logs
docker-compose logs livekit

# Verify API credentials match in both livekit.yaml and TeamSync

# Check firewall (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:60000/udp
```

### Issue: Poor video quality

**Causes**:
- Insufficient bandwidth
- Not using TURN server
- Too many participants

**Solutions**:
```yaml
# In livekit.yaml, enable adaptive bitrate
rtc:
  use_adaptive_bitrate: true
  # Limit simulcast layers
  simulcast:
    enabled: true
    layers:
      - quality: HIGH
        bitrate: 2000000
      - quality: MEDIUM
        bitrate: 500000
      - quality: LOW
        bitrate: 150000
```

### Issue: "Connection timeout"

**Causes**:
- NAT traversal issues
- TURN server not configured

**Solutions**:
```yaml
# Configure TURN server in livekit.yaml
turn:
  enabled: true
  domain: "turn.yourdomain.com"
  external_tls: true
```

### Issue: Audio echo

**Solutions**:
- Enable echo cancellation in browser
- Users should use headphones
- Check microphone sensitivity settings

### Test WebRTC Connectivity

Use LiveKit's test page: https://livekit.io/webrtc-test

---

## Performance Tuning

### OS-Level Optimizations (Linux)

```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize network settings
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
sudo sysctl -w net.ipv4.tcp_rmem="4096 87380 67108864"
sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 67108864"

# Make persistent
echo "net.core.rmem_max = 134217728" | sudo tee -a /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" | sudo tee -a /etc/sysctl.conf
```

### LiveKit Configuration Tuning

```yaml
# livekit.yaml
rtc:
  # Reduce port range for better firewall management
  port_range_start: 50000
  port_range_end: 50100  # 100 ports = ~25 concurrent calls
  
  # Enable congestion control
  congestion_control: true
  
  # Packet buffer settings
  buffer_size: 500

# Limit resources per room
room:
  max_participants: 50
  max_video_layers: 3
```

### Redis Optimization

```bash
# Add to docker-compose.yml under redis service
command: >
  redis-server
  --maxmemory 2gb
  --maxmemory-policy allkeys-lru
  --save 60 1000
```

---

## Security Best Practices

### 1. Secure API Keys

- **Never** commit keys to version control
- Use environment variables
- Rotate keys every 90 days

```bash
# Store in .env file (add to .gitignore)
LIVEKIT_API_KEY=your_key_here
LIVEKIT_API_SECRET=your_secret_here

# Reference in docker-compose.yml
environment:
  - LIVEKIT_KEYS=${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}
```

### 2. Enable End-to-End Encryption

```yaml
# livekit.yaml
room:
  enable_e2ee: true
```

### 3. Configure Access Tokens with Short Expiration

TeamSync automatically handles this, but verify in `supabase/functions/create-livekit-token/index.ts`:

```typescript
const at = new AccessToken(apiKey, apiSecret, {
  identity: userId,
  ttl: '15m', // Token expires in 15 minutes
});
```

### 4. Set Up Monitoring

Install Grafana + Prometheus:

```yaml
# Add to docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure_password
```

### 5. Regular Updates

```bash
# Update LiveKit image
docker-compose pull
docker-compose up -d

# Check for updates
docker images livekit/livekit-server
```

---

## Cost Estimation

### Self-Hosted vs Cloud Comparison

| Deployment      | 25 Users | 100 Users | 250 Users | Notes                          |
|-----------------|----------|-----------|-----------|--------------------------------|
| **DigitalOcean Droplet** | $24/mo  | $96/mo    | $384/mo   | + bandwidth costs              |
| **AWS EC2 (t3.medium)** | $30/mo  | $120/mo   | $480/mo   | + bandwidth (~$0.09/GB)        |
| **GCP Compute (e2-standard-2)** | $35/mo  | $140/mo   | $560/mo   | + bandwidth (~$0.12/GB)        |
| **Managed LiveKit Cloud** | $99/mo  | $399/mo   | $999/mo   | All-inclusive                  |

### Bandwidth Usage Calculator

Average bandwidth per participant:
- **Audio only**: ~50 KB/s (~180 MB/hour)
- **Video (720p)**: ~500 KB/s (~1.8 GB/hour)
- **Video (1080p)**: ~2 MB/s (~7.2 GB/hour)

**Example**: 50 users in 1-hour video meetings daily:
- Daily: 50 users × 1 hour × 1.8 GB = 90 GB/day
- Monthly: 90 GB × 30 days = 2.7 TB/month
- Cost on AWS: 2700 GB × $0.09 = ~$243/month bandwidth

### Recommended Starting Point

For teams under 50 users:
- **DigitalOcean Droplet** (4 vCPU, 8GB RAM): $48/month
- **Domain + SSL**: $15/year
- **Total**: ~$50/month

---

## Monitoring and Maintenance

### Health Checks

```bash
# Check LiveKit health endpoint
curl https://livekit.yourdomain.com/

# Expected response: HTTP 200 with JSON
```

### Log Monitoring

```bash
# Follow logs in real-time
docker-compose logs -f --tail=100 livekit

# Search for errors
docker-compose logs livekit | grep ERROR

# Check Redis logs
docker-compose logs redis
```

### Backup and Disaster Recovery

```bash
# Backup configuration
tar -czf livekit-backup-$(date +%Y%m%d).tar.gz livekit.yaml docker-compose.yml

# Backup Redis data
docker-compose exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb ./redis-backup.rdb
```

---

## Next Steps

1. **Enable Recording** (Phase 9 feature):
   ```yaml
   # livekit.yaml
   room:
     enable_recording: true
   ```

2. **Set Up Analytics**: Integrate with TeamSync metrics dashboard

3. **Load Testing**: Use `livekit-cli` to simulate concurrent users

4. **Custom Webhooks**: Receive events for call start/end

---

## Support and Resources

- **Official Docs**: https://docs.livekit.io
- **GitHub**: https://github.com/livekit/livekit
- **Community**: https://livekit.io/slack
- **TeamSync Docs**: See ADMIN-GUIDE.md

---

**Congratulations!** 🎉 Your LiveKit server is now deployed and integrated with TeamSync.