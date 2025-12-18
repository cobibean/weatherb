// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {WeatherMarket} from "../src/WeatherMarket.sol";

contract DeployScript is Script {
    function run() external returns (WeatherMarket deployed) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registry = vm.envAddress("FLARE_CONTRACT_REGISTRY_ADDRESS");
        require(registry != address(0), "Registry address required");
        vm.startBroadcast(deployerKey);
        deployed = new WeatherMarket(registry);
        vm.stopBroadcast();
        console2.log("WeatherMarket deployed at:", address(deployed));
    }
}
