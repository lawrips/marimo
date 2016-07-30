```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

# Features
Marimo hosts your tests and lets you run them remotely over the web and also run them constantly for E2E system monitoring. Initial support is for both Mocha (http://mochajs.org/) and Postman (http://www.getpostman.com) with more coming soon. Tests are accessed over a WebSocket and can be displayed real time in a website, app or any other framework. Features include:
* (NEW) Now in v1.5, support for Postman.
* Standard WebSockets support, accessible via a browser, another node app or any other WebSocket client
* Tests can be run perpetually for system monitoring scenarios 
* Optional token based authentication (handshake over HTTP(S) and initialize over WebSocket)
* Encryption via TLS / HTTPS
* Support for Mocha and Postman (in beta) - other test frameworks coming soon
* Extensible / customizable output via your own reporters

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
1 . Create a new folder and install required modules: 
```
npm --save install marimo should mocha
```

2 . Copy the above server code and save in a file (e.g. server.js). This file can also be found [here](https://github.com/lawrips/marimo/blob/master/samples/server.js):
```
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```
 

3 . Create a sub directory, called “resources” and create a mocha test within it. An example can be found [here](https://github.com/lawrips/marimo/blob/master/samples/simple.js), and below:

```
var should = require('should');

describe('my amazing test suite', () => {
  it('a simple test', (done) => {
    var a = 2;
    var b = 2;
    a.should.be.equal(b);            
    done();
  });
});
```

4 . You can now run the server:
```
node server.js
```

## Client
Connect to marimo and run the above test you just created:

### Node.Js
1 . Create a client to talk to marimo. This can be copied from the file 'client_noauth.js found [here](https://github.com/lawrips/marimo/blob/master/samples/client_noauth.js).

You can also use something simple like wscat:

Connect:
```
wscat -c http://localhost:10001

< {"availableTests":{"simple":{"file":"resources/simple","type":"mocha","description":"my amazing test suite"}}}
```

Run the test by sending a simple JSON command:
```
> {"test":"simple"}

< Tests beginning. Count = 4
< ✓ Test passed! [1 / 4]: "a simple test" (duration 2 ms)
< ✓ Test passed! [2 / 4]: "a second simple test" (duration 0 ms)
< ✓ Test passed! [3 / 4]: "a third simple test" (duration 1 ms)
< ✗ Test failed! [4 / 4]: "a test designed to fail" (error: expected 1 to be 4)
< {"count":4,"duration":3,"passed":3,"failed":1}
< Tests done. passes = 3, failures = 1
```

### Browser
1 . Create a web based client to talk to marimo. This can be copied from the file browser.html found [here](https://github.com/lawrips/marimo/blob/master/samples/browser.html).



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
If a password is supplied in the constructor (previous step), this requires an authorization handshake to take place over HTTP before the WebSocket can be established. The HTTP auth request can be successfully completed as simply as:

``` 
curl -H 'authorization: basic password' http://localhost:10001/auth

ZVg1VmpHRXpIMlVCRjV3dy9KeHB0U3gvWFA4ZFkybFc3d1k1WHVTOSs2aDlTa0sxUkUraDhYaXJKQTVuNmtpSHZ0MUp1N1c5ZUpNVUkzNmEvK3FMTkE9PQL
```

A successful handshake will respond with a token, which should then be passed in the WebSocket connection setup:

```
wscat -c http://localhost:10001/?token=ZVg1VmpHRXpIMlVCRjV3dy9KeHB0U3gvWFA4ZFkybFc3d1k1WHVTOSs2aDlTa0sxUkUraDhYaXJKQTVuNmtpSHZ0MUp1N1c5ZUpNVUkzNmEvK3FMTkE9PQL

< {"availableTests":{"simple":{"file":"resources/simple","type":"mocha","description":"my amazing test suite"}}}
```

The following shows how to connect to marimo when auth is enabled (sample is also available [here](https://github.com/lawrips/marimo/blob/master/samples/client.js)):


## Running Tests
Once a WebSocket connection has been made, simply send the following to initiate a test.

In code (Node):

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

wscat:
```
wscat -c http://localhost:10001
> {"test":"simple","reporter":"basic"}
```

The parameter ‘test’ will be the name of your test file to run. When you first connect to marimo, it will return back an object with the available tests that have been loaded. For example:

```
{
  "availableTests":
  {
    "simple":
    {
      "type":"mocha",
      "file":"resources/simple",
      "description":"my amazing test suite"
    }
  }
}
``` 

### Running multiple tests
A comma separated list of tests will result in each test being run sequentially. This can be done as follows:

In code (Node):
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

wscat:
```
wscat -c http://localhost:10001
> {"test":"simpleTest1,simpleTest2","reporter":"basic"}
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

In code (Node):
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
wscat:
```
wscat -c http://localhost:10001
> {"test":"simpleTest1,simpleTest2","reporter":"basic","env":{"appId":"1234","appName":"marimo"}}
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

## Using Marimo for Monitoring
The above examples show tests which are run once. Marimo can also be used to run tests perpetually to be used for monitoring / alerting. To run a test in this mode, send the following JSON:

In code (Node):
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
wscat:
```
wscat -c http://localhost:10001?monitor=true
> {"test":"simple","reporter":"basic","monitor":{"cmd":"start","delay":1000}}
```

Once a monitor style test has been started, marimo will send test results to all connected WebSocket clients that have requested to receive these updates.

To request these updates, a client must connect with URL query parameter "monitor" set to "true". As follows:

```
wscat -c http://localhost:10001?monitor=true
```

To monitor multiple tests, either send a comma separated list of tests (e.g. test: 'simple,complex') or send multiple requests separately (this would be preferable if you want a different delay between each test). As of 1.4.0, Marimo now supports process isolation of each test so these tests are run in parallel. Note that once a test has been started, it can also be stopped using the following command:

In code (Node):
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

wscat:
```
wscat -c http://localhost:10001?monitor=true
> {"test":"simple","monitor":{"cmd":"stop"}}
```

An example client which implementing this feature can be seen in [browser_monitor.html](https://github.com/lawrips/marimo/blob/master/samples/browser_monitor.html)  