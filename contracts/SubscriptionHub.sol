// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "./KeeperRegistryInterface.sol";
import "hardhat/console.sol";

contract SubscriptionHub is KeeperCompatibleInterface, Ownable {
    using Address for address;
    using ECDSA for bytes32;

    // events
    event ServiceRegistered(address proposer, uint256 blockNumber, uint256 version, bytes32 serviceHash);
    event TokenClaimed(bytes32 serviceHash, uint256 amount);

    // registered services
    struct RegisteredServices {
        address proposer;                               // who registers this service;
        address receiver;                               // where the token goes;
        address tokenAddress;                           // what token for paying, must be standard ERC20 token;
        uint256 amount;                                 // how much tokens to pay for subscription;
        uint256 count;                                  // count of subscriptions of this service;
        uint256 unclaimed;                              // how much tokens are unclaimed;
        uint256 version;                                // version of the service;
    }

    struct PendingPayment {
        bytes32 serviceHash;                            // this indicates where the service is, 32 bytes size;
        address payer;                                  // this indicates who is gonna pay the subscription;
        uint256 version;                                // this indicates the version of the service;
    }

    struct UserSubscription {
        bytes32 serviceHash;                            // this indicates where the service is, 32 bytes size;
        uint256 version;
    }

    // deletable struct deletes data by increasing `version`;
    // obviously it is fake deletable, but it seems to be the only way to get rid of for loop;
    struct DeletableArrayAddress {
        mapping (uint256 => address[]) data;
    }

    struct DeletableMappingAddressUint256 {
        mapping (uint256 => mapping (address => uint256)) data;
    }

    struct DeletableMappingAddressBool {
        mapping (uint256 => mapping (address => bool)) data;
    }

    // store all registered services and related variables;
    mapping (bytes32 => RegisteredServices) private _registeredServices;                        // hash => service;
    mapping (bytes32 => bool) private _registeredServicesAlive;                                 // hash => alive;

    mapping (bytes32 => DeletableArrayAddress) private _subscriptions;                          // hash => payer;
    mapping (bytes32 => DeletableMappingAddressUint256) private _indexOfAddressInService;       // hash => (payer => index);
    mapping (bytes32 => DeletableMappingAddressBool) private _subscribed;                       // hash => (address => isSubscribed);
    mapping (bytes32 => DeletableMappingAddressBool) private _renewal;                          // hash => (address => needRenewal);

    mapping (bytes32 => DeletableMappingAddressUint256) private _nextPaymentBlock;              // hash => (payer => next payment block);
    mapping (address => UserSubscription[]) private _userSubscriptions;
    mapping (address => mapping (bytes32 => uint256)) private _userSubscriptionsIndex;
    mapping (address => mapping (bytes32 => bool)) private _userSubscriptionsAlive;

    mapping (bytes32 => uint256) private _deletableVersion;

    // store all pending payments;
    mapping (uint256 => PendingPayment[]) private _pendingPayments;                             // block number => pending payment;
    mapping (uint256 => bool) private _hasPendingPayments;                                      // block number => alive;
    uint256[] private _pendingPaymentBlockNumbers;                                              // block numbers of pending payments;
    uint256 private _processIndex;                                                              // last processed block number;

    // store all subscriptions managed by this hub;
    uint256 private _serviceCount = 0;
    uint256 private _subscriptionCount = 0;

    // contract parameters;
    uint256 private _feePercentage;
    uint256 private _paymentInterval;
    uint256 private _slidingWindowSize;
    uint256 private _targetPendingPaymentsPerBlock;

    // ========================================= PRIVATE FUNCTION ======================================

    constructor(uint256 feePercentage, uint256 paymentInterval,
        uint256 slidingWindowSize, uint256 targetPendingPaymentsPerBlock)
    Ownable() {
        if (feePercentage > 100) {
            revert("Fee must be less than 100");
        }
        _feePercentage = feePercentage;
        _paymentInterval = paymentInterval;
        _slidingWindowSize = slidingWindowSize;
        _targetPendingPaymentsPerBlock = targetPendingPaymentsPerBlock;
    }

    // get the hash of a service, as the identity of this service;
    function _getKeccakOfServices(RegisteredServices memory service) private pure returns (bytes32 hash) {
        hash = keccak256(abi.encodePacked(service.proposer, service.receiver, service.tokenAddress, service.amount));
    }

    // unregister a service from the hub;
    // `hash` is ensured to be existed in `_registeredServices` before calling this function;
    function _unregisterService(bytes32 hash) private {
        _subscriptionCount -= _registeredServices[hash].count;
        delete _registeredServices[hash];
        _registeredServicesAlive[hash] = false;

        _deletableVersion[hash]++;
    }

    // register a service to the hub;
    function _registerService(RegisteredServices memory service) private {
        bytes32 hash = _getKeccakOfServices(service);
        _registeredServices[hash] = service;
        _registeredServicesAlive[hash] = true;
    }

    // a user `payer` subscribe a service `serviceHash`, the subscription will take effect immediately;
    // `serviceHash` is ensured to exist in `_registeredServices` before calling this function;
    // `payer` is ensured to not have been subscribed the `serviceHash` before calling this function;
    // user's signature is checked before calling this function;
    function _subscribe(address payer, bool renewal, bytes32 serviceHash) private {
        uint256 version = _deletableVersion[serviceHash];
        // record index;
        _indexOfAddressInService[serviceHash].data[version][payer] = _subscriptions[serviceHash].data[version].length;
        // add record to `_subscriptions_;
        _subscriptions[serviceHash].data[version].push(payer);
        // set subscribed flag;
        _subscribed[serviceHash].data[version][payer] = true;
        // set renewal flag;
        _renewal[serviceHash].data[version][payer] = renewal;
        // add to user subscription;
        if (_userSubscriptionsAlive[payer][serviceHash]) {
            // remove the previous subscription first cause it must be invalid;
            _deleteUserSubscription(payer, serviceHash);
        }
        require(!_userSubscriptionsAlive[payer][serviceHash], "User has been subscribed before");
        _userSubscriptionsIndex[payer][serviceHash] = _userSubscriptions[payer].length;
        _userSubscriptions[payer].push(
            UserSubscription({
                serviceHash: serviceHash,
                version: version
            })
        );
        _userSubscriptionsAlive[payer][serviceHash] = true;

        _renew(payer, serviceHash);
    }

    function _deleteUserSubscription(address payer, bytes32 serviceHash) private {
        uint256 userSubscriptionIndex = _userSubscriptionsIndex[payer][serviceHash];
        if (_userSubscriptions[payer].length > 1) {
            UserSubscription memory lastUserSubscription = _userSubscriptions[payer][_userSubscriptions[payer].length - 1];
            _userSubscriptions[payer][userSubscriptionIndex] = lastUserSubscription;
            _userSubscriptionsIndex[payer][lastUserSubscription.serviceHash] = userSubscriptionIndex;
        }
        _userSubscriptions[payer].pop();
        _userSubscriptionsAlive[payer][serviceHash] = false;
    }

    // a user `payer` unsubscribe a service `serviceHash`, the subscription will be removed at the next payment;
    // `serviceHash` is ensured to exist in `_registeredServices` before calling this function;
    // `payer` is ensured to have been subscribed the `serviceHash` before calling this function;
    // user's signature is checked before calling this function;
    function _pretend_unsubscribe(address payer, bytes32 serviceHash) private {
        // here we only set `renewal` to false in `_pendingPayments`, and real unsubscription will be handled when
        // processing payer's pending payment.
        uint256 version = _deletableVersion[serviceHash];
        _renewal[serviceHash].data[version][payer] = false;
    }

    // a user `payer` unsubscribe a service `serviceHash`, this is the real unsubscribe process that will remove the subscription immediately;
    // `serviceHash` is ensured to exist in `_registeredServices` before calling this function;
    // `payer` is ensured to have been subscribed the `serviceHash` before calling this function;
    // user's signature is checked before calling this function;
    function _unsubscribe(address payer, bytes32 serviceHash) private {
        uint256 version = _deletableVersion[serviceHash];
        // remove record from `_subscriptions;
        uint256 index = _indexOfAddressInService[serviceHash].data[version][payer];
        if (_subscriptions[serviceHash].data[version].length > 1) {
            address lastAddress = _subscriptions[serviceHash].data[version][_subscriptions[serviceHash].data[version].length - 1];
            _subscriptions[serviceHash].data[version][index] = lastAddress;
            _indexOfAddressInService[serviceHash].data[version][lastAddress] = index;
        }
        _subscriptions[serviceHash].data[version].pop(); // Implicitly recovers gas from last element storage

        delete _indexOfAddressInService[serviceHash].data[version][payer];
        delete _nextPaymentBlock[serviceHash].data[version][payer];
        // set subscribed flag
        delete _subscribed[serviceHash].data[version][payer];

        // delete from user subscription
        _deleteUserSubscription(payer, serviceHash);

        _registeredServices[serviceHash].count--;
        _subscriptionCount--;
    }

    function _renew(address payer, bytes32 serviceHash) private {
        uint256 version = _deletableVersion[serviceHash];

        // here we find the block for payment by the following rules:
        // 1. block ranged from [targetDueBlock, targetDueBlock + slidingWindowSize];
        // 2. block that already has pending payments;
        // 3. block that has the smallest pending payments count;
        // 4. block that has minimal distance to targetDueBlock;
        uint256 targetDueBlockNumber = block.number + _paymentInterval;
        uint256 solutionBlockNumber = targetDueBlockNumber;
        uint256 solutionBlockNumberWithPendingPayments = solutionBlockNumber;
        uint256 smallestPendingPaymentsCount = _pendingPayments[targetDueBlockNumber].length;
        uint256 smallestPendingPaymentsCountWithPendingPayments = smallestPendingPaymentsCount;

        for (uint256 i = 0; i < _slidingWindowSize; i++) {
            uint256 tempBlockNumber = targetDueBlockNumber + i;
            uint256 tempPendingPaymentsCount = _pendingPayments[tempBlockNumber].length;
            if (tempPendingPaymentsCount < smallestPendingPaymentsCount) {
                smallestPendingPaymentsCount = tempPendingPaymentsCount;
                solutionBlockNumber = tempBlockNumber;
            }
            if (tempPendingPaymentsCount > 0 && tempPendingPaymentsCount < smallestPendingPaymentsCountWithPendingPayments) {
                smallestPendingPaymentsCountWithPendingPayments = tempPendingPaymentsCount;
                solutionBlockNumberWithPendingPayments = tempBlockNumber;
            }
        }

        uint256 dueBlockNumber;
        if (smallestPendingPaymentsCountWithPendingPayments > _targetPendingPaymentsPerBlock) {
            dueBlockNumber = solutionBlockNumber;
        } else {
            dueBlockNumber = solutionBlockNumberWithPendingPayments;
        }

        // add pending payment to the `_pendingPayments`;
        PendingPayment memory pendingPayment = PendingPayment({
            serviceHash: serviceHash,
            payer: payer,
            version: _deletableVersion[serviceHash]
        });
        _pendingPayments[dueBlockNumber].push(pendingPayment);
        _nextPaymentBlock[serviceHash].data[version][payer] = dueBlockNumber;
        if (!_hasPendingPayments[dueBlockNumber]) {
            _pendingPaymentBlockNumbers.push(dueBlockNumber);
            _hasPendingPayments[dueBlockNumber] = true;
        }
    }

    function _paySubscription(address payer, address tokenAddress,
        uint256 amount, bytes32 serviceHash)
    private returns (bool success) {
        IERC20 token = IERC20(tokenAddress);
        // check payer balance;
        if (token.balanceOf(payer) < amount) {
            return false;
        }
        // check token approval;
        if (token.allowance(payer, address(this)) < amount) {
            return false;
        }
        // payment;
        success = token.transferFrom(payer, address(this), amount);
        if (success) {
            uint256 amountWithoutFee = amount * (100 - _feePercentage) / 100;
            _registeredServices[serviceHash].unclaimed += amountWithoutFee;
        }
    }

    function _processPendingPayments() private {
        uint256 currentBlockNumber = _pendingPaymentBlockNumbers[_processIndex];
        // process pending payments;
        // in each block there should have limited number of pending transactions;
        for (uint256 i = 0; i < _pendingPayments[currentBlockNumber].length; i++) {
            PendingPayment memory pendingPayment = _pendingPayments[currentBlockNumber][i];
            // check if the subscription is still valid, if not then clear the user subscription and skip this payment;
            if (!_registeredServicesAlive[pendingPayment.serviceHash]
                || pendingPayment.version != _registeredServices[pendingPayment.serviceHash].version) {
                _deleteUserSubscription(pendingPayment.payer, pendingPayment.serviceHash);
                continue;
            }
            // check if the user still wants to renew the service, if not then skip this payment;
            if (!_renewal[pendingPayment.serviceHash].data[pendingPayment.version][pendingPayment.payer]) {
                _unsubscribe(pendingPayment.payer, pendingPayment.serviceHash);
                continue;
            }

            // renew the service;
            RegisteredServices memory service = _registeredServices[pendingPayment.serviceHash];
            bool paySuccessfully =_paySubscription(pendingPayment.payer, service.tokenAddress, service.amount, pendingPayment.serviceHash);
            if (!paySuccessfully) {
                // payment failed, will not renew the subscription;
                _pretend_unsubscribe(pendingPayment.payer, pendingPayment.serviceHash);
                _unsubscribe(pendingPayment.payer, pendingPayment.serviceHash);
                continue;
            }
            _renew(pendingPayment.payer, pendingPayment.serviceHash);
        }
        // remove pending payments;
        delete _pendingPayments[currentBlockNumber];
        delete _hasPendingPayments[currentBlockNumber];
        _processIndex++;
    }

    function _verify(bytes32 data, bytes memory signature, address account) private pure returns (bool) {
        return data
        .toEthSignedMessageHash()
        .recover(signature) == account;
    }

    function _claimToken(RegisteredServices memory service, bytes32 serviceHash) private returns (bool isSuccess) {
        // claim the token;
        IERC20 token = IERC20(service.tokenAddress);
        uint256 claimAmount = service.unclaimed;
        // approve the claim amount;
        bool transferSuccess = token.transfer(service.receiver, claimAmount);
        if (!transferSuccess) {
            revert("Failed to claim the token.");
        }

        _registeredServices[serviceHash].unclaimed = 0;
        isSuccess = true;

        emit TokenClaimed(serviceHash, claimAmount);
    }

    // ========================================= PUBLIC FUNCTION ======================================

    function getFeePercentage() public view returns (uint256) {
        return _feePercentage;
    }

    function getPaymentInterval() public view returns (uint256) {
        return _paymentInterval;
    }

    function checkService(bytes32 serviceHash, uint256 version) external view returns (bool isRegistered) {
        return _registeredServicesAlive[serviceHash] && _registeredServices[serviceHash].version == version;
    }

    function getServiceConfiguration(bytes32 serviceHash) external view returns (bytes memory configuration) {
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        RegisteredServices memory service = _registeredServices[serviceHash];
        configuration = abi.encode(service.proposer, service.receiver, service.tokenAddress, service.amount, service.version);
    }

    function getServiceUnclaimedTokenAmount(bytes32 serviceHash) external view returns (uint256 unclaimed) {
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        RegisteredServices memory service = _registeredServices[serviceHash];
        return service.unclaimed;
    }

    function claimToken(bytes32 serviceHash) external returns (bool isSuccess) {
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        require(msg.sender == _registeredServices[serviceHash].proposer, "Only the proposer can claim the token.");
        RegisteredServices memory service = _registeredServices[serviceHash];
        require(service.unclaimed > 0, "No unclaimed token.");

        isSuccess = _claimToken(service, serviceHash);
    }

    function checkSubscribed(address payer, bytes32 serviceHash, uint256 version) external view returns (bool isSubscribed) {
        if (!_registeredServicesAlive[serviceHash] || _deletableVersion[serviceHash] != version) {
            isSubscribed = false;
        } else {
            isSubscribed = _subscribed[serviceHash].data[version][payer];
        }
    }

    function checkRenewal(address payer, bytes32 serviceHash, uint256 version) external view returns (bool willRenew) {
        if (!_registeredServicesAlive[serviceHash] || _deletableVersion[serviceHash] != version) {
            willRenew = false;
        } else {
            willRenew = _renewal[serviceHash].data[version][payer];
        }
    }

    function getNextPaymentBlock(address payer, bytes32 serviceHash) external view returns (uint256 blockNumber) {
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        uint256 version = _deletableVersion[serviceHash];
        require(_subscribed[serviceHash].data[version][payer], "Sender have not subscribed this service.");
        return _nextPaymentBlock[serviceHash].data[version][payer];
    }

    function getSubscriptions(address payer) external view returns (UserSubscription[] memory subscriptions) {
        subscriptions = _userSubscriptions[payer];
    }

    function getTotalSubscriptionCount() external view returns (uint256 count) {
        count = _subscriptionCount;
    }

    function getServiceCount() external view returns (uint256 count) {
        count = _serviceCount;
    }

    function getServiceSubscriptionCount(bytes32 serviceHash) external view returns (uint256 count) {
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        count = _registeredServices[serviceHash].count;
    }

    function registerService(address receiver, address tokenAddress, uint256 amount) external returns (bytes32 serviceHash) {
        // ensure this service is not existed;
        RegisteredServices memory service = RegisteredServices({
            proposer: msg.sender,
            receiver: receiver,
            tokenAddress: tokenAddress,
            amount: amount,
            count: 0,
            unclaimed: 0,
            version: 0
        });
        serviceHash = _getKeccakOfServices(service);
        require(!_registeredServicesAlive[serviceHash], "This service is already registered.");
        // register this service;
        _registerService(service);
        // update service version;
        _registeredServices[serviceHash].version = _deletableVersion[serviceHash];
        _serviceCount++;
        emit ServiceRegistered(msg.sender, block.number, _deletableVersion[serviceHash], serviceHash);
    }

    function unregisterService(bytes32 serviceHash) external returns (bool isSuccessful){
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        require(msg.sender == _registeredServices[serviceHash].proposer, "Sender is not the original proposer of the service.");
        RegisteredServices memory service = _registeredServices[serviceHash];

        if (service.unclaimed > 0) {
            _claimToken(service, serviceHash);
        }
        _unregisterService(serviceHash);

        isSuccessful = !_registeredServicesAlive[serviceHash];
        if (isSuccessful) {
            _serviceCount--;
        }
    }

    function subscribeService(bytes32 serviceHash, bool renewal, bytes calldata signature) external {
        // ensure this service is registered;
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        // ensure this user is not subscribed this service;
        uint256 version = _deletableVersion[serviceHash];
        bool hasSubscribed = _subscribed[serviceHash].data[version][msg.sender];
        bool hasRenewal = _renewal[serviceHash].data[version][msg.sender];
        if (hasSubscribed && hasRenewal) {
            revert("Sender have already subscribed this service with renewal.");
        }

        // check signature: `msg.sender` grants `proposer` the right to pay `amount` of `tokenAddress` to `receiver`;
        bytes32 msgHash = keccak256(abi.encodePacked(msg.sender, serviceHash, version));
        require(_verify(msgHash, signature, msg.sender), "Signature is not invalid.");

        if (hasSubscribed && !hasRenewal) {
            if (renewal) {
                // recover renewal
                _renewal[serviceHash].data[version][msg.sender] = true;
            }
        } else {
            // fresh subscription
            RegisteredServices memory service = _registeredServices[serviceHash];
            // pay for the first time
            bool paySuccessfully = _paySubscription(msg.sender, service.tokenAddress, service.amount, serviceHash);
            if (!paySuccessfully) {
                revert("Payment Failed. Please check token balance or token allowance.");
            }
            // subscribe this service;
            _subscribe(msg.sender, renewal, serviceHash);
        }

        _registeredServices[serviceHash].count++;
        _subscriptionCount++;
    }

    function unsubscribeService(bytes32 serviceHash, bytes calldata signature) external {
        // ensure this service is registered;
        require(_registeredServicesAlive[serviceHash], "This service is not registered.");
        // ensure this user is subscribed this service;
        uint256 version = _deletableVersion[serviceHash];
        require(_subscribed[serviceHash].data[version][msg.sender], "Sender have not subscribed this service.");
        // check signature: `msg.sender` grants `proposer` the right to unsubscribe `receiver` from `serviceHash`;
        bytes32 msgHash = keccak256(abi.encodePacked(msg.sender, serviceHash, version));
        require(_verify(msgHash, signature, msg.sender), "Signature is invalid.");

        _pretend_unsubscribe(msg.sender, serviceHash);
    }

    // chainlink keeper checker
    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (_pendingPaymentBlockNumbers.length == 0) {
            upkeepNeeded = false;
            return (upkeepNeeded, performData);
        }

        if (_pendingPaymentBlockNumbers.length <= _processIndex) {
            upkeepNeeded = false;
            return (upkeepNeeded, performData);
        }

        upkeepNeeded = block.number >= _pendingPaymentBlockNumbers[_processIndex];
    }

    function getIdentifier() external pure returns (string memory identifier) {
        identifier = "SubscriptionHub";
    }

    // chainlink keeper executor
    function performUpkeep(bytes calldata /* performData */) external override {
        require(_pendingPaymentBlockNumbers.length != 0, "No pending payments.");
        require(_pendingPaymentBlockNumbers.length > _processIndex, "No more pending payments.");
        require(block.number >= _pendingPaymentBlockNumbers[_processIndex], "Pending payments are not matured.");

        _processPendingPayments();
    }

    function getPendingPaymentCount(uint256 blockNum) external onlyOwner view returns (uint256 pendingPaymentCount) {
        pendingPaymentCount = _pendingPayments[blockNum].length;
    }
}