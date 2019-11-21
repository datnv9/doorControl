const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 6001;

const fs = require('fs');

const axios = require('axios');

const WebSocket = require('ws');

const wss = new WebSocket.Server({ server: http });

const telegramUrl = process.env.TELEGRAM_URL
const key = process.env.TOKEN
const listKey = process.env.LIST_KEY.split(',')

let doorWs
let isDoorWsLive = false

wss.on('connection', function connection(ws, req) {
  ws.id = req.headers['sec-websocket-key']
  console.log(new Date(), 'ws connect!', ws.id)
//   ws.send('Connect OK!');

  ws.on('message', function incoming(message) {
    let objectMessage
    try {
      objectMessage = JSON.parse(message)
    } catch (error) {
      console.log('WS data received:', message)
      return
    }

    console.log("objectMessage", objectMessage)

    switch (objectMessage.e) {
      case 'doorInfo':
        doorWs = ws
        isDoorWsLive = true
        break;
      case 'controlOk':
        console.log("Send message to telegram", objectMessage.d.name + '_' + objectMessage.d.control + '_' + objectMessage.d.key + ' ' + objectMessage.d.localIP)
        try {
          axios.get(telegramUrl + encodeURIComponent(objectMessage.d.name + '_' + objectMessage.d.control + '_' + objectMessage.d.key + ' ' + objectMessage.d.localIP))
          .then(function (response) {
          })
          .catch(function (error) {
            console.log("TELEGRAM ERROR", error);
          })
        } catch (error) {
          console.log("TELEGRAM SEND ERROR:", error)
        }
        break;
      default:
    }

  });

  ws.on('ping', function ()  {
//     console.log("ping")
    if (!isDoorWsLive) {
      console.log(new Date(), "Door live")
    }
    doorWs = ws
    isDoorWsLive = true
    
  })

  ws.on('close', function () {
    console.log('wss close ws.id - doorWs.id', ws.id, doorWs.id)
    if (doorWs.id == ws.id) {
      isDoorWsLive = false
      doorWs = {}
    }
  })
  
  ws.on('error', function(err) {
    console.log("WS ON ERROR", err);
    isDoorWsLive = false
    try {
      axios.get(telegramUrl + encodeURIComponent(err.message))
      .then(function (response) {
      })
      .catch(function (error) {
        console.log("TELEGRAM ERROR", error);
      })
    } catch (error) {
      console.log("TELEGRAM SEND ERROR:", error)
    }
  })
  
});

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

app.use("/public", express.static(__dirname + "/public"));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/login', function(req, res){
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/manifest.json', function(req, res){
  res.sendFile(__dirname + '/public/manifest.json');
});

app.get('/service-worker.js', function(req, res){
  res.sendFile(__dirname + '/public/service-worker.js');
});

app.get('/api/login', function(req, res){
  console.log(new Date(), "/api/login", req.query)
  if (!req.query.name || req.query.name == null || req.query.name == '' || req.query.name == 'null') {
    return res.status(404).send({ message: 'Name!!!'})
  }

  if (!req.query.key || req.query.key == null || req.query.key == '' || req.query.key == 'null') {
    return res.status(404).send({ message: 'Key!!!'})
  }
  
  if (listKey.includes(req.query.key)) {
    return res.send({ message: 'OK'})
  }
  return res.status(403).send({ message: 'Key wrong!!!'})
});

app.get('/api/door', function(req, res){
  console.log(new Date(), req.query)
	
  if (!req.query.control || req.query.control == 'null'){
    return res.status(404).send({ message: 'Control!!!'})
  }

  if (!req.query.name || req.query.name == 'null'){
    return res.status(404).send({ message: 'Name!!!'})
  }
  
  if (!req.query.key || req.query.key == 'null' ){
    return res.status(404).send({ message: 'Key!!!'})
  }
  
  if (!listKey.includes(req.query.key)) {
    return res.status(403).send({ message: 'Permission'})
  }

  if (isDoorWsLive){
    try {
      doorWs.send(JSON.stringify({ e: 'door', d: { control: req.query.control, name: req.query.name,  key: req.query.key} }))
    } catch (error) {
      console.log("WS error", error)
    }
    return res.send({ message: 'OK'})
  } else {
    return res.status(500).send({ message: 'Door not connect!!!'})
  }
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
 
