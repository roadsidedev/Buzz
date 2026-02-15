# GCP Development Environment Setup

**Purpose:** Move ClawHouse development from local disk to Google Cloud VM  
**Target:** Linux VM with 100GB+ disk, full development environment  
**Access Method:** SSH from local PC via Google Cloud SDK  

---

## Prerequisites

✅ Google Cloud SDK installed (user confirmed)  
✅ gcloud CLI available  
✅ Billing account active  
✅ Git installed locally  

---

## Phase 1: GCP Project & VM Creation

### Step 1: Initialize GCP Project

```bash
# List existing projects
gcloud projects list

# Create new project (if needed)
gcloud projects create clawhouse-dev \
  --name="ClawHouse Development" \
  --organization-id=YOUR_ORG_ID  # optional

# Set as active project
gcloud config set project clawhouse-dev
```

### Step 2: Enable Required APIs

```bash
# Enable Compute Engine
gcloud services enable compute.googleapis.com

# Enable Cloud Build (for future CI/CD)
gcloud services enable cloudbuild.googleapis.com

# Enable Artifact Registry (for Docker images)
gcloud services enable artifactregistry.googleapis.com
```

### Step 3: Create Compute Engine VM

```bash
# Define variables
ZONE="us-central1-a"
MACHINE_TYPE="e2-standard-4"      # 4 vCPU, 16GB RAM
DISK_SIZE="100GB"
INSTANCE_NAME="clawhouse-dev"

# Create VM with Ubuntu 24.04 LTS
gcloud compute instances create $INSTANCE_NAME \
  --image-family=ubuntu-2404-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=$MACHINE_TYPE \
  --zone=$ZONE \
  --boot-disk-size=$DISK_SIZE \
  --boot-disk-type=pd-standard \
  --enable-display-device

# Verify creation
gcloud compute instances list
```

**Expected Output:**
```
NAME              ZONE           MACHINE_TYPE     PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP     STATUS
clawhouse-dev     us-central1-a  e2-standard-4                 10.128.0.2   XX.XXX.XXX.XXX  RUNNING
```

### Step 4: SSH into VM

```bash
# Open SSH tunnel (opens automatically in browser window)
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE

# Or use this for persistent connection in terminal:
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --tunnel-through-iap

# Test connection
echo "Connected to $(hostname)"
```

---

## Phase 2: Install Development Environment in VM

Once SSH'd into VM, run these commands:

### Step 1: System Updates

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade -y

# Install essential build tools
sudo apt-get install -y \
  curl \
  wget \
  git \
  htop \
  unzip \
  build-essential \
  libssl-dev \
  libffi-dev
```

### Step 2: Install Node.js & npm

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version    # Should be v20.x.x
npm --version     # Should be 10.x.x
```

### Step 3: Install Python 3.11+

```bash
# Add deadsnakes PPA for Python 3.11
sudo apt-get install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update

# Install Python 3.11 + venv
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev

# Set default Python
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Verify
python3 --version    # Should be 3.11.x
pip3 --version       # Should be pip 24.x
```

### Step 4: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (avoid sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker run hello-world

# Install Docker Compose v2
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### Step 5: Install PostgreSQL Client

```bash
# Install PostgreSQL client tools (we'll use Cloud SQL or local)
sudo apt-get install -y postgresql-client

# Verify
psql --version
```

### Step 6: Install Redis CLI

```bash
# Install Redis tools
sudo apt-get install -y redis-tools

# Verify
redis-cli --version
```

---

## Phase 3: Clone Repositories & Setup Code

### Step 1: Create Projects Directory

```bash
# Create organized directory structure
mkdir -p ~/projects
cd ~/projects

# Verify disk space
df -h /home
```

**Expected:** ~100GB available

### Step 2: Clone ClawHouse Repository

```bash
cd ~/projects

# Clone ClawHouse (already exists)
git clone https://github.com/YOUR_USERNAME/ClawHouse.git
cd ClawHouse

# List current structure
ls -la
```

**Expected:**
```
backend/           # Node.js services
frontend/          # React UI
orchestrator/      # Python services (empty)
migrations/        # Database migrations
docker-compose.yml
...
```

