/**
 * Base Chain USDC Integration
 * Verifies on-chain USDC transfers on Base L2.
 */

const { ethers } = require('ethers');

const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const provider = new ethers.JsonRpcProvider(BASE_RPC);

// Native USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Platform wallet
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS;
const PLATFORM_FEE_PERCENT = 10;

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

/**
 * Verify a USDC transfer on Base.
 * Checks that tx_hash contains a real USDC transfer from→to with expected amount.
 */
async function verifyUSDCTransfer(txHash, expectedFrom, expectedTo, expectedAmountUSDC) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { verified: false, reason: 'Transaction not found' };
    }

    if (receipt.status !== 1) {
      return { verified: false, reason: 'Transaction failed on-chain' };
    }

    // Parse USDC Transfer events from receipt
    const iface = new ethers.Interface(ERC20_ABI);
    const transferEvents = receipt.logs
      .filter(log => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase())
      .map(log => {
        try { return iface.parseLog(log); } catch { return null; }
      })
      .filter(parsed => parsed && parsed.name === 'Transfer');

    if (transferEvents.length === 0) {
      return { verified: false, reason: 'No USDC transfer in transaction' };
    }

    // Find matching transfer
    const expectedAmount = ethers.parseUnits(expectedAmountUSDC.toString(), USDC_DECIMALS);
    
    const matchingTransfer = transferEvents.find(event => {
      const from = event.args[0].toLowerCase();
      const to = event.args[1].toLowerCase();
      const value = event.args[2];
      
      return (
        from === expectedFrom.toLowerCase() &&
        to === expectedTo.toLowerCase() &&
        value >= expectedAmount
      );
    });

    if (!matchingTransfer) {
      return { verified: false, reason: 'No matching USDC transfer found' };
    }

    const actualAmount = ethers.formatUnits(matchingTransfer.args[2], USDC_DECIMALS);

    return {
      verified: true,
      from: matchingTransfer.args[0],
      to: matchingTransfer.args[1],
      amount_usdc: parseFloat(actualAmount),
      block_number: receipt.blockNumber,
      tx_hash: txHash,
    };
  } catch (error) {
    console.error('USDC verification error:', error);
    return { verified: false, reason: `Verification failed: ${error.message}` };
  }
}

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
 * Check if a wallet address is valid
 */
function isValidAddress(address) {
  return ethers.isAddress(address);
}

/**
 * Calculate platform fee and creator payout
 */
function calculateFees(priceUSDC) {
  const platformFee = Math.round(priceUSDC * PLATFORM_FEE_PERCENT) / 100;
  const creatorPayout = priceUSDC - platformFee;
  return { platformFee, creatorPayout };
}

module.exports = {
  verifyUSDCTransfer,
  getUSDCBalance,
  isValidAddress,
  calculateFees,
  USDC_ADDRESS,
  PLATFORM_WALLET,
  PLATFORM_FEE_PERCENT,
  provider,
};
