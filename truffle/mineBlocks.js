const Web3 = require("web3");

module.exports = async function (callback) {
  const web3 = new Web3("http://localhost:8545");

  const blocksToMine = 10; // Number of blocks to mine

  for (let i = 0; i < blocksToMine; i++) {
    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      callback
    );
  }
};
