const { Block, Blockchain,JeChain } = require("./block-chainfile");


// Add a new block
JeChain.addBlock(new Block(Date.now().toString(), { from: "John", to: "Bob", amount: 100 }));
console.log(JeChain.chain); 