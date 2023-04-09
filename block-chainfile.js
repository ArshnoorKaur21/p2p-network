const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const EC=require('elliptic').ec,ec=new EC('secp256k1')

//minting adrress is static and should never be changed
const MINT_PRIVATE_ADDRESS='0700a1ad28a20e5b2a517c00242d3e25a88d84bf54dce9e1733e6096e6d6495e'
const MINT_KEY_PAIR=ec.keyFromPrivate(MINT_PRIVATE_ADDRESS,'hex')
const MINT_PUBLIC_ADDRESS=MINT_KEY_PAIR.getPublic('hex')

class Block {
    constructor(timestamp = '', data = []) {
        this.timestamp = timestamp;
        this.data = data;
        this.prevHash = "";
        this.hash = Block.getHash(this);
        this.nonce = 0;
    }

    static getHash(block) {
        return SHA256(block.prevHash + block.timestamp + JSON.stringify(block.data) + block.nonce);
    }

    mine(difficulty) {
        while (!this.hash.startsWith(Array(difficulty + 1).join("0"))) {
            this.nonce++;
            this.hash = Block.getHash(this);
        }
    }
    static hasValidTransactions(block,chain)
    {
        let gas=0,reward=0;
        block.data.forEach(transaction=>{
            if(transaction.from!==MINT_PUBLIC_ADDRESS)
            {
                gas+=transaction.gas
            }
            else{
                reward=transaction.amount
            }
        })
        return (
            reward-gas==chain.reward &&
            block.data.filter(transaction => transaction.from === MINT_PUBLIC_ADDRESS).length === 1 &&
            block.data.every(transaction=>transaction.isValid(transaction,chain)))
    }
}

class Blockchain {
    constructor() {
        const initialCoinRelease=new Transaction(MINT_PUBLIC_ADDRESS,'04946922d64f78106793ea43c1e6e8231a0dc6c292866ae18539f057d5b724edd413bdb99fabd517bd27d027ecd2e0cbaa61d3ec6133529f15ee0ae0dace533569',10000)
        this.chain = [new Block("",[initialCoinRelease])];
        this.difficulty = 1;
        this.blockTime = 30000;
        this.transactions=[]
        this.reward=297
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(block) {
        block.prevHash = this.getLastBlock().hash;
        block.hash = Block.getHash(block);
        block.mine(this.difficulty);
        this.chain.push(Object.freeze(block));

        this.difficulty += Date.now() - parseInt(this.getLastBlock().timestamp) < this.blockTime ? 1 : -1;
    }

    static isValid(blockchain) {
        for (let i = 1; i < blockchain.chain.length; i++) {
            const currentBlock = blockchain.chain[i];
            const prevBlock = blockchain.chain[i-1];

            if (currentBlock.hash !== Block.getHash(currentBlock) || prevBlock.hash !== currentBlock.prevHash || !Block.hasValidTransactions(currentBlock,blockchain)) {
                return false;
            }
        }



        return true;
    }

    addTransaction(transaction)
    {
        this.transactions.push(transaction)
    }
    mineTransactions(rewardAddress)
    {
        //Now, we should give the gas fee to the miner
        let gas=0
        this.transactions.forEach(transaction=>{
            gas+=transaction.gas
        })

        //create transactions that transfers reward to miner
        const rewardTransaction=new Transaction(MINT_PUBLIC_ADDRESS,rewardAddress,this.reward+gas)
        rewardTransaction.sign(MINT_KEY_PAIR)

        //pass in the pending transactions and then clear the current pending transactions pool.
        // we are just going assume the "from" address is something like this

         // Prevent people from minting coins and mine the minting transaction.
        if(transaction.length!==0) this.addBlock(new Block(Date.now().toString(),[rewardTransaction,...this.transactions]))

        this.transactions=[]

        
    }


    getBalance(address)
    {
        let balance=0
        this.chain.forEach(block=>{
            block.data.forEach(transaction =>{
                // Because if you are the sender, you are sending money away, so your balance will be decremented.
                if(transaction.from==address)
                {
                    balance-=transaction.amount;
                    balance-=transaction.gas;
                }

                //if reciever your balance will be incremented
                if(transaction.to==address)
                {
                    balance+=transaction.amount
                }
            })
        })
        return balance
    }

}

class Transaction{
    constructor(from,to,amount,gas=0)
    {
        this.from=from;
        this.to=to;
        this.amount=amount;
        this.gas=gas;
    }
    sign(keyPair)
    {
        // Check if the public key matches the "from" address of the transaction
        if(keyPair.getPublic('hex')===this.from)
        {
            this.signature=keyPair.sign(SHA256(this.from+this.to+this.amount+this.gas),'base64').toDER('hex')
        }
    }
    static isValid(tx,chain)
    {
        return(
            tx.from &&
            tx.to &&
            tx.amount &&
            (chain.getBalance(tx.from)>=tx.amount + tx.gas || tx.from==MINT_PUBLIC_ADDRESS) &&
            ec.keyFromPublic(tx.from,"hex").verify(SHA256(tx.from+tx.to+tx.amount+tx.gas),tx.signature)
        )
    }
}

const JeChain = new Blockchain();
// const recieverWallet = ec.genKeyPair();

// // Create a transaction
// const transaction = new Transaction(holderKeyPair.getPublic("hex"), recieverWallet.getPublic("hex"), 100, 10);
// // Sign the transaction
// transaction.sign(holderKeyPair);
// // Add transaction to pool
// JeChain.addTransaction(transaction);
// // Mine transaction
// JeChain.mineTransactions(holderKeyPair.getPublic("hex"));

// // Printing balance of both address
// console.log(JeChain.chain); 
// console.log("Your balance:", JeChain.getBalance(holderKeyPair.getPublic("hex")));
// console.log("reciever balance:", JeChain.getBalance(recieverWallet.getPublic("hex")));


module.exports = { Block, Blockchain, JeChain, Transaction };