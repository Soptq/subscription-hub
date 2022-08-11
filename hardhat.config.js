require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
// import {deployKey} from "./secret"


// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      chainId: 1337,
      gasPrice: 5,
      gasMultiplier: 1.2,
      initialBaseFeePerGas: 0
    },
    testnet: {
      url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
      chainId: 97,
      gasPrice: 20000000000,
      // accounts: [deployKey] // this is a test account, do NOT save funds in this account!
    },
  },
  solidity: {
    version: "0.8.9",
    optimizer: {
      enabled: true,
      runs: 200,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./src/artifacts"
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 5,
    token: 'BNB',
    gasPriceApi: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice'
  }
};
