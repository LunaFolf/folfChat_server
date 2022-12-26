import * as ws from 'ws';
import https from 'https';
import fs from 'fs';

require('dotenv').config();

const wordDict = require('./words.json');

const messageHistory: ChatMessage[] = [];
const users: User[] = [];

const sslCertPath = process.env.SSL_CERT;
const sslKeyPath = process.env.SSL_KEY;

if (!sslCertPath || !sslKeyPath) {
  console.error('SSL certificate or key not found');
  process.exit(1);
}

const sslCert = fs.readFileSync(sslCertPath).toString();
const sslKey = fs.readFileSync(sslKeyPath).toString();

const port = Number(process.env.PORT || 8081);

console.log('Starting server on port: ', port);

const httpsServer = https.createServer({ cert: sslCert, key: sslKey })

const wss = new ws.Server({ server: httpsServer });

const broadcast = (message: ChatMessage) => {
  console.log('Broadcasting message: ', message)
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ type: 'message', content: message, username: message.username }));
    }
  });
}

function generateNewToken() {
  // Grab a ranom word from the dictionary, and make sure it's not already in use
  let token = wordDict[Math.floor(Math.random() * wordDict.length)];
  while (users.find(user => user.token === token)) {
    token = wordDict[Math.floor(Math.random() * wordDict.length)];
  }
  return token.toUpperCase();
}

function findUserFromToken(token: string) {
  return users.find(user => user.token === token.toUpperCase());
}

function userExists(token: string) {
  return !!findUserFromToken(token);
}

wss.on('connection', ws => {
  ws.on('message', (message: string) => {
    const parsedMessage = JSON.parse(message);

    console.log('Received message: ', parsedMessage)

    if (parsedMessage.type === 'message') {
      const user = findUserFromToken(parsedMessage.token);

      if (!user) {
        ws.send(JSON.stringify({ type: 'message', success: false }));
        return;
      }

      const chatMessage: ChatMessage = {
        username: user.username,
        content: parsedMessage.content
      };

      messageHistory.push(chatMessage);

      broadcast(chatMessage);
    }

    if (parsedMessage.type === 'signup') {
      if (userExists(parsedMessage.token)) {
        ws.send(JSON.stringify({ type: 'signup', success: false }));
        return;
      }

      const token = generateNewToken();
      const user: User = {
        token,
        username: parsedMessage.username
      }

      users.push(user);

      ws.send(JSON.stringify({ type: 'signup', token, success: true }));
    }

    if (parsedMessage.type === 'login') {
      const user = findUserFromToken(parsedMessage.token);

      if (!user) {
        ws.send(JSON.stringify({ type: 'login', success: false }));
        return;
      }

      ws.send(JSON.stringify({ type: 'login', success: true, username: user.username }));
    }

    if (parsedMessage.type === 'update') {
      if (!userExists(parsedMessage.token)) {
        ws.send(JSON.stringify({ type: 'update', success: false }));
        return;
      }

      ws.send(JSON.stringify({ type: 'update', success: true, messageHistory }));
    }
  });

  ws.send(JSON.stringify({ type: 'update', messageHistory, success: true }));
})

httpsServer.listen(port);