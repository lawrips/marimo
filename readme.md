```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

# Features
Marimo hosts your mocha (http://mochajs.org/) tests and makes them available to run remotely over a web socket. The results can then be displayed real time in a website, app or any other framework. Features include:
* Standard web sockets support, accessible via a browser, another node app or any other web socket client
* Optional token based authentication (handshake over HTTP(S) and initialize over web sockets)
* Encryption via TLS / HTTPS
* Support for Mocha - other test frameworks coming soon
* Extensible / customizable output via your own reporters

Once connected to a running marimo server, it’s as easy as sending a message over a web socket to initiate the test:

```
ws.send(JSON.stringify({
  reporter: 'basic',
  test: 'simple'
}));
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
2. Copy the above server code and save in a file (e.g. server.js). This file can also be found [here](https://github.com/lawrips/marimo/blob/master/samples/server.js): 
3. Create a sub directory, called “resources” and create a mocha test. For example:

```
'use strict';

const should = require('should');

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
1. . Create a client to talk to marimo. This can be copied from the file client_noauth_.js found [here](https://github.com/lawrips/marimo/blob/master/samples/client_noauth.js) (also pasted below)

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

3. See the results (in this case 3 lines):

```
{"availableTests":["developer","flow","geocoder","simple"]}
✓ Test passed! [1 / 1]: "a simple test" (duration 2 ms)
{"count":1,"duration":2,"passed":1,"failed":0}
```

### Browser
```
<script type="text/javascript">
  // on page load
  socket = new WebSocket("wss://mymarimoserver");
  var availableTests = null;

  // open a socket
  socket.onopen = function (event) {
    // register an event handler for new messages
    socket.onmessage = function (event) {			
      if (!availableTests) {
        // this is the first web socket message that comes back on connect - the set of available tests  
        availableTests = JSON.parse(event.data).availableTests;
        // populate your UX with available tests (e.g. a drop down list)
      }
      else {
        // any subsequent messages are the actual test results themselves (event.data)
        // update your UX test results with this message
      }
    };
  };

  // Create a handler for a 'run test' button
  $('#mybutton').click(function() {
    socket.send(JSON.stringify({
      // get the test that was selected
      test: mySelectedTest,			
      reporter: 'basic'
    }))
  });
</script> 
```

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
let marimo = new Marimo({
  // optional password for an HTTP auth handshake. Will return a token which can be passed to the web socket (default is disabled)
  auth: ‘my-random-password’,

  // optional path to test files (default is ‘./resources’)		
  directory: ‘./mypath’, 

  // optional timeout in milliseconds (default is 10000)
  timeout: 2000 

  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
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

The following shows how to connect to marimo when auth is enabled (sample is also available [here](https://github.com/lawrips/marimo/blob/master/samples/client.js)):

### Node.Js

```
'use strict';

const http = require('request'),
    WebSocket = require('ws');

http('http://localhost:10001/auth', 
{
  method: 'get',
  headers: {
    authorization: 'basic a-random-password'
  }
}, (err, response, body) => {
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

The parameter ‘test’ will be the name of your test file to run. When you first connect to marimo, it will return back an object with the available tests that have been loaded. For example:

```
{
  "availableTests":
  {
    "simple":
    {
      "file":"resources/simple",
      "description":"my amazing test suite"
    }
  }
}
``` 

## Reporters
Marimo uses a similar reporting model to Mocha. The default reporter is ‘basic’. Custom reporters can be created by contributing to the marimo git repo.

Included reporters will be added regularly. Currently supported reporters include:
* basic
* json-stream
* landing (new)

## Sending parameters to tests
Optional parameters can be sent over the web socket to be passed to the test at runtime. Here's an example:  

```
ws.send(JSON.stringify(
  {
    reporter: 'basic',
    test: 'simple'
    env: {
      'appId': '1234', 
      'appName': 'marimo'
    }
  })
);
``` 

In order to access these parameters within your mocha test, use process.env. The environment variable names will be a combination of the testname and envirnoment variable name (testname_envname). So the above example would be:

```
let appId = process.env['simple_appId'] || 'mydefaultid';
let appName = process.env['simple_appName'] || 'mydefaultname';
```

Note that this feature can be disabled entirely be passing a variable to the marimo constructor:
```
let marimo = new Marimo({
  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
```


