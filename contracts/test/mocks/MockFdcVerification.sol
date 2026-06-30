// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockFdcVerification {
    bool public ok;

    function setOk(bool v) external {
        ok = v;
    }

    function verifyWeb2Json(bytes calldata) external view returns (bool) {
        return ok;
    }
}

