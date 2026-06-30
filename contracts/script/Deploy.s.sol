// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {WeatherMarket} from "../src/WeatherMarket.sol";

contract DeployScript is Script {
    function run() external returns (WeatherMarket deployed) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        deployed = new WeatherMarket();
        vm.stopBroadcast();
        console2.log("WeatherMarket deployed at:", address(deployed));
    }
}
