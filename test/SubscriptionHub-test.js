const { expect } = require("chai");
const { ethers } = require("hardhat");
const {BigNumber} = require("ethers");

async function iterateBlockWithKeeper(contract) {
  const emptyBytes = ethers.utils.formatBytes32String("");
  const [upkeepNeeded, performBytes] = await contract.checkUpkeep(emptyBytes);
  if (upkeepNeeded) {
    await contract.performUpkeep(performBytes);
  }
  await ethers.provider.send("evm_mine", []);
}

async function getSignature(signer, serviceHash, version) {
  let messageHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "uint256"],
      [signer.address, serviceHash, version],
  );

  let messageHashBinary = ethers.utils.arrayify(messageHash);
  return await signer.signMessage(messageHashBinary);
}

describe("SubscriptionHub", function () {
  // signer ID
  const deployerId = 0;
  const serviceRegisterId = 1;
  const subscriberId = 2;
  const tokenReceiverId = 3;
  const forwarderId = 4;

  // default service configuration;
  let tokenAddress = "0x0000000000000000000000000000000000000000";
  const amount = ethers.utils.parseEther("0.01");

  const feePercentage = 25;
  const interval = 100;

  // storage
  let contract;
  let erc20token;
  const serviceConfigurations = {};
  const serviceHashes = [];

  it("Mock test environment", async function () {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];

    const ERC20token = await ethers.getContractFactory("MockToken");
    erc20token = await ERC20token.deploy(subscriber.address);
    await erc20token.deployed();

    tokenAddress = erc20token.address;
  })

  it("Should successfully deploy SubscriptionHub", async function() {
    const signers = await ethers.getSigners();
    const deployer = signers[deployerId];
    const trustedForwarder = signers[forwarderId];

    const SubscriptionHub = await ethers.getContractFactory("SubscriptionHub");
    const subscriptionHub = await SubscriptionHub.connect(deployer)
        .deploy(feePercentage, interval, 10, 10, trustedForwarder.address);
    await subscriptionHub.deployed();

    contract = subscriptionHub

    const contractFeePercentage = await contract.getFeePercentage();
    const contractPaymentInterval = await contract.getPaymentInterval();
    expect(contractFeePercentage.toNumber()).to.equal(feePercentage);
    expect(contractPaymentInterval.toNumber()).to.equal(interval);
  })

  it("Should successfully register the service", async function () {
    const signers = await ethers.getSigners();
    const serviceRegister = signers[serviceRegisterId];
    const receiver = signers[tokenReceiverId];

    const serviceHashTx = await contract.connect(serviceRegister).registerService(
      receiver.address,
      tokenAddress,
      amount,
    );

    const serviceHashReceipt = await serviceHashTx.wait();
    for (const event of serviceHashReceipt.events) {
      if (event.event === "ServiceRegistered") {
        const proposer = event.args.proposer;
        const serviceHash = event.args.serviceHash;
        const version = event.args.version;
        const serviceIsRegistered = await contract.checkService(serviceHash, version);
        expect(proposer).to.equal(serviceRegister.address);
        expect(serviceIsRegistered).to.equal(true);

        serviceConfigurations[serviceHash] = {
          receiver: receiver.address,
          tokenAddress,
          amount,
          version
        };
        serviceHashes.push(serviceHash);

        return;
      }
    }

    expect.fail("Service should be registered");
  });

  it("Should successfully read the configuration of the registered service", async function () {
    const signers = await ethers.getSigners();
    const serviceRegister = signers[serviceRegisterId];

    for (const [serviceHash, config] of Object.entries(serviceConfigurations)) {
      const retrievedConfig = await contract.getServiceConfiguration(serviceHash);
      const [proposer, receiver, tokenAddress, amount, version] = ethers.utils.defaultAbiCoder.decode(
          ["address", "address", "address", "uint256", "uint256"],
        retrievedConfig,
      );
      expect(proposer).to.equal(serviceRegister.address);
      expect(receiver).to.equal(config.receiver);
      expect(tokenAddress).to.equal(config.tokenAddress);
      expect(amount).to.equal(config.amount);
      expect(version).to.equal(config.version);
    }
  });

  it("Should successfully subscribe the service", async function () {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    let signature = await getSignature(subscriber, serviceHash, version);

    // approve token
    const approvalTx = await erc20token.connect(subscriber).approve(contract.address, amount.mul(BigNumber.from(10)));
    await approvalTx.wait();

    // subscribe to the service
    const totalSubscriptionCountBefore = await contract.getTotalSubscriptionCount();
    const serviceSubscriptionCountBefore = await contract.getServiceSubscriptionCount(serviceHash);

    const subscriberHashTx = await contract.connect(subscriber).subscribeService(
      serviceHash, true, signature,
    );
    await subscriberHashTx.wait();

    const totalSubscriptionCountAfter = await contract.getTotalSubscriptionCount();
    const serviceSubscriptionCountAfter = await contract.getServiceSubscriptionCount(serviceHash);

    expect(totalSubscriptionCountAfter.sub(totalSubscriptionCountBefore).toNumber()).to.equal(1);
    expect(serviceSubscriptionCountAfter.sub(serviceSubscriptionCountBefore).toNumber()).to.equal(1);

    // check subscription
    const isSubscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(isSubscribed).to.equal(true);
  });

  it("Should get subscriber's next payment block", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    const currentBlock = await ethers.provider.getBlockNumber();
    const nextPaymentBlock = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
    expect(nextPaymentBlock.sub(currentBlock).toNumber()).to.equal(interval);
  })

  it("Should get subscriber's subscriptions", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    const subscriptions = await contract.getSubscriptions(subscriber.address);
    expect(subscriptions[0].serviceHash).to.equal(serviceHash);
  })

  it("Should automatically renew the subscription", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    // we test 5 times of auto renewal;
    for (let i = 0; i < 5; i++) {
      let nextPaymentBlock = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
      let currentBlockNum = await ethers.provider.getBlockNumber();
      while (currentBlockNum < nextPaymentBlock) {
        const pendingPaymentCount = await contract.getPendingPaymentCount(currentBlockNum);
        expect(pendingPaymentCount.toNumber()).to.equal(0);
        await iterateBlockWithKeeper(contract);
        currentBlockNum = await ethers.provider.getBlockNumber();
      }

      // this block we should process the payment
      await iterateBlockWithKeeper(contract);
    }

    const currentBlock = await ethers.provider.getBlockNumber();
    const nextPaymentBlockAfterRenewal = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
    expect(nextPaymentBlockAfterRenewal.sub(currentBlock).toNumber()).to
        .equal(interval - 1);  // payment takes 1 block
  })

  it("Should receive tokens after renewal", async function() {
    const contractBalance = await erc20token.balanceOf(contract.address);
    expect(contractBalance.toString()).to.equal(amount.mul(6).toString());
  })

  it("Service should have unclaimed amounts of token", async function() {
    const serviceHash = serviceHashes[0];

    const unclaimedTokenAmount = await contract.getServiceUnclaimedTokenAmount(serviceHash);
    expect(unclaimedTokenAmount.toString()).to
        .equal(amount.mul(6).mul(75).div(100).toString());
  })

  it("Should be unable to claim by others", async function() {
    const serviceHash = serviceHashes[0];

    try {
      const claimTx = await contract.claimToken(serviceHash);
      await claimTx.wait();
      expect.fail("Should not be able to claim by others");
    } catch (e) {}
  })

  it("Should be unable to claim by proposer", async function() {
    const signers = await ethers.getSigners();
    const serviceRegister = signers[serviceRegisterId];
    const receiver = signers[tokenReceiverId];
    const serviceHash = serviceHashes[0];

    const unclaimedTokenAmount = await contract.getServiceUnclaimedTokenAmount(serviceHash);

    const claimTx = await contract.connect(serviceRegister).claimToken(serviceHash);
    await claimTx.wait();

    const balance = await erc20token.balanceOf(receiver.address);
    expect(balance.toString()).to.equal(unclaimedTokenAmount.toString());
  })

  it("Should be able to unsubscribe", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    let signature = await getSignature(subscriber, serviceHash, version);

    const unsubscribeTx = await contract.connect(subscriber).unsubscribeService(serviceHash, signature);
    await unsubscribeTx.wait();

    const isSubscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    const willRenew = await contract.checkRenewal(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(isSubscribed).to.equal(true);
    expect(willRenew).to.equal(false);
  })

  it("Should be able to restore subscription if not expired", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    let signature = await getSignature(subscriber, serviceHash, version);

    const nextPaymentBlockBefore = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
    const subscribeTx = await contract.connect(subscriber).subscribeService(serviceHash, true, signature);
    await subscribeTx.wait();
    const nextPaymentBlockAfter = await contract.getNextPaymentBlock(subscriber.address, serviceHash);

    const isSubscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    const willRenew = await contract.checkRenewal(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(isSubscribed).to.equal(true);
    expect(willRenew).to.equal(true);
    expect(nextPaymentBlockBefore.toString()).to.equal(nextPaymentBlockAfter.toString());
  })

  it("Should not renew the subscription if unsubscribed", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    let signature = await getSignature(subscriber, serviceHash, version);

    const unsubscribeTx = await contract.connect(subscriber).unsubscribeService(serviceHash, signature);
    await unsubscribeTx.wait();

    let nextPaymentBlock = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
    let currentBlockNum = await ethers.provider.getBlockNumber();
    while (currentBlockNum < nextPaymentBlock) {
      const pendingPaymentCount = await contract.getPendingPaymentCount(currentBlockNum);
      expect(pendingPaymentCount.toNumber()).to.equal(0);
      await iterateBlockWithKeeper(contract);
      currentBlockNum = await ethers.provider.getBlockNumber();
    }

    // this block we should process the payment
    await iterateBlockWithKeeper(contract);

    const isSubscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(isSubscribed).to.equal(false);

    const subscriptions = await contract.getSubscriptions(subscriber.address);
    expect(subscriptions.length).to.equal(0);

    // should to charge the subscriber
    const unclaimedTokenAmount = await contract.getServiceUnclaimedTokenAmount(serviceHash);
    expect(unclaimedTokenAmount.toString()).to.equal("0");
  })

  it("Should not be able to unregister services by others that is not the proposer", async function() {
    const serviceHash = serviceHashes[0];
    try {
      const unregisterTx = await contract.unregisterService(serviceHash);
      await unregisterTx.wait();
      expect.fail("Should not be able to unregister services by others that is not the proposer");
    } catch (e) {}
  })

  it("Should be able to unregister services by the proposer", async function() {
    const signers = await ethers.getSigners();
    const serviceRegister = signers[serviceRegisterId];
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    // subscribe the service
    let signature = await getSignature(subscriber, serviceHash, version);

    const subscribeTx = await contract.connect(subscriber).subscribeService(serviceHash, true, signature);
    await subscribeTx.wait();

    // unregister service
    const unregisterTx = await contract.connect(serviceRegister).unregisterService(serviceHash, {gasLimit: 1000000});
    await unregisterTx.wait();
    const isRegistered = await contract.checkService(serviceHash, serviceConfigurations[serviceHash].version);
    expect(isRegistered).to.equal(false);
  })

  it("Should claim tokens while unregistering services", async function() {
    const signers = await ethers.getSigners();
    const receiver = signers[tokenReceiverId];

    const shouldHave = amount.mul(100 - feePercentage).div(100).mul(7);
    const balance = await erc20token.balanceOf(receiver.address);
    expect(balance.toString()).to.equal(shouldHave.toString());
  })

  it("Subscribers should automatically unsubscribe unregistered services", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    const subscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    const renewal = await contract.checkRenewal(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(subscribed).to.equal(false);
    expect(renewal).to.equal(false);

    const subscriptions = await contract.getSubscriptions(subscriber.address);
    const subscriptionValid = await contract.checkService(subscriptions[0].serviceHash, subscriptions[0].version)
    expect(subscriptionValid).to.equal(false);
  })

  it("Proposer can register the same service again", async function() {
    const signers = await ethers.getSigners();
    const serviceRegister = signers[serviceRegisterId];
    const receiver = signers[tokenReceiverId];

    const serviceHashTx = await contract.connect(serviceRegister).registerService(
        receiver.address,
        tokenAddress,
        amount,
    );

    const serviceHashReceipt = await serviceHashTx.wait();
    for (const event of serviceHashReceipt.events) {
      if (event.event === "ServiceRegistered") {
        const proposer = event.args.proposer;
        const serviceHash = event.args.serviceHash;
        const version = event.args.version;
        const serviceIsRegistered = await contract.checkService(serviceHash, version);
        expect(proposer).to.equal(serviceRegister.address);
        expect(serviceIsRegistered).to.equal(true);
        expect(version.toNumber()).to.equal(Number(serviceConfigurations[serviceHash].version) + 1);
        serviceConfigurations[serviceHash].version = version

        return;
      }
    }
  })

  it("Re-registering should not cause ambiguity", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    const subscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    const renewal = await contract.checkRenewal(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(subscribed).to.equal(false);
    expect(renewal).to.equal(false);
  })

  it("Subscriber should not be charged for unregistered services", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];

    const erc20BalanceBefore = await erc20token.balanceOf(subscriber.address);
    for (let i = 0; i < interval; i++) {
      await iterateBlockWithKeeper(contract);
    }
    const erc20BalanceAfter = await erc20token.balanceOf(subscriber.address);
    expect(erc20BalanceAfter.sub(erc20BalanceBefore).toString()).to.equal("0");
  })

  it("Subscriber should be able to subscribe the new service", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];
    const version = serviceConfigurations[serviceHash].version;

    let signature = await getSignature(subscriber, serviceHash, version);

    const subscriberHashTx = await contract.connect(subscriber).subscribeService(
        serviceHash, true, signature,
    );
    await subscriberHashTx.wait();

    const subscriptions = await contract.getSubscriptions(subscriber.address);
    expect(subscriptions.length).to.equal(1);
    expect(subscriptions[0].version).to.equal(serviceConfigurations[serviceHash].version);
  })

  it("Should automatically unsubscribe if the balance is insufficient", async function() {
    const signers = await ethers.getSigners();
    const subscriber = signers[subscriberId];
    const serviceHash = serviceHashes[0];

    // we test 3 times of auto renewal to make sure the balance is insufficient
    for (let i = 0; i < 3; i++) {
      let nextPaymentBlock = await contract.getNextPaymentBlock(subscriber.address, serviceHash);
      let currentBlockNum = await ethers.provider.getBlockNumber();
      while (currentBlockNum < nextPaymentBlock) {
        const pendingPaymentCount = await contract.getPendingPaymentCount(currentBlockNum);
        expect(pendingPaymentCount.toNumber()).to.equal(0);
        await iterateBlockWithKeeper(contract);
        currentBlockNum = await ethers.provider.getBlockNumber();
      }

      // this block we should process the payment
      await iterateBlockWithKeeper(contract);
    }

    const subscribed = await contract.checkSubscribed(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    const renewal = await contract.checkRenewal(subscriber.address, serviceHash,
        serviceConfigurations[serviceHash].version);
    expect(subscribed).to.equal(false);
    expect(renewal).to.equal(false);

    const subscriptions = await contract.getSubscriptions(subscriber.address);
    expect(subscriptions.length).to.equal(0);
  })
});
