const apiEndpoint = "posts/json/";

var get = null;
const templates = {};
var insertionPoint = null;
var index = null;
const dateOptions = {
	day: "2-digit",
	month: "short",
	year: "numeric"
};

document.addEventListener("DOMContentLoaded", init);

function init() {
	initEnv();
	initTemplates();

	get(apiEndpoint +"index.json", data => {
		index = data;

		window.addEventListener("hashchange", navigationHandler);
		if (window.location.hash !== "") {
			window.dispatchEvent(new HashChangeEvent("hashchange"));
		}
		else {
			window.location.hash = "#/home";
		}
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
				if (x.status !== 200) {
					console.error(`Request (${x.status}): ${x.statusText}`);
					cb(null);
					return;
				}
				cb(x.response);
			};
			x.onerror = function() {
				console.error(`Request failed!`);
				cb(null);
			};
			x.send();
		};
	}
	else {
		get = function(url, cb) {
			fetch(url)
			.then(response => {
				if (!response.ok) {
					throw new Error(`(${response.status}): ${response.statusText}`);
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

function getTemplate(name) {
	return document.importNode(templates[name].content, true);
}

function navigationHandler() {
	const clientPath = window.location.hash;
	const [ , category, entry] = clientPath.split("/");
	switch (category) {
		case "vulnerabilities":
			loadPageVulnerabilities();
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

function loadPageVulnerabilities() {
	const htmlContent = getTemplate("vulnerabilities");
	updatePage(htmlContent);
}

// function loadPageProjects() {
// 	const htmlContent = getTemplate("projects");
// 	updatePage(htmlContent);
// }

function loadPageAbout() {
	const htmlContent = getTemplate("about");
	updatePage(htmlContent);
}

function loadPageBlog(entry) {
	if (entry === undefined || entry === "") {
		const htmlContent = getTemplate("blog");
		const sortedIndex = Object.keys(index).sort().reverse();
		for (let year of sortedIndex) {
			const section = document.createElement("h2");
			section.textContent = year;
			const list = document.createElement("ul");
			list.classList.add("post-link-wrapper");
			const sortedPosts = Object.keys(index[year]).sort().reverse();
			for (let postId of sortedPosts) {
				const post = index[year][postId];
				const li = createLinkToPost(post);
				list.appendChild(li);
			}
			htmlContent.appendChild(section);
			htmlContent.appendChild(list);
		}
		updatePage(htmlContent);
	}
	else {
		get(apiEndpoint + entry +".json", data => {
			var htmlContent = null;
			if (data === null) {
				htmlContent = getTemplate("error");
				const p = htmlContent.querySelector("p");
				p.textContent = "The post was not found!"
			}
			else {
				htmlContent = getTemplate("blog-entry");
				const div = htmlContent.querySelector("div.blog-entry");
				div.insertAdjacentHTML("afterbegin", data.html);
			}
			
			updatePage(htmlContent);
		});
	}
}

function loadPageIndex() {
	const htmlContent = getTemplate("index");
	const lastPosts = getLastPosts(5);
	const list = htmlContent.querySelector(".post-link-wrapper");
	for (let post of lastPosts) {
		const li = createLinkToPost(post);
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
		const missing = count - lastPosts.length;
		const postsOfYear = Object.values(index[year]);
		if (postsOfYear.length >= missing) {
			lastPosts = lastPosts.concat(postsOfYear.slice(-missing));
			break;
		}
		else {
			lastPosts = lastPosts.concat(postsOfYear);
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
	const li = document.createElement("li");
	const a = document.createElement("a");
	a.setAttribute("href", url);
	a.textContent = post.title;
	console.log(post.date);
	li.textContent = (new Date(post.date)).toLocaleDateString(undefined, dateOptions);
	li.appendChild(a);
	return li;
}