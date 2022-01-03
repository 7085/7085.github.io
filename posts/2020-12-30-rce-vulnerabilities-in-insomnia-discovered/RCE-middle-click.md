# RCE through unhandled middle mouse clicks and malicious links

## Summary

Insomnia does not handle clicks with middle mouse button.
When a victim clicks a malicious link with the middle mouse button the application will open an Electron `BrowserWindow` which has `nodeIntegration` turned on, allowing the execution of arbitrary code.

## Description

In electron, clicks with the middle mouse button (mouse wheel) generate a separate event and can't be handled by registering an event handler for the `click` event.
Such a click will bypass the existing `click`-event handlers and by default will open a new electron `BrowserWindow`.
In the case of Insomnia we have access to the node.js APIs in this new window through which we can execute arbitrary code.

## Environment/Affected Software

Tested with: 
- Insomnia Core 2020.5.1
- Insomnia 2021.1.1

OS: Windows 10

## Steps to Reproduce

1. Create a html file with the following contents and host it somewhere:
```
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

## Suggested Solution

An event listener for the middle mouse button click event should be registered and the default action should be prevented.
Furthermore the creation of new windows should be validated: https://www.electronjs.org/docs/tutorial/security#13-disable-or-limit-creation-of-new-windows