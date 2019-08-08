const apiEndpoint = "posts/json/";
const apiEndpointRes = "posts/files/";

var get = null;
const templates = {};
var insertionPoint = null;
var index = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
	initEnv();

	initTemplates();

	get(apiEndpoint +"index.json", data => {
		index = data;

		window.addEventListener("hashchange", navigationHandler);
		window.location.hash = "#/home";
	});
}

function initEnv() {
	if (window.fetch === undefined || typeof window.fetch !== "function") {
		/** use xhr */
		get = function(url, cb) {
			const x = new XMLHttpRequest();
			x.open("GET", url);
			x.responseType = "json";
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
	for (let templateNode of templateNodes) {
		templates[templateNode.id.replace("template-", "")] = templateNode;
	}
}

function navigationHandler() {
	const clientPath = window.location.hash;
	const [ , category, entry] = clientPath.split("/");
	switch (category) {
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
	const htmlContent = document.importNode(templates["projects"].content, true);

	updatePage(htmlContent);
}

function loadPageAbout() {
	const htmlContent = document.importNode(templates["about"].content, true);

	updatePage(htmlContent);
}

function loadPageBlog(entry) {
	var htmlContent = null;

	if (entry === undefined || entry === "") {
		htmlContent = document.importNode(templates["blog"].content, true);
		for (let year in index) {
			const section = document.createElement("h2");
			section.textContent = year;
			const list = document.createElement("ul");
			for (let post of index[year]) {
				const li = document.createElement("li");
				const a = createLinkToPost(post);
				li.appendChild(a);
				list.appendChild(li);
			}
			htmlContent.appendChild(section);
			htmlContent.appendChild(list);
		}
		updatePage(htmlContent);
	}
	else {
		htmlContent = document.importNode(templates["blog-entry"].content, true);
		updatePage(htmlContent);
	}
}

function loadPageIndex() {
	const htmlContent = document.importNode(templates["index"].content, true);

	const lastPosts = getLastPosts(3);
	const list = htmlContent.querySelector("#recentposts");
	for (let post of lastPosts) {
		const li = document.createElement("li");
		const a = createLinkToPost(post);
		li.appendChild(a);
		list.appendChild(li);
	}

	updatePage(htmlContent);
}

function updatePage(content) {
	while (insertionPoint.hasChildNodes()) {
		insertionPoint.lastChild.remove();
	}

	insertionPoint.appendChild(content);
}

function getLastPosts(count) {
	var lastPosts = [];
	const yearsDesc = Object.keys(index).sort().reverse();
	for (let year of yearsDesc) {
		let missing = count - lastPosts.length;
		if (index[year].length >= missing) {
			lastPosts = lastPosts.concat(index[year].slice(-missing));
			break;
		}
		else {
			lastPosts = lastPosts.concat(index[year]);
		}
	}
	
	/** sort in reverse order */
	return lastPosts.sort((o1, o2) => {
		if (o1.id < o2.id) {
			return 1;
		}
		if (o1.id > o2.id) {
			return -1;
		}
		return 0;
	});
}

function createLinkToPost(post) {
	const url = "#/blog/" + post.id;
	const a = document.createElement("a");
	a.setAttribute("href", url);
	a.textContent = post.title;
	return a;
}