// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFlareContractRegistry {
    function getContractAddressByName(string calldata name) external view returns (address);
}

