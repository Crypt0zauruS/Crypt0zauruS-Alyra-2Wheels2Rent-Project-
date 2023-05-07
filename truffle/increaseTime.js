const Web3 = require("web3");

module.exports = async function (callback) {
  const web3 = new Web3("http://localhost:8545");

  const secondsToIncrease = 3600; // Number of seconds to increase
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [secondsToIncrease],
      id: new Date().getTime(),
    },
    callback
  );
};
