'use strict';

const WebSocket = require('ws');

var ws = new WebSocket(`ws://localhost:10001`);

ws.on('open', () => {
    ws.send(JSON.stringify(
        {
            reporter: 'basic',
            test: 'simple'
        })
    );
});

ws.on('message', (data, flags) => {
    console.log(data);
});
    
