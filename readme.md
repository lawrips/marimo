```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

# Features
Marimo hosts your tests (initially mocha - http://mochajs.org/) and makes them available to run remotely over the web via WebSockets. The results can then be displayed real time in a website, app or any other framework. Features include:
* Standard WebSockets support, accessible via a browser, another node app or any other WebSocket client
* Optional token based authentication (handshake over HTTP(S) and initialize over WebSocket)
* Encryption via TLS / HTTPS
* Support for Mocha - other test frameworks coming soon
* Extensible / customizable output via your own reporters
* (NEW) Tests can be run perpetually for system monitoring scenarios 
* (NEW) Refactored in v1.4 to execute mocha tests as child processes and to run in parallel. This greatly improves stabiility and options for monitoring.

Once connected to a running marimo server, it’s as easy as sending a message over a WebSocket to initiate the test:

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
This file can also be found [here](https://github.com/lawrips/marimo/blob/master/samples/simple.js)

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
1. . Create a web based client to talk to marimo. This can be copied from the file browser.html found [here](https://github.com/lawrips/marimo/blob/master/samples/browser.html) (also pasted below)

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
        // this is the first WebSocket message that comes back on connect - the set of available tests  
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
  // optional password for an HTTP auth handshake. Will return a token which can be passed to the WebSocket (default is disabled)
  auth: ‘my-random-password’,

  // optional path to test files (default is ‘./resources’)		
  directory: ‘./mypath’, 

  // optional timeout in milliseconds (default is 10000)
  timeout: 2000,

  // optional starting port which will be used for the debugger when launching mocha (default is 12141)
  debugPort: 11111, 

  // optional number of ports which will determine the port range for the debugger for mocha tests (to avoid port collisions)
  debugPortRange: 100,

  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
```
## Authorization
If a password is supplied in the constructor (previous step), this requires an authorization handshake to take place over HTTP before the WebSocket can be established. The HTTP auth request takes the following format:

```
Authorization: basic my-random-password
GET /auth 
```

A successful handshake will respond with a token, which should then be passed in the WebSocket connection setup:

```
ws://server:port/?token={token-from-previous-step}
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
Once a WebSocket connection has been made, simply send the following to initiate a test:

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

### Running multiple tests
A comma separated list of tests will result in each test being run sequentially. This can be done as follows:

```
ws.on('open', () => {
  ws.send(JSON.stringify(
    {
      reporter: 'basic',
      test: 'simpleTest1,simpleTest2'
    })
  );
});
```

## Reporters
Marimo uses a similar reporting model to Mocha. The default reporter is ‘basic’. Custom reporters can be created by contributing to the marimo git repo.

Included reporters will be added regularly. Currently supported reporters include:
* basic
* json-stream
* json-stream-detail (new)
* landing (new)

## Sending parameters to tests
Optional parameters can be sent over the WebSocket to be passed to the test at runtime. Here's an example:  

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

In order to access these parameters within your mocha test, use process.env. The environment variables can now be accessed exactly as passed. For example to access the above environment variables, your tests just need to include:

```
let appId = process.env['appId'];
let appName = process.env['appName'];
```

Note that this feature can be disabled entirely be passing a variable to the marimo constructor:
```
let marimo = new Marimo({
  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
```

## Monitoring style tests
The above examples show tests which are run once. Marimo can also be used to run tests perpetually to be used for monitoring / alerting. To run a test in this mode, send the following JSON:

```
ws.on('open', () => {
  ws.send(JSON.stringify(
    {
      reporter: 'basic',
      test: 'simple'
      monitor: {
        cmd: 'start', 
        delay: 1000 // in ms
      }
    })
  );
});
```

Once a monitor style test has been started, marimo will send test results to all connected WebSocket clients that have requested to receive these updates. To request these updates, a client must connect with URL query parameter "monitor" set to "true". As follows:

```
ws://server:port/?monitor=true
```

To monitor multiple tests, just send a comma separated list of tests as in the previous section. This will be run sequentially. Note that once a test has been started, it can also be stopped using the following command:

```
ws.on('open', () => {
  ws.send(JSON.stringify(
    {
      test: 'simple',
      monitor: {
        cmd: 'stop'
      }
    })
  );
});
```

An example client which implementing this feature can be seen in [browser_monitor.html](https://github.com/lawrips/marimo/blob/master/samples/browser_monitor.html)  