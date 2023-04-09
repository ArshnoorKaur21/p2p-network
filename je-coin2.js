// const crypto = require("crypto"), SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec, ec = new EC("secp256k1");
const { Block, Blockchain, Transaction, JeChain } = require("./block-chainfile");

//static mint address
const MINT_PRIVATE_ADDRESS = "0700a1ad28a20e5b2a517c00242d3e25a88d84bf54dce9e1733e6096e6d6495e";
const MINT_KEY_PAIR = ec.keyFromPrivate(MINT_PRIVATE_ADDRESS, "hex");
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic("hex");

//creating our own key pair
const privateKey = '39a4a81e8e631a0c51716134328ed944501589b447f1543d9279bacc7f3e3de7';
const keyPair = ec.keyFromPrivate(privateKey, "hex");
const publicKey = keyPair.getPublic("hex");

const WS=require('ws');
const { async } = require("utilities");
const { SHA256 } = require("crypto-js");
const PORT=3001
const PEERS=['ws://localhost:3000']
const MY_ADDRESS='ws://localhost:3001'
let opened=[],connected=[]
//create tempchain whicj is new chain
/*
idea is that all the blocks sent will be addedd to tempchain and if tempchain is valid then we will transfer all data from temp chain to mainchain
*/
let tempchain=new Blockchain()

/*
here by chance you have mined your block first than other miner but you cant show to other nodes on that time due to some internet issue so to solve this prblm take 2 var cheeck and checked, imagine someone sent the block to the nodes uinfact  even u when u 
mined the block so
the idea is that if block.prevhash===latestblock.prevhash there is probably need for chqing for replacement , we are setting chqing to true indocating that we are chqing then we request other nodes for latest block
we will set chqing to false after 5sec cancelling the process and the block that appears the most i thw block we need 
i ll also inform other nodes to have that block inblockchain, we are not just sending the new block we are sending the new transactin pool and new difficulty
*/
let check=[],checked=[]
let checking=false

const server=new WS.Server({port:PORT})

console.log('listening on port ',PORT)

