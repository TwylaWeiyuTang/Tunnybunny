// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BillSplitter.sol";
import "../src/BillSplitterRoulette.sol";

contract DeployRouletteTestnet is Script {
    // Base Sepolia addresses
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    bytes32 constant KEY_HASH = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;

    function run() external {
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");

        vm.startBroadcast();

        // Deploy both contracts
        BillSplitter splitter = new BillSplitter(USDC);
        console.log("BillSplitter:", address(splitter));

        BillSplitterRoulette roulette = new BillSplitterRoulette(
            USDC, VRF_COORDINATOR, subscriptionId, KEY_HASH
        );
        console.log("BillSplitterRoulette:", address(roulette));
        console.log("Add roulette contract as VRF consumer!");

        vm.stopBroadcast();
    }
}
