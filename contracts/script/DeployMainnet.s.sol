// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BillSplitter.sol";
import {BillSplitterRoulette} from "../src/BillSplitterRoulette.sol";

contract DeployMainnet is Script {
    // Arbitrum One
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant VRF_COORDINATOR = 0x3C0Ca683b403E37668AE3DC4FB62F4B29B6f7a3e;
    // 2 gwei gas lane (cheapest)
    bytes32 constant KEY_HASH = 0x9e9e46732b32662b9adc6f3abdf6c5e926a666d174a4d6b8e39c4cca76a38897;

    function run() external {
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");

        vm.startBroadcast();

        BillSplitter splitter = new BillSplitter(USDC);
        console.log("BillSplitter:", address(splitter));

        BillSplitterRoulette roulette = new BillSplitterRoulette(
            USDC, VRF_COORDINATOR, subscriptionId, KEY_HASH
        );
        console.log("BillSplitterRoulette:", address(roulette));

        vm.stopBroadcast();

        console.log("Add roulette contract as VRF consumer on vrf.chain.link (Arbitrum One)!");
    }
}
