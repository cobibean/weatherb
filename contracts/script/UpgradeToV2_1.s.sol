// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeToV2_1Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("NEXT_PUBLIC_CONTRACT_ADDRESS");

        console.log("Upgrading WeatherMarketV2 to v2.1.0...");
        console.log("Proxy address:", proxyAddress);
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        WeatherMarketV2 newImpl = new WeatherMarketV2();
        console.log("New implementation deployed at:", address(newImpl));

        // Upgrade proxy to new implementation
        WeatherMarketV2 proxy = WeatherMarketV2(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        // Verify upgrade
        console.log("New version:", proxy.version());
        require(
            keccak256(bytes(proxy.version())) == keccak256(bytes("2.1.0")),
            "Version mismatch"
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== UPGRADE COMPLETE ===");
        console.log("Proxy (same address):", proxyAddress);
        console.log("New implementation:", address(newImpl));
        console.log("Version:", proxy.version());
    }
}
