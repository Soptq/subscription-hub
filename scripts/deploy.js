// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const trustedForwarder = "0x61456BF1715C1415730076BB79ae118E806E74d2";
  const Contract = await hre.ethers.getContractFactory("SubscriptionHub");
  // 0x1343c4067081FFeCe94519aFDe9EA82fb260B381 deployed on bsc testnet
  const contract = await Contract.deploy(25, 100, 10, 10, trustedForwarder); // 25% fee, 5 minutes interval (BSC Testnet).

  await contract.deployed();

  console.log("Contract deployed to:", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
