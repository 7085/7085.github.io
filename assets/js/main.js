document.addEventListener("DOMContentLoaded", init);

var get = null;
const templates = {};
var insertionPoint = null;
var index = null;

function init() {
	initEnv();

	initTemplates();

	window.addEventListener("hashchange", navigationHandler);
	
	get("posts/json/index.json", data => {
		index = data;
		window.location.hash = "#home";
	});
}

function initEnv() {
	if (window.fetch === undefined || typeof window.fetch !== "function") {
		/** use xhr */
		get = function(url, cb) {
			const x = new XMLHttpRequest();
			x.open("GET", url);
			x.responseType = "json"
			x.onload = function() {
				if (x.status !== "200") {
					console.error(`Request (${x.status}): ${x.statusText}`);
					cb(null);
					return;
				}

				cb(x.response);
			};
			x.onerror = function() {
				console.error(`Request failed!`);
			};
			x.send();
		};
	}
	else {
		get = function(url, cb) {
			fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error(`(${x.status}): ${x.statusText}`);
				}

				return response.json();
			})
			.then(data => {
				cb(data);
			})
			.catch(error => {
				console.error(`Request failed: ${error.message}`);
				cb(null);
			});
		};
	}
}

function initTemplates() {
	insertionPoint = document.querySelector("#content-container");

	const templateNodes = document.querySelectorAll("template");
	for (let i = 0, l = templateNodes.length; i < l; i++) {
		let templateNode = templateNodes[i];
		templates[templateNode.id.replace("template-", "")] = templateNode;
	}
}

function navigationHandler() {
	const clientPath = window.location.hash.slice(1);
	const [page, entry, fancytitle] = clientPath.split("/");
	
	switch (page) {
		case "projects":
			loadPageProjects();
			break;

		case "about":
			loadPageAbout();
			break;

		case "blog":
			loadPageBlog(entry);
			break;

		default: /** index */
			loadPageIndex();
			break;
	}
}

function loadPageProjects() {
	preparePage(templates["projects"], "TODO");
}

function loadPageAbout() {
	preparePage(templates["about"], "TODO");
}

function loadPageBlog(entry) {
	if (entry === undefined || entry === "") {
		preparePage(templates["blog"], "TODO");	
	}
	
	preparePage(templates["blog-entry"], "TODO");
}

function loadPageIndex() {
	preparePage(templates["index"], "TODO");
}

function preparePage(template, data) {
	while (insertionPoint.hasChildNodes()) {
		insertionPoint.lastChild.remove();
	}
	
	const copy = document.importNode(template.content, true);
	// template.replace(/{{(.+?)}}/g, (match, g1) => {
	// 	return data[g1];
	// });

	insertionPoint.appendChild(copy);
}