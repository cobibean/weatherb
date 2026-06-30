// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRegistry {
    address public verifier;

    function setVerifier(address v) external {
        verifier = v;
    }

    function getContractAddressByName(string calldata name) external view returns (address) {
        if (keccak256(bytes(name)) == keccak256(bytes("FdcVerification"))) {
            return verifier;
        }
        return address(0);
    }
}

