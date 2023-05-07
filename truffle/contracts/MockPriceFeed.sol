// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.0;

/**
 * @title Mock Chainlink Aggregator V3 Interface
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice This contract is a mock implementation of the Chainlink Aggregator V3 Interface for testing purposes.
 * @dev This contract imports the MockV3Aggregator from the Chainlink library.
 */
//import "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";
import "../node_modules/@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";

contract MockPriceFeed is MockV3Aggregator {
    constructor(
        uint8 _decimals,
        int256 _initialAnswer
    ) MockV3Aggregator(_decimals, _initialAnswer) {}
}
