// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFdcVerification {
    function verifyWeb2Json(bytes calldata proof) external view returns (bool);
}

