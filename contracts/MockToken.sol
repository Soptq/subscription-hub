// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockToken is ERC20, Ownable {
    constructor(address receiver) Ownable() ERC20("Mock Token", "MTN") {
        _mint(receiver, 10000 ** uint(super.decimals()));
    }
}