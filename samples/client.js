'use strict';

const http = require('request'),
    WebSocket = require('ws');

http('http://localhost:10001/auth', {
    method: 'get',
    headers: {
        authorization: 'basic a-random-password'
    }}, (err, response, body) => {
        if (err) {
            console.dir(err);
            process.exit(0);
        }
        console.log(`auth success, token: [${body}]`);
        var ws = new WebSocket(`ws://localhost:10001/?token=${body}`);

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
});
        