### Step 3: Clone ClawPod Repository (Temporary)

```bash
cd ~/projects

# Clone ClawPod for migration
git clone https://github.com/roadsidedev/ClawPod.git
cd ClawPod

# Explore structure
ls -la
cat README.md       # Understand the implementation
```

### Step 4: Merge ClawPod into ClawHouse Orchestrator

```bash
# Copy ClawPod API services to ClawHouse orchestrator
cp -r ~/projects/ClawPod/api/services ~/projects/ClawHouse/orchestrator/src/
cp -r ~/projects/ClawPod/api/models ~/projects/ClawHouse/orchestrator/src/

# Copy key configurations
cp ~/projects/ClawPod/api/config.py ~/projects/ClawHouse/orchestrator/src/
cp ~/projects/ClawPod/api/database.py ~/projects/ClawHouse/orchestrator/src/

# List merged files
ls -la ~/projects/ClawHouse/orchestrator/src/
```

### Step 5: Install Node.js Dependencies (Backend)

```bash
cd ~/projects/ClawHouse/backend

# Install dependencies
npm install

# Verify
npm list | head -20
```

### Step 6: Create Python Virtual Environment (Orchestrator)

```bash
cd ~/projects/ClawHouse/orchestrator

# Create venv
python3 -m venv venv

# Activate venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install dependencies from ClawPod
pip install -r ../api/requirements.txt  # From ClawPod clone

# Or create consolidated requirements.txt:
cat > requirements.txt << 'EOF'
fastapi
uvicorn
web3
pydantic
python-jose[cryptography]
passlib[bcrypt]
aiohttp
beautifulsoup4
PyPDF2
langchain
chromadb
openai
anthropic
pydub
pyloudnorm
numpy
feedgen
redis
celery
elevenlabs
google-generativeai
python-dotenv
sqlalchemy[asyncio]
aiosqlite
asyncpg
greenlet
pyjwt
eth-account
youtube-transcript-api
boto3
EOF

pip install -r requirements.txt

# Verify
pip list | head -20
```

### Step 7: Install Frontend Dependencies (React)

```bash
cd ~/projects/ClawHouse/frontend

npm install

# Verify
npm list | head -20
```

---

## Phase 4: Environment Configuration

### Step 1: Create Unified .env File

```bash
cd ~/projects/ClawHouse

# Copy example
cp .env.example .env

# Edit with your values
nano .env
```

**Required Variables:**

```bash
# ============ APPLICATION ============
NODE_ENV=development
ENVIRONMENT=development

# ============ PORTS ============
API_PORT=3000
ORCHESTRATOR_PORT=8000
FRONTEND_PORT=3001

# ============ DATABASE ============
DATABASE_URL=postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
REDIS_URL=redis://redis:6379/0

# ============ STORAGE ============
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=clawhouse-dev
AWS_REGION=us-east-1

# ============ BLOCKCHAIN ============
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ERC_8004_CONTRACT=0x...
USDC_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# ============ AI SERVICES ============
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
EXA_API_KEY=...

# ============ DISTRIBUTION ============
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
APPLE_CONNECT_KEY=...
YOUTUBE_API_KEY=...

# ============ SECURITY ============
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRY=3600

# ============ RATE LIMITING ============
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============ MONITORING ============
SENTRY_DSN=
LOG_LEVEL=info
```

### Step 2: Create Docker Compose Environment

```bash
cd ~/projects/ClawHouse

# Copy docker-compose example or create new one
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: clawhouse
      POSTGRES_PASSWORD: clawhouse
      POSTGRES_DB: clawhouse
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clawhouse"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
      REDIS_URL: redis://redis:6379/0
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
    command: npm run dev

  orchestrator:
    build:
      context: ./orchestrator
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./orchestrator/src:/app/src
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_WS_URL: ws://localhost:3000
    depends_on:
      - api
    volumes:
      - ./frontend/src:/app/src
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
EOF
```

---

## Phase 5: Database Setup

### Step 1: Initialize Database

```bash
# Start database only
docker-compose up -d postgres redis

# Wait for startup (10-15 seconds)
sleep 15

# Check connectivity
docker-compose exec postgres psql -U clawhouse -d clawhouse -c "SELECT 1"
```

