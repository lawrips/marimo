# Marimo

```js
// start marimo
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 

// add some tests
marimo.addFile('./resources/myLocalTest.js');
marimo.addFile('http://myserver/myRemoteTest.js');
```

## New in 1.6 
New features in 1.6 including:
* Moved to production build of Newman (Postman runtime for Node.js)  
* Tests can now be added from URL's (e.g. marimo.addFile('http://myserver/myRemoteMochaTest.js'))
* Normalized api behavior for Postman and Mocha tests (use of environment variables, adding tests)
* Further stability improvements, bug fixes, etc

## Features
Marimo hosts your tests and lets you run them remotely over the web and also run them constantly for E2E system monitoring.
Initial support is for both Mocha (http://mochajs.org/) and Postman (http://www.getpostman.com) with more coming soon.
Tests are accessed over a WebSocket and can be displayed real time in a website, app or any other framework.
Features include:
* Standard WebSockets support, accessible via a browser, another node app or any other WebSocket client
* Tests can be run perpetually and their output pushed to an alerting / monitoring service for system monitoring scenarios 
* Optional token based authentication (handshake over HTTP(S) and initialize over WebSocket)
* Encryption via TLS / HTTPS
* Support for Mocha and Postman  (beta) - other test frameworks coming soon
* Extensible / customizable output via your own reporters
* Tests can be loaded from local filesystem or remote URL's
* Support for environment variables (either process.env or resource files)

Once connected to a running marimo server, it's as easy as sending a message over a WebSocket to initiate the test:

```js
ws.send(JSON.stringify({
  test: 'simple'
}));
```

And results will be streamed 
```
✓ Test passed! [1 / 1]: "a simple test" (duration 2 ms)
```

# Docs
* [Quick Start](#anchor)
	* [Server](#server)
	* [Client](#client)
* [Usage](#usage)
	* [Startup](#startup)
	* [Options](#options)
	* [Loading Tests](#loadingtests)
		* [Load all files at startup](#loadatstartup)
		* [Load tests individually](#loadindividually)
	* [Connecting to marimo](#connecting)
		* [Clients](#clients)
		* [Getting available tests](#availableTests)
	* [Running tests](#runningTests)
		* [Running Multiple Tests](#multipleTests)
		* [Sending parameters to tests over the WebSocket](#sendingParams)
		* [Loading parameters from a resource file](#loadingParams) 
		* [Disabling the use of parameters on the serverside](#disablingParams)
	* [Using marimo for monitoring](#monitoring)
	* [Authorization](#authorization)
	* [Reporters](#reporters)
	* [logs](#logs)
	

# <a name="quickstart"></a>Quick Start
## <a name="server"></a>Server
1 . Create a new folder, run "npm init" to create a sample package.json and then install required modules: 
```bash
$ npm --save install marimo should mocha
```

2 . Create a server.js file based on [this example](https://github.com/lawrips/marimo/blob/master/samples/server.js), copied below:
```js
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```
 
3 . Create a sub directory, called "resources" and create a mocha test within it. An example can be found [here](https://github.com/lawrips/marimo/blob/master/samples/simple.js), and below:

```js
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

4 . That's it! You can now run the server:
```
node server.js
```

## <a name="client"></a> Client
Connect to marimo and run the above test you just created. The simplest way to get started is to use a simple a simple WebSocket client like wscat. To connect enter the following command and marimo will respond with the available tests:
```bash
$ wscat -c ws://localhost:10001

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

You can also create a node client (or any other language) to talk to marimo. Find an example in the file client\_noauth.js found [here](https://github.com/lawrips/marimo/blob/master/samples/client_noauth.js). 

See below for more info on options.

# <a name="usage"></a>Usage
## <a name="startup"></a>Startup
Marimo can be started with just three simple lines of code:

```js
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 
```

### <a name="options"></a>Options
Startup options include:

```js
let marimo = new Marimo({
  // optional password for an HTTP auth handshake. Will return a token which can be passed to the WebSocket (default is disabled)
  auth: 'my-random-password',

  // optional path to test files (default is './resources')		
  directory: './mypath', 

  // optional timeout in milliseconds (default is 60000)
  timeout: 2000,

  // optional starting port which will be used for the debugger when launching mocha (default is 12141)
  debugPort: 11111, 

  // optional number of ports which will determine the port range for the debugger for mocha tests (to avoid port collisions)
  debugPortRange: 100,

  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
```

## <a name="loadingtests"></a>Loading tests 
In order to run a test, it must be registered with the server. Valid files which will be recognized are:

1. Mocha files (extension .js)
2. Postman files and their environment resources (extension .json)

There are two ways to do register test files with marimo:

### <a name="loadatstartup"></a>Load all files at startup
If you specify the "directory" parameter in marimo's constructor, it will automatically load all tests in that folder (and its sub folders). The default directory is './resources' which does not have to exist in your server. However, if you specify a directory manually in the constructor, it must exist.

Note that files must be uniquely named or the latest will overwrite. 
```js
var Marimo = require('marimo');
var marimo = new Marimo({'directory':'./myfolder'});
marimo.listen(10001); 
```

If the 'directory' option is not supplied, the server will default to './resources'.

### <a name="loadindividually"></a>Load files individually
You can also easily add files individually, both from the local filesystem and a remote server:

```js
// start marimo
var Marimo = require('marimo');
var marimo = new Marimo();
marimo.listen(10001); 

// add a local file
marimo.addFile('./myfolder/myLocalTest.js');

// add a remote file
marimo.addFile('http://myserver/myRemoteTest.js');
```

Once you add a file, it becomes available to run from a client. In the above example, to run the last test that was added, simply refer to it by filename (without the .js extension):
```bash
$ wscat -c ws://localhost:10001
> {"test":"myRemoteTest"}
```

## <a name="connecting"></a>Connecting to marimo

### <a name="clients"></a>Clients
Connect to marimo by with any WebSocket client or API. Here are some examples.

wscat: 
```bash
$ wscat -c ws://localhost:10001
```

Node.js:
```js
var WebSocket = require('ws');
var ws = new WebSocket(`ws://localhost:10001`);

ws.on('open', () => {
});

ws.on('message', (data, flags) => {
	console.log(data);
});
```

Also found [here](https://github.com/lawrips/marimo/blob/master/samples/client_noauth.js).

Browser:
```js
<script type="text/javascript">
	// connect to your server running marimo 
	socket = new WebSocket("ws://localhost:10001");

	// open the socket connection
	socket.onopen = function (event) {				
		// raise events on incoming messages
		socket.onmessage = function (event) {
			console.log(event);
		}
	}
</script>
```

Also found [here](https://github.com/lawrips/marimo/blob/master/samples/browser.html).

### <a name="availableTests"></a>Getting available tests

Once a client WebSocket connection has been established with marimo, the server will always reply with information available about the server. This will be JSON in the format:
```
{
	"availableTests": {...},     // a dictionary of the previously loaded tests
	"availableEnvironments": {...},    // a dictionary available json files that were loaded (postman specific - see later) 
	"monitoringTests": {...},    // a comma separated list of tests that are running in monitoring mode (if any)
}
```

Example:
```bash
$ wscat -c ws://localhost:10001
< {"availableTests":{"simple":{"file":"resources/simple","type":"mocha","description":"my amazing test suite"}}}
```

These are the tests have have been loaded, and can now be run remotely. 

## <a name="runningTests"></a>Running Tests
Once a WebSocket connection has been made, send a JSON object to initiate a test. These should be in the format:

```
{
	"test": "...",     // name of the test you want to run 
	"reporter": "...",    // optional reporter (default is "basic")
	"env": {...}    // optional object with environment variables
}
```

Example with wscat:
```bash
$ wscat -c ws://localhost:10001
> {"test":"simple","reporter":"basic"}
```

Example in Node.js:
```js
ws.on('open', () => {
  ws.send(JSON.stringify(
	{
	  reporter: 'basic',  // optional reporter (see more for below)
	  test: 'simple'   // name of the test you want to run 
	})
  );
});
```

In these examples , the parameter 'test' will be the name of your test file to run.  This value must correspond to one of the tests returned back in the "availableTests" object when first connecting

### <a name="multipleTests"></a>Running multiple tests
A comma separated list of tests will result in each test being run sequentially. This can be done as follows:

wscat:
```bash
$ wscat -c ws://localhost:10001
> {"test":"simpleTest1,simpleTest2","reporter":"basic"}
```

Node.js:
```js
ws.on('open', () => {
  ws.send(JSON.stringify(
	{
	  reporter: 'basic',
	  test: 'simpleTest1,simpleTest2'
	})
  );
});
```

### <a name="sendingParams"></a>Sending parameters to tests over the WebSocket
Often tests will require access to environment variables.

These can be sent over the WebSocket and passed to the test at runtime by sending them in an object called "env" (note as of marimo 1.6.x, both Mocha and Postman tests can accept environment varibales in the same way).

Here's an example:  

wscat:
```bash
$ wscat -c ws://localhost:10001
> {"test":"simple","reporter":"basic","env":{"appId":"1234","appName":"marimo"}}
```

Node.js:
```js
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

In order to access these parameters within your test, use either process.env (Mocha) or {{envName}} notation (Postman). The environment variables can now be accessed exactly as passed. For example to access the above environment variables, your tests just need to include:

Node.js:
```js
let appId = process.env['appId'];
let appName = process.env['appName'];
```

Postman:
```
{{appName}}
{{appId}}
```

### <a name="loadingParams"></a>Loading parameters from a resource file

As an alternative to sending parameters over the WebSocket, parameters can be defined at coding time in a resource file and made availabel to your tests. To specify the right resources, set the "env" parameter to the name of the resource file.  

As an example, consider the following Postman env file called dev.json, which you wish to be made available to your tests:

```json
dev.json
{
	"id": "someguid",
	"name": "dev",
	"values": [{
			"key": "appId",
			"value": "1234",
			"type": "text",
			"enabled": true
		}]
}
```

To load this file and make it available to marimo, you need only include the following line in your server code:

```js
marimo.addFile('dev.json'); // if you have the file available locally
marimo.addFile('http://myserver/dev.json'); // if the file is on a remote server
```

Then upon connection to marimo via a WebSocket client, you will see "dev" listed in the availableEnvironments value.

```json
{
	"availableTests": {
		"simple":{
			"file":"resources/simple",
			"type":"postman",
			"description":"my amazing test suite"
			}
	},
	"availableEnvironments": 
	{
		"dev": {
			"file":"dev.json",
			"name":"dev"
		}
	}
}
```

This means you can now reference this previously loaded environment file whenever you start a test:

wscat:
```bash
$ wscat -c ws://localhost:10001
> {"test":"simple","reporter":"basic","env":"dev"}
```

Node.js:
```js
ws.send(JSON.stringify(
  {
	reporter: 'basic',
	test: 'simple'
	env: "dev"
  })
);
```

Then within your tests, the value "appId" can be referenced by either process.env['appId'] (Node.js) or {{appId}} (Postman).


### <a name="disablingParams"></a>Disabling the use of parameters on the server side

Note that this feature can be disabled entirely be passing a variable to the marimo constructor:
```js
let marimo = new Marimo({
  // optional parameter which if set to false, will ignore environment variables passed to tests (default is true)
  env: false 
});
```


## <a name="monitoring"></a>Using Marimo for Monitoring
A powerful feature of Marimo is the ability to run tests perpetually for monitoring / alerting scenarios. To run a test in this mode, simply send the following JSON:

wscat:
```bash
$ wscat -c ws://localhost:10001?monitor=true
> {"test":"simple","reporter":"basic","monitor":{"cmd":"start","delay":1000}}
```

Node.js:
```js
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

Once a monitor style test has been started, marimo will send test results to all connected WebSocket clients that have requested to receive these updates.

To request these updates, a client must connect with URL query parameter "monitor" set to "true". As follows:

```bash
$ wscat -c http://localhost:10001?monitor=true
```

To monitor multiple tests, either send a comma separated list of tests (e.g. test: 'simple,complex') or send multiple requests separately (this would be preferable if you want a different delay between each test). As of > 1.4.0, Marimo now supports process isolation of each test so these tests are run in parallel. Note that once a test has been started, it can also be stopped using the following command:

wscat:
```bash
$ wscat -c ws://localhost:10001?monitor=true
> {"test":"simple","monitor":{"cmd":"stop"}}
```

Node.js:
```js
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

An example client which implementing this feature can be seen in [browser\_monitor.html](https://github.com/lawrips/marimo/blob/master/samples/browser_monitor.html).

## <a name="authorization"></a>Authorization
If a password is supplied in the constructor (previous step), authorization will be enabled on the marimo server. This requires an authorization handshake to take place over HTTP before the WebSocket can be established. For example:
```js
var Marimo = require('marimo');
var marimo = new Marimo({'auth':'mypassword'});
marimo.listen(10001); 
```

This now starts marimo with auth enabled. To authorize, first send an HTTP request:

```bash 
$ curl -H 'authorization: basic mypassword' http://localhost:10001/auth
```

Successful responses will return with an HTTP 200 and the body equal to a token, which will be good for the life of the marimo server. E.g.
```
ZVg1VmpHRXpIMlVCRjV3dy9KeHB0U3gvWFA4ZFkybFc3d1k1WHVTOSs2aDlTa0sxUkUraDhYaXJKQTVuNmtpSHZ0MUp1N1c5ZUpNVUkzNmEvK3FMTkE9PQL
```

This token can then be passed in the web socket request:
```bash
$ wscat -c ws://localhost:10001/?token=ZVg1VmpHRXpIMlVCRjV3dy9KeHB0U3gvWFA4ZFkybFc3d1k1WHVTOSs2aDlTa0sxUkUraDhYaXJKQTVuNmtpSHZ0MUp1N1c5ZUpNVUkzNmEvK3FMTkE9PQL

< {"availableTests":{"simple":{"file":"resources/simple","type":"mocha","description":"my amazing test suite"}}}
```

The following shows how to connect to marimo when auth is enabled (sample is also available [here](https://github.com/lawrips/marimo/blob/master/samples/client.js)):

## <a name="reporters"></a>Reporters
Marimo uses a similar reporting model to Mocha. The default reporter is 'basic'. Custom reporters can be created by contributing to the marimo git repo.

Included reporters will be added regularly. Currently supported reporters include:
* basic
* json-stream
* json-stream-detail (new)
* landing (new)

Extensibility hooks for reporters will be added soon.

## <a name="logs"></a>Logs
To see logs, start marimo with the following environment variable (macos):

export DEBUG=marimo

Now logs will be printed to stdout, e.g.:

```
Sun, 21 Aug 2016 16:29:21 GMT marimo initialize: loading test file=https://raw.githubusercontent.com/lawrips/marimo/master/test/samples/mocha/simple.js
Sun, 21 Aug 2016 16:29:21 GMT marimo Listening on 10001
Sun, 21 Aug 2016 16:29:21 GMT marimo initialize: mocha test .marimo//simple.js loaded
Sun, 21 Aug 2016 16:29:21 GMT marimo initialize: loaded test descriptions
```

 