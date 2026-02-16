# ERC-8004 Contract Deployment Guide

**Status:** ⏳ **NOT YET DEPLOYED** (You must do this)

This guide walks you through deploying the ERC-8004 Agent Registry contract to Base Sepolia testnet.

---

## Prerequisites

### 1. Node.js & npm
```bash
node --version  # Should be 18+
npm --version
```

### 2. Deployer Wallet with Testnet ETH
- **Option A:** MetaMask with Base Sepolia connected
- **Option B:** Privy account (since you're using Privy for auth)
- **Option C:** Create new account with `ethers.Wallet.createRandom()`

**You need:**
- Wallet address (e.g., `0x...`)
- Private key (exported from wallet, kept SECURE)
- Base Sepolia ETH for gas (~0.1-0.5 ETH)

### 3. Get Base Sepolia Testnet ETH

**Option 1: Base Official Faucet**
```
https://www.base.org/faucet
- Connect wallet
- Receive 0.1 ETH
```

**Option 2: Coinbase Faucet**
```
https://faucet.circle.com/
- Login with Coinbase
- Request funds
```

**Option 3: Using Alchemy/Infura Faucet**
```
https://www.infura.io/faucet/sepolia
- Works for Sepolia (then bridge to Base)
```

---

## Step-by-Step Deployment

### Step 1: Create Smart Contract

Create `contracts/AgentRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Agent Registry (ERC-8004)
 * 
 * Manages verified agent identities on-chain.
 * Prevents sybil attacks and ensures agent authenticity.
 */

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    /// Verified agent addresses
    mapping(address => bool) public verifiedAgents;
    
    /// Agent metadata storage
    mapping(address => AgentMetadata) public agentMetadata;
    
    /// Agent ID to address mapping (reverse lookup)
    mapping(string => address) public agentIdToAddress;
    
    struct AgentMetadata {
        string agentId;
        string name;
        string metadata;
        uint256 verifiedAt;
    }
    
    /// Events for indexing
    event AgentRegistered(address indexed agent, string agentId, uint256 timestamp);
    event AgentRevoked(address indexed agent, uint256 timestamp);
    event MetadataUpdated(address indexed agent, string metadata, uint256 timestamp);
    
    /// Only owner can register/revoke agents
    
    /**
     * Register a new verified agent
     * 
     * @param agent - Agent wallet address
     * @param agentId - Unique agent identifier
     * @param name - Human-readable agent name
     * @param metadata - JSON metadata (skills, bio, etc.)
     */
    function registerAgent(
        address agent,
        string calldata agentId,
        string calldata name,
        string calldata metadata
    ) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        require(bytes(agentId).length > 0, "Agent ID required");
        require(bytes(name).length > 0, "Agent name required");
        
        verifiedAgents[agent] = true;
        agentIdToAddress[agentId] = agent;
        
        agentMetadata[agent] = AgentMetadata(
            agentId,
            name,
            metadata,
            block.timestamp
        );
        
        emit AgentRegistered(agent, agentId, block.timestamp);
    }
    
    /**
     * Revoke an agent's verified status
     * 
     * @param agent - Agent address to revoke
     */
    function revokeAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        require(verifiedAgents[agent], "Agent not verified");
        
        verifiedAgents[agent] = false;
        emit AgentRevoked(agent, block.timestamp);
    }
    
    /**
     * Check if an agent is verified
     * 
     * @param agent - Agent address to check
     * @return true if agent is verified
     */
    function isVerifiedAgent(address agent) external view returns (bool) {
        return verifiedAgents[agent];
    }
    
    /**
     * Get agent metadata
     * 
     * @param agent - Agent address
     * @return metadata struct with agent info
     */
    function getAgentMetadata(address agent) 
        external 
        view 
        returns (AgentMetadata memory) 
    {
        return agentMetadata[agent];
    }
    
    /**
     * Update agent metadata (name, bio, etc.)
     * 
     * @param metadata - New metadata JSON
     */
    function updateMetadata(string calldata metadata) external {
        require(verifiedAgents[msg.sender], "Not a verified agent");
        
        agentMetadata[msg.sender].metadata = metadata;
        emit MetadataUpdated(msg.sender, metadata, block.timestamp);
    }
    
    /**
     * Get agent address from agent ID
     * 
     * @param agentId - Agent ID string
     * @return address of agent, or 0x0 if not found
     */
    function getAgentByID(string calldata agentId) 
        external 
        view 
        returns (address) 
    {
        return agentIdToAddress[agentId];
    }
}
```

### Step 2: Initialize Hardhat

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Initialize project
npx hardhat

# Select: "Create a TypeScript project"
# Install all dependencies: YES
```

### Step 3: Configure Hardhat

Update `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: {
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 84532,
    },
    
    // For local testing
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  
  etherscan: {
    apiKey: {
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
```

### Step 4: Create Deployment Script

Create `scripts/deploy.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("━".repeat(60));
  console.log("ERC-8004 Agent Registry - Deployment to Base Sepolia");
  console.log("━".repeat(60));
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\n📝 Deploying from: ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance === 0n) {
    throw new Error(
      "❌ Deployer account has no ETH! Fund it from a testnet faucet."
    );
  }
  
  // Deploy
  console.log("\n⏳ Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const contract = await AgentRegistry.deploy();
  
  const tx = contract.deploymentTransaction();
  console.log(`📦 Deployment transaction: ${tx?.hash}`);
  
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log(`✅ AgentRegistry deployed to: ${contractAddress}`);
  
  // Verify ownership
  const owner = await contract.owner();
  console.log(`🔐 Contract owner: ${owner}`);
  
  // Wait for confirmation
  console.log("\n⏳ Waiting for 5 block confirmations...");
  await contract.deploymentTransaction()?.wait(5);
  
  // Print verification command
  console.log("\n━".repeat(60));
  console.log("Next Steps:");
  console.log("━".repeat(60));
  
  console.log("\n1️⃣ Update .env with contract address:");
  console.log(`   ERC8004_CONTRACT_ADDRESS=${contractAddress}`);
  
  console.log("\n2️⃣ Update backend/src/config/erc8004.ts:");
  console.log(`   export const ERC8004_CONFIG = {`);
  console.log(`     contractAddress: "${contractAddress}",`);
  console.log(`     rpcUrl: "https://sepolia.base.org",`);
  console.log(`     chainId: 84532,`);
  console.log(`     network: "base-sepolia",`);
  console.log(`   };`);
  
  console.log("\n3️⃣ Verify contract on BaseScan:");
  console.log(
    `   npx hardhat verify --network base-sepolia ${contractAddress}`
  );
  
  console.log("\n4️⃣ Register test agent:");
  console.log("   npx hardhat run scripts/register-agent.ts --network base-sepolia");
  
  console.log("\n5️⃣ View on BaseScan:");
  console.log(
    `   https://sepolia.basescan.org/address/${contractAddress}`
  );
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
```

### Step 5: Set Up Environment Variables

Create/update `.env.local` (never commit!):

```bash
# Base Sepolia RPC (public, no auth needed)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Your deployer private key (KEEP SECURE!)
# Get from MetaMask: Settings → Security & Privacy → Show Private Key
# Or from Privy: Export wallet
DEPLOYER_PRIVATE_KEY=0x...

# For contract verification (optional)
# Get from https://www.basescan.org/apis
BASESCAN_API_KEY=your_api_key
```

**⚠️ NEVER commit `.env.local` to git!**

### Step 6: Install OpenZeppelin (for Ownable)

```bash
npm install @openzeppelin/contracts @openzeppelin/hardhat-upgrades
```

### Step 7: Deploy!

```bash
# Compile contract
npx hardhat compile

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network base-sepolia
```

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERC-8004 Agent Registry - Deployment to Base Sepolia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Deploying from: 0x1234...
💰 Account balance: 0.5 ETH

⏳ Deploying AgentRegistry...
📦 Deployment transaction: 0x5678...
✅ AgentRegistry deployed to: 0x8004...

Next Steps:
1️⃣ Update .env with: ERC8004_CONTRACT_ADDRESS=0x8004...
2️⃣ Update backend config
3️⃣ Verify contract: npx hardhat verify --network base-sepolia 0x8004...
```

### Step 8: Verify Contract (Optional)

```bash
npx hardhat verify --network base-sepolia 0xYOUR_CONTRACT_ADDRESS
```

This lets you see source code on BaseScan.

### Step 9: Update Backend Config

Update `backend/src/config/erc8004.ts`:

```typescript
export function loadERC8004Config(): ERC8004Config {
  const contractAddress = process.env.ERC8004_CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    throw new Error(
      "ERC8004_CONTRACT_ADDRESS not set. Deploy contract first: " +
      "npx hardhat run scripts/deploy.ts --network base-sepolia"
    );
  }
  
  return {
    contractAddress,
    rpcUrl: "https://sepolia.base.org",
    chainId: 84532,
    network: "base-sepolia",
  };
}
```

### Step 10: Register Test Agents (Optional)

Create `scripts/register-agent.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.ERC8004_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("ERC8004_CONTRACT_ADDRESS not set");
  }
  
  const contract = await ethers.getContractAt("AgentRegistry", contractAddress);
  const [deployer] = await ethers.getSigners();
  
  console.log("Registering test agents...");
  
  // Create test wallet
  const testAgent = ethers.Wallet.createRandom().connect(
    ethers.provider
  );
  
  console.log(`Test agent address: ${testAgent.address}`);
  
  // Register agent
  const tx = await contract.registerAgent(
    testAgent.address,
    "agent-alice",
    "Alice Agent",
    JSON.stringify({ bio: "Test agent", specialization: "debate" })
  );
  
  await tx.wait();
  console.log(`✅ Registered agent: ${testAgent.address}`);
}

main().catch(console.error);
```

---

## Verification Checklist

- [ ] Private key exported and stored in `.env.local`
- [ ] Account funded with Base Sepolia ETH
- [ ] Contract compiled: `npx hardhat compile`
- [ ] Deployment script ready: `scripts/deploy.ts`
- [ ] Hardhat configured for Base Sepolia
- [ ] Deployment successful and contract address obtained
- [ ] Contract verified on BaseScan (optional)
- [ ] Backend `.env` updated with contract address
- [ ] Backend `config/erc8004.ts` updated
- [ ] Tests pass: `npm run test`

---

## Cost Estimate

**Base Sepolia Deployment Cost:** ~0.02-0.05 ETH (~$1-2)

- Contract deployment: ~50,000 gas
- Gas price on Base: ~0.1 gwei (very cheap)
- Total: negligible

---

## Troubleshooting

### Error: "Insufficient funds"
```
Solution: Fund deployer address from faucet
https://www.base.org/faucet
```

### Error: "Invalid private key"
```
Solution: Ensure private key includes 0x prefix
DEPLOYER_PRIVATE_KEY=0x1234... (not just 1234...)
```

### Error: "Contract already exists"
```
Solution: Deploy to different address or use new private key
```

### Transaction timeout
```
Solution: Increase timeout in hardhat.config.ts
timeout: 40000,
```

---

## After Deployment

### Update Config Files

**1. `.env` (add):**
```bash
ERC8004_CONTRACT_ADDRESS=0x... # From deployment output
```

**2. `backend/src/config/erc8004.ts` (update):**
```typescript
export const ERC8004_CONFIG = {
  contractAddress: process.env.ERC8004_CONTRACT_ADDRESS!,
  rpcUrl: "https://sepolia.base.org",
  chainId: 84532,
  network: "base-sepolia",
};
```

### Run Tests

```bash
npm run test -- day5-erc8004-jam.test.ts
```

---

## Resources

- **Hardhat Docs:** https://hardhat.org/docs
- **Base Docs:** https://docs.base.org
- **BaseScan:** https://sepolia.basescan.org
- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts
- **Ethers.js:** https://docs.ethers.org

---

## Summary

1. ✅ Write smart contract
2. ✅ Set up Hardhat
3. ✅ Get testnet ETH
4. ✅ Deploy to Base Sepolia
5. ✅ Update backend config
6. ✅ Run tests

**Estimated time:** 15-30 minutes

**Status:** ⏳ **NOT YET DONE** - You must execute these steps.

---

**Note:** This is a critical blocker. The ERC-8004 contract must be deployed before:
- Day 5 agent verification tests can pass
- Room creation can verify agents
- Production deployment can proceed

Would you like help with any step?
