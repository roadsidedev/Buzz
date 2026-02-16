# ERC-8004 Contract Deployment - Quick Start (5 Steps)

**Total Time:** 20-30 minutes  
**Cost:** ~$1-2 in testnet gas  
**Difficulty:** Low (automated script does the work)

---

## Prerequisites (5 min)

### 1. MetaMask Wallet
- [ ] Install MetaMask browser extension
- [ ] Create account or import existing
- [ ] Switch to "Base Sepolia" network (testnet)

### 2. Testnet ETH
```
Go to: https://www.base.org/faucet
- Connect MetaMask wallet
- Click "Send me ETH"
- Receive 0.1 Base Sepolia ETH
```

### 3. Node.js
```bash
# Check version
node --version    # Should be 18+
npm --version     # Should be 9+
```

---

## Step 1: Get Your Private Key (2 min)

### From MetaMask:

1. Click MetaMask icon → Settings
2. Security & Privacy
3. Show Private Key
4. Enter password
5. Copy the key (starts with `0x`)

**⚠️ NEVER share this key!**

---

## Step 2: Clone Contract Code (2 min)

Create `contracts/AgentRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    mapping(address => bool) public verifiedAgents;
    mapping(address => bool) public registeredAgents;
    
    event AgentRegistered(address indexed agent);
    event AgentRevoked(address indexed agent);
    
    function registerAgent(address agent) external onlyOwner {
        verifiedAgents[agent] = true;
        registeredAgents[agent] = true;
        emit AgentRegistered(agent);
    }
    
    function revokeAgent(address agent) external onlyOwner {
        verifiedAgents[agent] = false;
        emit AgentRevoked(agent);
    }
    
    function isVerifiedAgent(address agent) 
        external 
        view 
        returns (bool) 
    {
        return verifiedAgents[agent];
    }
    
    function isAgentOwner(address agent, address owner)
        external
        view
        returns (bool)
    {
        return verifiedAgents[owner];
    }
}
```

---

## Step 3: Initialize Hardhat (3 min)

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Initialize
npx hardhat

# When prompted:
# "Create a TypeScript project?" → Yes
# "Install all dependencies?" → Yes
```

---

## Step 4: Create Deployment Script (3 min)

Create `scripts/deploy.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying AgentRegistry to Base Sepolia...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying from: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    throw new Error("❌ No ETH! Fund from faucet: https://www.base.org/faucet");
  }
  
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const contract = await AgentRegistry.deploy();
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`✅ AgentRegistry deployed to: ${address}\n`);
  
  console.log("📋 Next steps:");
  console.log(`   1. Update .env with:`);
  console.log(`      ERC8004_CONTRACT_ADDRESS=${address}`);
  console.log(`\n   2. View on BaseScan:`);
  console.log(`      https://sepolia.basescan.org/address/${address}`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exitCode = 1;
});
```

---

## Step 5: Deploy! (5 min)

### 5a. Create `.env.local` (NEVER commit!)

```bash
# Create file
cat > .env.local << EOF
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0xYOUR_KEY_HERE
EOF

# Or manually create and paste:
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# DEPLOYER_PRIVATE_KEY=0x... (from MetaMask Step 1)
```

### 5b. Update `hardhat.config.ts`

Replace network config with:

```typescript
networks: {
  "base-sepolia": {
    url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    accounts: process.env.DEPLOYER_PRIVATE_KEY 
      ? [process.env.DEPLOYER_PRIVATE_KEY]
      : [],
  },
},
```

### 5c. Install OpenZeppelin

```bash
npm install @openzeppelin/contracts
```

### 5d. Deploy

```bash
# Compile
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.ts --network base-sepolia
```

---

## Expected Output

```
🚀 Deploying AgentRegistry to Base Sepolia...

📝 Deploying from: 0x1234567890123456789012345678901234567890
💰 Balance: 0.1 ETH

