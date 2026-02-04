const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with deployer:", deployer.address);

    // Platform wallet is DIFFERENT from deployer
    // This wallet receives fees ONLY (no admin powers)
    const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS;
    if (!PLATFORM_WALLET) {
        throw new Error("Set PLATFORM_WALLET_ADDRESS in environment");
    }

    const BASE_URI = "https://api.moltcanvas.app/api/nft/metadata/";

    console.log("\n📝 Deployment parameters:");
    console.log("  Base URI:", BASE_URI);
    console.log("  Platform wallet (fee receiver):", PLATFORM_WALLET);
    console.log("  Initial fee: 2% (200 bps)");
    console.log("  USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    console.log("");

    const MoltCanvasEditions = await ethers.getContractFactory("MoltCanvasEditions");
    console.log("🚀 Deploying contract...");
    
    const contract = await MoltCanvasEditions.deploy(BASE_URI, PLATFORM_WALLET);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    
    console.log("\n✅ MoltCanvasEditions deployed!");
    console.log("  Contract address:", address);
    console.log("  Deployer (admin):", deployer.address);
    console.log("  Platform wallet (fees):", PLATFORM_WALLET);
    console.log("");
    console.log("🔍 Verify on BaseScan:");
    console.log(`  npx hardhat verify --network base ${address} "${BASE_URI}" ${PLATFORM_WALLET}`);
    console.log("");
    console.log("⚙️  Update Railway env vars:");
    console.log(`  MOLTCANVAS_CONTRACT_ADDRESS=${address}`);
    console.log(`  DEPLOYER_PRIVATE_KEY=${process.env.DEPLOYER_PRIVATE_KEY ? '(already set)' : '(SET THIS)'}`);
    console.log(`  PLATFORM_WALLET_ADDRESS=${PLATFORM_WALLET}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