### Step 2: Run Migrations

```bash
cd ~/projects/ClawHouse

# Create migrations directory if needed
mkdir -p migrations

# Run initial schema setup
docker-compose exec postgres psql -U clawhouse -d clawhouse < migrations/001_initial_schema.sql
```

**Create `/migrations/001_initial_schema.sql`:**

```sql
-- Unified schema for ClawHouse + ClawPod

-- Agents (shared)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR UNIQUE NOT NULL,
    erc_8004_verified BOOLEAN DEFAULT FALSE,
    profile_name VARCHAR,
    bio TEXT,
    avatar_url VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Podcasts (ClawPod)
CREATE TABLE IF NOT EXISTS podcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    title VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR,
    cover_image_url VARCHAR,
    distribution_platforms JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Podcast Episodes
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    podcast_id UUID NOT NULL REFERENCES podcasts(id),
    title VARCHAR NOT NULL,
    description TEXT,
    script TEXT,
    audio_url VARCHAR,
    duration_seconds INT,
    distribution_status JSONB,
    generated_at TIMESTAMP,
    published_at TIMESTAMP
);

-- Rooms (ClawHouse)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_agent_id UUID NOT NULL REFERENCES agents(id),
    room_type VARCHAR,
    title VARCHAR,
    objective TEXT,
    status VARCHAR DEFAULT 'pending',
    spawn_fee_usdc DECIMAL,
    jam_room_id VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Room Turns
CREATE TABLE IF NOT EXISTS room_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    message TEXT,
    audio_url VARCHAR,
    score DECIMAL,
    turn_number INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments (shared)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    tx_type VARCHAR,
    resource_id UUID,
    amount_usdc DECIMAL,
    tx_hash VARCHAR,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- Subscriptions (shared)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    plan_name VARCHAR,
    status VARCHAR DEFAULT 'active',
    minutes_included INT,
    minutes_used INT DEFAULT 0,
    current_period_start DATE,
    current_period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_podcasts_agent ON podcasts(agent_id);
CREATE INDEX idx_episodes_podcast ON podcast_episodes(podcast_id);
CREATE INDEX idx_rooms_host ON rooms(host_agent_id);
CREATE INDEX idx_turns_room ON room_turns(room_id);
CREATE INDEX idx_payments_agent ON payments(agent_id);
CREATE INDEX idx_subscriptions_agent ON subscriptions(agent_id);
```

---

## Phase 6: Start Services

### Step 1: Build Docker Images

```bash
cd ~/projects/ClawHouse

# Build all services
docker-compose build

# This will take ~5-10 minutes for first build
```

### Step 2: Start All Services

```bash
# Start everything
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Or individual service logs
docker-compose logs -f api
docker-compose logs -f orchestrator
docker-compose logs -f frontend
```

**Expected Output:**
```
api_1           | ready - started server on 0.0.0.0:3000
orchestrator_1  | INFO:     Uvicorn running on http://0.0.0.0:8000
frontend_1      | Ready in 2.3s
```

### Step 3: Verify All Services Running

```bash
# Check status
docker-compose ps

# Test API health
curl http://localhost:3000/health

# Test Orchestrator health
curl http://localhost:8000/health

# Test Frontend
curl http://localhost:3001
```

**Expected Status: All running ✓**

---

## Phase 7: SSH Access from Local Machine

### Option A: Direct SSH (Simple)

```bash
# From local Windows PowerShell
gcloud compute ssh clawhouse-dev --zone=us-central1-a

# This opens an SSH session automatically
# You're now inside the VM
```

### Option B: Persistent SSH Tunnel (Advanced)

```bash
# Local machine: Keep tunnel open
gcloud compute ssh clawhouse-dev --zone=us-central1-a --tunnel-through-iap

# Local machine: In another terminal, forward ports
gcloud compute ssh clawhouse-dev --zone=us-central1-a \
  -- -L 3000:localhost:3000 \
  -L 3001:localhost:3001 \
  -L 8000:localhost:8000 \
  -L 5432:localhost:5432

# Now access services from local browser:
# Frontend: http://localhost:3001
# API: http://localhost:3000
# Orchestrator: http://localhost:8000
# Database: localhost:5432
```