//connection listener
server.on('connection',async(socket,req)=>{
    //able to listen the message
    socket.on('message',message=>{
        //message in json process it to object
        const _message=JSON.parse(message)

        switch(_message.type)
        {
            case 'TYPE_HANDSHAKE':
                const nodes=_message.data;
                nodes.forEach(node => {
                    connect(node)
                });
            case 'TYPE_CREATE_TRANSACTION':
                //data is transction objetc added to transaction pool
                const transaction=_message.data
                   /*we can now send transaction like this and addintg pool
                sendMessage(produceMessage('TYPE_CREATE_TRANSACTION',sometransaction))
                */
                JeChain.addTransaction(transaction)
                break;
            case 'TYPE_REPLACE_CHAIN':
                //mining and sending new blocks

                const [newBlock,newDiff]=_message.data
                //creating clone of our txpool and all the transactions to be converted to json 
                const ourTx=[...JeChain.transactions.map(tx=>JSON.stringify(tx))]
                //transaction in block without minting the transaction
                const theirTx=[...newBlock.data.filter(tx=>tx.from!==MINT_PUBLIC_ADDRESS).map(tx=>JSON.stringify(tx))]
                const n=theirTx.length

                //to chq if prevhash of new block matches with prevhash bcz that means they are sending duplicate of block
                if(newBlock.prevHash!==JeChain.getLastBlock().prevHash)
                {
                    //chq whether transactions from block exist in trx pool or not
                    for(let i=0;i<n;i++)
                    {
                        //having a transaction from theirtx 
                        const index=ourTx.indexOf(theirTx[0])
                        //no tx in txpool so break it
                        if(index===-1) break;
                        ourTx.splice(index,1)
                        theirTx.splice(0,1)
                    }
                    //chq whether block is valid or not 
                    //1st thing we will chq if txns exist in pool or not
                    if(
                    theirTx.length===0 &&
                    //chqing hash is valid or not
                    SHA256(JeChain.getLastBlock().hash +newBlock.timestamp+JSON.stringify(newBlock.data)+newBlock.nonce)===newBlock.hash &&
                    //chqing if hash matches with difficulty
                    newBlock.hash.startsWith(Array(JeChain.difficulty+1).join('0')) &&
                    //if it has valoid txns or not
                    Block.hasValidTransactions(newBlock,JeChain) &&
                    //bcz genesis block has empty timestamp 
                    (parseInt(newBlock.timestamp) > JeChain.getLastBlock().timestamp || JeChain.getLastBlock().timestamp==='') &&
                    parseInt(newBlock.timestamp)<Date.now() &&
                    JeChain.getLastBlock().hash ===newBlock.prevHash &&
                    newDiff+1 ===JeChain.difficulty || newDiff-1 ===JeChain.difficulty
                    ){
                        //if all cond valid then push the block into chain
                        JeChain.chain.push(newBlock)
                        //updating difficulty as well
                        JeChain.difficulty=newDiff
                        //parsing the txns back to object
                        JeChain.transactions=[...ourTx.map(tx=>JSON.parse(tx))]
                    }   
                }else if(!checked.includes(JSON.stringify([JeChain.getLastBlock().prevHash],JeChain.chain[JeChain.chain.length-2].timestamp))){
                    //pushing timestamp and prev hash of blockchain and if somehow this tstamp appeared again then 
                    //prevhash and timestamp of prev block
                    checked.push(JSON.stringify([JeChain.getLastBlock().prevHash],JeChain.chain[JeChain.chain.length-2].timestamp))

                    const position=JeChain.chain.length-1
                    checking=true
                    //we send message to other requesting chqing the block , we are just sendint our address so that they can request back
                    sendMessage(produceMessage('TYPE_REQUEST_CHECK',MY_ADDRESS))
                    setTimeout(()=>{
                        //after 5 sec set chqing to false and find most appeared block
                        checking=false
                        //let default block that is mostappeared let chain[0]
                        let mostAppeared=check[0]
                        // mostappeared is first block in check
                        check.forEach(group=>{
                            //here we are not just sending the block we are sending the group of block diificulty pending transactions
                            //here chqing the qty ofgrp which is smaller than current block we are chqing
                            if(check.filter(_group=>_group===group).length>check.filter(_group=>_group===mostAppeared).length)
                            {
                                mostAppeared=group
                            }
                        })
                        const group=JSON.parse(mostAppeared)

                        JeChain.chain[position]=group[0]
                        //spread operator for copying
                        JeChain.transactions=[...group[1]]
                        JeChain.difficulty=group[2]

                        //removing all blocks from check variable
                        check.splice(0,check.length)

                    },5000)
                }
                break;

            case 'TYPE_REQUEST_CHECK':
                //bcz we have sent our address they are just going to find address in open and they will find the socket ans send message to us
                opened.filter(node=>node.address===message.data)[0].socket.send(JSON.stringify(produceMessage(
                    'TYPE_SEND_CHECK',
                    JSON.stringify([JeChain.getLastBlock(),JeChain.transactions,JeChain.difficulty])
                )))
                break;
            
            case 'TYPE_SEND_CHECK':
                //we are checking here chekcing is enabled
                if(checking)  check.push(_message.data)
                break;

            case 'TYPE_REQUEST_CHAIN':
                const socket=opened.filter(node=>node.address===_message.data)[0].socket

                //now we should be able to send back message with type sned chain
                for(let i=0;i<JeChain.chain.length;i++)
                {
                    socket.send(JSON.stringify(produceMessage(
                        'TYPE_SEND_CHAIN',
                        {
                            //here we are sending blocks 1  by one , here we are developing system that sends blocks continously
                            block:JeChain.chain[i],
                            //means we will send info to other we have finished sending blocks
                            finished: i==JeChain.chain.length
                        }
                        
                    )))
                }
                break;
            case 'TYPE_SEND_CHAIN':
                const {block,finished}=_message.data
                if(!finished){
                    //if not  finished we will contniue to push block in tempchain
                    tempchain.chain.push(block)
                }else{
                    if(Blockchain.isValid(tempchain))
                    {
                        //if tempchain is valid we will assign temochain to blockchain and empty the tempchain
                        JeChain.chain=tempchain.chain
                    }
                    tempchain=new Blockchain()
                }
                break;
            //here req info is that we will request other nodes for difficulty and txpool
            case 'TYPE_REQUEST_INFO':
                opened.filter(node=>node.address===message.data)[0].socket.send(
                    'TYPE_SEND_INFO',
                    [JeChain.difficulty,JeChain.transactions]
                );
                break;
            case 'TYPE_SEND_INFO':
                [JeChain.difficulty,JeChain.transactions]=_message.data

                //u can send req from majority nodes to all other nodes in netwoek now

        }
    })
})

//using async function passing an address and connect to that address
async function connect(address)
{
    //we would want to connect to our own address and address that we have already connected
    if(!connected.find(peerAddress=>peerAddress==address && address!==MY_ADDRESS))
    {
        const socket=new WS(address)
        //opening the connection and send them handshake
        socket.on('open',()=>{
            //we will be able to send our connected address as well
        socket.send(JSON.stringify(produceMessage('TYPE_HANDSHAKE',[MY_ADDRESS,...connected])))

        //we would also like to inform the nodes we have connected that we are connecting to new node
        opened.forEach(node=>node.socket.send(JSON.stringify(produceMessage('TYPE_HANDSHAKE',[address]))))
        if(!opened.find(peer=>peer.address===address) && address!==MY_ADDRESS)
        {
            opened.push({socket,address})
        }
        if(!connected.find(peerAddress=>peerAddress===address) && address!=MY_ADDRESS)
        {
            connected.push(address)
        }
    })
    socket.on('close',()=>{
        //we will remove address from array if they disconnect
        opened.splice(connected.indexOf(address),1)
        connected.splice(connected.indexOf(address),1)
    })
    }
}

function produceMessage(type,data)
{
    return {type,data}
}
//handle the message
function sendMessage(message)
{
    opened.forEach(node=>{
        node.socket.send(JSON.stringify(message))
        /*
        type: type_create_transaction
        data: data is bascially transaction object converted to json
        */

    })
}

process.on('uncaughtException',err=>console.log(err))
PEERS.forEach(peer=>connect(peer))


//this node will mine transaction
setTimeout(()=>{
    if(JeChain.transactions.length!==0)
    {
        //then start mining txns
        JeChain.mineTransactions(publicKey)
        sendMessage(produceMessage('TYPE_REPLACE_CHAIN',[
            //sending the last block and new diffciuty
            JeChain.getLastBlock(),
            JeChain.difficulty
        ]))
    }
},6500)

setTimeout(()=>{
    console.log(opened)
    console.log(JeChain)
},10000)