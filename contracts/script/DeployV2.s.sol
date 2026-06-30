// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployV2Script is Script {
    function run() external returns (address proxy, address implementation) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying WeatherMarketV2...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        WeatherMarketV2 impl = new WeatherMarketV2();
        implementation = address(impl);
        console.log("Implementation deployed at:", implementation);

        // Encode initializer call
        bytes memory initData = abi.encodeWithSelector(
            WeatherMarketV2.initialize.selector,
            deployer, // owner
            deployer  // settler (same as owner for simplicity)
        );

        // Deploy proxy
        ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
        proxy = address(proxyContract);
        console.log("Proxy deployed at:", proxy);

        // Verify initialization
        WeatherMarketV2 market = WeatherMarketV2(proxy);
        console.log("Owner:", market.owner());
        console.log("Settler:", market.settler());
        console.log("Fee BPS:", market.feeBps());
        console.log("Min Bet:", market.minBetWei());
        console.log("Version:", market.version());

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Proxy (use this address):", proxy);
        console.log("Implementation:", implementation);
    }
}
