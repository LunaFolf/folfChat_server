import * as ws from 'ws';

require('dotenv').config();

const wordDict = require('./words.json');

const messageHistory: ChatMessage[] = [];
const users: User[] = [];

const port = Number(process.env.PORT || 8081);

console.log('Starting server on port: ', port);
const wss = new ws.Server({ port: port });

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