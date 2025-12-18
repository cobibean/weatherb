// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IFlareContractRegistry} from "../interfaces/IFlareContractRegistry.sol";
import {IFdcVerification} from "../interfaces/IFdcVerification.sol";

abstract contract FDCVerifier {
    IFlareContractRegistry public immutable registry;

    constructor(address registryAddress) {
        registry = IFlareContractRegistry(registryAddress);
    }

    function _verifyAttestation(bytes calldata proof) internal view returns (bool) {
        IFdcVerification verifier = IFdcVerification(
            registry.getContractAddressByName("FdcVerification")
        );
        return verifier.verifyWeb2Json(proof);
    }

    function _decodeWeatherAttestation(
        bytes calldata attestationData
    ) internal pure returns (bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths) {
        return abi.decode(attestationData, (bytes32, uint64, uint256));
    }
}

