const { async } = require('utilities')
const WS=require('ws')

const server=new WS.Server({port:'8000'})
//listening to the connections and we will create event handler, every time node connects to us the event handler will be triggered
server.on('connection',async(socket,req)=>{

})

//socket from the address
const socket=new WS()

//event handler
socket.on('open',()=>{

})

//node discoonnected
socket.on('close',()=>{

})

//listening to messages
socket.on('message',message=>{

})