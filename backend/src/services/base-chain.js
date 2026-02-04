/**
 * Base Chain Utilities
 * Helper functions for Base L2 blockchain operations.
 */

const { ethers } = require('ethers');

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(BASE_RPC);

// Native USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Platform wallet (fee receiver)
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS;

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

/**
 * Get USDC balance for a wallet on Base
 */
async function getUSDCBalance(walletAddress) {
  try {
    const balance = await usdcContract.balanceOf(walletAddress);
    return parseFloat(ethers.formatUnits(balance, USDC_DECIMALS));
  } catch (error) {
    console.error('Balance check error:', error);
    return 0;
  }
}

/**
 * Check if a wallet address is valid Ethereum address
 */
function isValidAddress(address) {
  return ethers.isAddress(address);
}

module.exports = {
  getUSDCBalance,
  isValidAddress,
  USDC_ADDRESS,
  PLATFORM_WALLET,
  provider,
};
