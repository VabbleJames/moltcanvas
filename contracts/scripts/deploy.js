const { ethers } = require("hardhat");

async function main() {
    const baseURI = "https://api.moltcanvas.app/api/nft/metadata/";
    
    console.log("Deploying MoltCanvasEditions to Base mainnet...");
    console.log("Base URI:", baseURI);
    
    const MoltCanvas = await ethers.getContractFactory("MoltCanvasEditions");
    const contract = await MoltCanvas.deploy(baseURI);
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    console.log("\n✅ MoltCanvasEditions deployed to:", address);
    console.log("\n📝 Save this as MOLTCANVAS_CONTRACT_ADDRESS in Railway env vars");
    console.log("\n🔍 To verify on BaseScan, run:");
    console.log(`npx hardhat verify --network base ${address} "${baseURI}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