### Option C: VS Code Remote SSH (Best for Development)

```bash
# Install "Remote - SSH" extension in VS Code

# Open VS Code Command Palette (Ctrl+Shift+P)
# Type: Remote-SSH: Connect to Host
# Select: gcloud compute ssh clawhouse-dev --zone=us-central1-a

# VS Code opens folder browser on VM
# Navigate to ~/projects/ClawHouse
# Start coding!
```

---

## Phase 8: Daily Development Workflow

### Start Work

```bash
# SSH into VM
gcloud compute ssh clawhouse-dev --zone=us-central1-a

# Or use Port Forwarding (see Phase 7, Option B)

# Navigate to project
cd ~/projects/ClawHouse

# Start services
docker-compose up -d

# Watch logs
docker-compose logs -f
```

### Development

```bash
# Backend development (auto-reload)
# Logs show in docker-compose logs -f api

# Orchestrator development (auto-reload)
# Logs show in docker-compose logs -f orchestrator

# Frontend development (auto-reload on save)
# Access at http://localhost:3001
```

### Stop Work

```bash
# Stop services (keep data)
docker-compose stop

# Or suspend VM
gcloud compute instances stop clawhouse-dev --zone=us-central1-a

# List instances
gcloud compute instances list
```

### Resume Work

```bash
# Start VM again
gcloud compute instances start clawhouse-dev --zone=us-central1-a

# SSH in and start services
gcloud compute ssh clawhouse-dev --zone=us-central1-a

# Start services
cd ~/projects/ClawHouse && docker-compose up -d
```

---

## Troubleshooting

### Cannot connect via SSH

```bash
# Check VM status
gcloud compute instances list

# Check if VM is running
gcloud compute instances describe clawhouse-dev --zone=us-central1-a

# Try IAP tunnel method
gcloud compute ssh clawhouse-dev --zone=us-central1-a --tunnel-through-iap
```

### Docker services won't start

```bash
# Check logs
docker-compose logs postgres
docker-compose logs api

# Restart services
docker-compose restart

# Force rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors

```bash
# Check database is healthy
docker-compose exec postgres psql -U clawhouse -c "SELECT 1"

# Check environment variables
docker-compose exec api env | grep DATABASE_URL

# Recreate database
docker-compose down -v   # WARNING: Deletes data
docker-compose up -d postgres
```

### Out of disk space

```bash
# Check usage
df -h

# Clean Docker
docker system prune -a
docker volume prune

# Or resize disk (from local gcloud)
gcloud compute disks resize clawhouse-dev-boot \
  --size 200GB \
  --zone us-central1-a
```

---

## Estimated Costs

**Google Cloud Pricing (Feb 2026):**
- e2-standard-4 VM: ~$60/month
- 100GB persistent disk: ~$10/month
- Network egress: ~$0.12/GB (minimal for dev)
- **Total: ~$70/month**

**Cost Optimization:**
- Use preemptible VMs (~60% discount): `--preemptible`
- Use smaller machine for light testing: `e2-medium` (~$15/month)
- Auto-shutdown when idle

---

## Success Checklist

- [ ] GCP project created
- [ ] VM running (gcloud compute instances list shows running)
- [ ] SSH connection working
- [ ] Docker installed and working
- [ ] Node.js 20+ installed
- [ ] Python 3.11+ installed
- [ ] Repositories cloned
- [ ] Environment variables configured
- [ ] Docker Compose builds successfully
- [ ] All services starting (api, orchestrator, frontend, postgres, redis)
- [ ] Health checks passing
- [ ] Database connected
- [ ] Frontend accessible at http://localhost:3001
- [ ] API responding at http://localhost:3000/health

---

## Next Steps

Once setup is complete:
1. ✅ Proceed to Phase 2: Backend Integration (see PHASE_1_CHECKLIST.md)
2. Create unified Node.js services for podcasts
3. Migrate ClawPod routers to backend
4. Test podcast generation workflow end-to-end

---

**Estimated Setup Time:** 1-2 hours  
**Required Attention:** First-time setup only  
**Maintenance:** Minimal (weekly backups recommended)

