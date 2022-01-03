# RCE through insecure use of `shell.openExternal()`

## Summary

Link handlers of Insomnia lack validation, which allows attackers to execute arbitrary remote executables or binaries on the local system, when a victim clicks on a malicious link.

## Description

There are multiple locations where an attacker could provide malicious links.
For example the description field of requests (which were imported through a request collection file).
They are then handled through the `shell.openExternal()` function in various places:

```
packages/insomnia-app/app/main/window-utils.js
packages/insomnia-app/app/ui/components/viewers/response-timeline-viewer.js
packages/insomnia-app/app/common/misc.js
packages/insomnia-app/app/ui/components/viewers/response-viewer.js
```

In each of them, an unvalidated URL is passed as argument.
An attacker could provide dangerous URLs which will be rendered as link and handled by those functions.
When a user clicks on such a link, the attacker could achieve remote code execution.
In a simple example an attacker will provide a link to a `.exe`-file hosted on an SMB server under his/her control.
One possible location for malicious links would be the description field of requests which could be provided through a project file or in HTTP-responses to certain requests.

This does not only affect Windows, similar attacks are possible on other operating systems too.
A detailed description of several possible attack vectors can be found here: https://benjamin-altpeter.de/shell-openexternal-dangers/

## Environment/Affected Software

Tested with: 
- Insomnia Core 2020.5.1
- Insomnia 2021.1.1

OS: Windows 10

## Steps to Reproduce (Windows)

1. In the description field of a request under the "Docs" tab add the following markdown code:
   `[file](file:///C:/windows/system32/calc.exe)`
   
2. Click on the link in the rendered documentation ("Docs" tab).
   The calculator application should be spawned.

Note: This just shows the execution of a local file, however there are several possibilities for executing remote files, see: https://benjamin-altpeter.de/shell-openexternal-dangers/

## Suggested Solution

Before passing any URLs to `shell.openExternal()` the protocol should be validated and only safe URLs should be passed to the function. For example only http(s)-Links can be forwarded.

See: https://www.electronjs.org/docs/tutorial/security#14-do-not-use-openexternal-with-untrusted-content