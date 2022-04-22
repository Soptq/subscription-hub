const hre = require("hardhat");
const {ethers} = require("hardhat");
const {BigNumber} = require("ethers");

const blockInterval = 3000;
const feePercentage = 25;
const interval = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    await hre.network.provider.send("hardhat_reset")
    const signers = await ethers.getSigners();
    const subscriber = signers[0];
    const ERC20token = await ethers.getContractFactory("MockToken");
    const erc20token = await ERC20token.deploy(subscriber.address);

    await erc20token.deployed();

    const Contract = await hre.ethers.getContractFactory("SubscriptionHub");
    const contract = await Contract.deploy(feePercentage, interval, 10, 10);

    await contract.deployed();
    const contractAddress = contract.address;

    console.log("Test ERC20 Token deployed to:", erc20token.address);
    console.log("Contract deployed to:", contractAddress);

    await hre.ethers.provider.send("evm_setAutomine", [false])

    while (true) {
        const emptyBytes = ethers.utils.formatBytes32String("");
        const [upkeepNeeded, performBytes] = await contract.checkUpkeep(emptyBytes);
        if (upkeepNeeded) {
            await contract.performUpkeep(performBytes);
        }
        await hre.ethers.provider.send("evm_mine", [])

        const blockNumber = await hre.ethers.provider.getBlockNumber();
        const block = await hre.ethers.provider.getBlock("latest");
        console.log("Block number:", blockNumber, " Block hash:", block.hash);
        await sleep(blockInterval);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
