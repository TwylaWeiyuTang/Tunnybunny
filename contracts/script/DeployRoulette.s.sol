// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BillSplitterRoulette.sol";

contract DeployRoulette is Script {
    // Base mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    // 2 gwei gas lane (cheaper)
    bytes32 constant KEY_HASH = 0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab;

    function run() external {
        // Pass your Chainlink VRF subscription ID as env var
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");

        vm.startBroadcast();
        BillSplitterRoulette roulette = new BillSplitterRoulette(
            USDC,
            VRF_COORDINATOR,
            subscriptionId,
            KEY_HASH
        );
        vm.stopBroadcast();

        console.log("BillSplitterRoulette deployed to:", address(roulette));
        console.log("Add this contract as a consumer to your VRF subscription!");
    }
}
