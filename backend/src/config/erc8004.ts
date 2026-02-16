/**
 * ERC-8004 Configuration
 * Agent identity verification registry contract
 */

export interface ERC8004Config {
  contractAddress: string;
  rpcUrl: string;
  chainId: number;
  network: string;
}

/**
 * ERC-8004 Agent Registry ABI
 * Key functions for agent verification
 */
export const ERC8004_ABI = [
  {
    name: "isVerifiedAgent",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "getAgentMetadata",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "", type: "tuple", components: [
        { name: "id", type: "string" },
        { name: "name", type: "string" },
        { name: "metadata", type: "string" },
        { name: "verifiedAt", type: "uint256" },
      ] },
    ],
    stateMutability: "view",
  },
  {
    name: "registerAgent",
    type: "function",
    inputs: [
      { name: "metadata", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "revokeAgent",
    type: "function",
    inputs: [
      { name: "agent", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

/**
 * Load and validate ERC-8004 configuration
 */
function loadERC8004Config(): ERC8004Config {
  const contractAddress = process.env.ERC8004_CONTRACT_ADDRESS;
  const rpcUrl = process.env.ERC8004_RPC_URL;
  const network = process.env.ERC8004_NETWORK || "sepolia";
  
  const chainIdMap: Record<string, number> = {
    mainnet: 1,
    sepolia: 11155111,
    base: 8453,
    "base-sepolia": 84532,
  };

  const chainId = chainIdMap[network] || 11155111; // Default to Sepolia

  const errors: string[] = [];

  if (!contractAddress) {
    errors.push("ERC8004_CONTRACT_ADDRESS is not set");
  }

  if (!rpcUrl) {
    errors.push("ERC8004_RPC_URL is not set");
  }

  if (errors.length > 0) {
    throw new Error(
      `ERC-8004 Configuration Error:\n${errors.join("\n")}`
    );
  }

  return {
    contractAddress: contractAddress!,
    rpcUrl: rpcUrl!,
    chainId,
    network,
  };
}

export const ERC8004_CONFIG = loadERC8004Config();
