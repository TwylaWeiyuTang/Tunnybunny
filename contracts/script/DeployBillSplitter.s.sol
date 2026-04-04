// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BillSplitter.sol";

contract DeployBillSplitter is Script {
    // USDC on Base mainnet
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        vm.startBroadcast();
        BillSplitter splitter = new BillSplitter(USDC_BASE);
        vm.stopBroadcast();

        console.log("BillSplitter deployed to:", address(splitter));
    }
}