✅ AgentRegistry deployed to: 0x8004A818BFB912233c491871b3d84c89A494BD9e

📋 Next steps:
   1. Update .env with:
      ERC8004_CONTRACT_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e

   2. View on BaseScan:
      https://sepolia.basescan.org/address/0x8004...
```

---

## Step 6: Update Backend Config (2 min)

### Update `.env`

```bash
ERC8004_CONTRACT_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_RPC_URL=https://sepolia.base.org
```

### Verify Backend Starts

```bash
npm run dev

# Should start without ERC8004 errors ✅
```

---

## Step 7: Run Tests (2 min)

```bash
npm run test -- day5-erc8004-jam.test.ts

# Expected: All 11 tests pass ✅
```

---

## Troubleshooting

### "No ETH!"
```
❌ Error: Deployer account has no balance
✅ Fix: https://www.base.org/faucet (request 0.1 Base Sepolia ETH)
```

### "Invalid private key"
```
❌ Error: invalid key
✅ Fix: Make sure key includes 0x prefix
        BASE_SEPOLIA_RPC_URL=0x1234...
        NOT: BASE_SEPOLIA_RPC_URL=1234...
```

### "Contract compilation failed"
```
❌ Error: Solidity version mismatch
✅ Fix: npm install @openzeppelin/contracts
```

### "Network error"
```
❌ Error: Cannot reach Base Sepolia
✅ Fix: RPC URL is correct: https://sepolia.base.org
```

---

## Verification Checklist

After deployment:

- [ ] Contract address from output: `0x...`
- [ ] Added to `.env`: `ERC8004_CONTRACT_ADDRESS=0x...`
- [ ] Backend starts without errors
- [ ] Tests pass: `npm run test`
- [ ] Contract on BaseScan: https://sepolia.basescan.org/address/0x...

---

## Next: Register Test Agent (Optional)

Create `scripts/register-test-agent.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.ERC8004_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("ERC8004_CONTRACT_ADDRESS not set");
  }
  
  const contract = await ethers.getContractAt(
    "AgentRegistry", 
    contractAddress
  );
  
  const testAgent = ethers.Wallet.createRandom().address;
  
  console.log(`Registering test agent: ${testAgent}`);
  
  const tx = await contract.registerAgent(testAgent);
  await tx.wait();
  
  console.log("✅ Test agent registered!");
}

main().catch(console.error);
```

Run with:
```bash
npx hardhat run scripts/register-test-agent.ts --network base-sepolia
```

---

## Timeline

```
Total: 20-30 minutes

Breakdown:
├─ Prerequisites (MetaMask, ETH): 5 min
├─ Code setup (contract, hardhat): 5 min
├─ Configuration (.env): 2 min
├─ Deployment: 5 min
├─ Waiting for confirmation: 1 min
├─ Update backend: 2 min
└─ Tests: 2 min
```

---

## Files You'll Create/Modify

**New:**
```
contracts/AgentRegistry.sol
scripts/deploy.ts
.env.local (never commit!)
```

**Modify:**
```
hardhat.config.ts
.env
```

---

## After Deployment

✅ Smart contract deployed and verified  
✅ Backend updated with address  
✅ Tests passing  
✅ Ready for Day 6 (payments)  

---

## Support

**Getting stuck?**
- Check `ERC8004_DEPLOYMENT_GUIDE.md` for detailed explanations
- Review `ERC8004_CONTRACT_DEPLOYMENT_BLOCKER.md` for troubleshooting
- Read Hardhat docs: https://hardhat.org

**Verify deployment:**
```
BaseScan: https://sepolia.basescan.org
Search for your contract address
```

---

**You've got this! 🚀**

Questions? Everything is documented in:
- `ERC8004_DEPLOYMENT_GUIDE.md` (full guide)
- `CONTRACT_DEPLOYMENT_QUICK_START.md` (this file)
- `ERC8004_CONTRACT_DEPLOYMENT_BLOCKER.md` (why it's needed)
