```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

# Features
Marimo is a framework that hosts your mocha tests in a web sockets based framework. This enables you to run your tests remotely and get the results over a web socket. These results can then be displayed real time in a website, app or any other framework. 
* Standard web sockets support
* Security via TLS
* Optional token based authentication (handshake over HTTP(S) and initialize over web sockets)
* Support for Mocha - other test frameworks coming soon
* Extensible / customizable output via your own reporters

Once connected to a running marimo server, it’s as easy as sending a message over a web socket to initiate the test:

```
ws.send(JSON.stringify(
	{
		reporter: 'basic',
		test: 'simple'
	})
);
```

And results will be streamed 
```
✓ Test passed! [1 / 1]: "a simple test" (duration 2 ms)
```


# Quick Start
## Server
1. Create a new folder and instal required modules: 
```
npm --save install marimo should mocha
```
2. Copy the above server code and save in a file (e.g. server.js). This file can also be found [here]: 
3. Create a sub directory, called “resources” and create a mocha test. For example:

```
'use strict';

const should = require('should'),
	mocha = require('mocha');

describe('my amazing test suite', () => {
	it('a simple test', (done) => {
		var a = 2;
		var b = 2;
		a.should.be.equal(b);            
		done();
	});
});

```
4. You can now run the server:
```
node server.js
```

## Client
Connect to marimo and run the above test you just created:
### Node.Js
1. . Create a client to talk to marimo. This can be copied from the file client_noauth_.js found [here] (also pasted below)

```
'use stict';

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
```

2. Run the client:

```
npm install ws
node client.js
```

3. See the results:

```
✓ Test passed! [1 / 1]: "a simple test" (duration 2 ms)
{"count":1,"duration":2,"passed":1,"failed":0}
```

### Browser
Example coming soon


# Docs
## Startup
Marimo can be started with just three simple lines of code:

```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

### Options
Startup options include:

```
let marimo = new Marimo(
	{
		 // optional password for an HTTP auth handshake. Will return a token which can be passed to the web socket (default is disabled)
		auth: ‘my-random-password’,

		// optional path to test files (default is ‘./resources’)		
		directory: ‘./mypath’, 

		// optional timeout in milliseconds (default is 10000)
		timeout: 2000 
	}
);
```
## Authorization
If a password is supplied in the constructor (previous step), this requires an authorization handshake to take place over HTTP before the web socket can be established. The HTTP auth request takes the following format:

```
Authorization: basic my-random-password
GET /auth 
```

A successful handshake will respond with a token, which should then be passed in the web socket connection setup:

```
[ws://server:port/?token={token-from-previous-step}]
```

The following shows how to connect to marimo when auth is enabled (sample is also available [here]):

### Node.Js

```
'use strict';

const http = require('request'),
	WebSocket = require('ws');

http('http://localhost:10001/auth', {
	method: 'get',
	headers: {
		authorization: 'basic a-random-password'
	}}, (err, response, body) => {
		if (err) {
			console.dir(response);
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
```

## Running Tests
Once a web socket connection has been made, simply send the following to initiate a test:

```
 ws.on('open', () => {
	ws.send(JSON.stringify(
		{
			reporter: 'basic',
			test: 'simple'
		})
	);
});
```

The parameter ‘test’ will be the name of your test file to run. 

The default reporter should be ‘basic’. Custom reporters can be created by contributing to the marimo git repo. 