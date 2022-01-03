const fs = require("fs-extra");
const marked = require("marked");
const colors = require("colors");
const hljs = require("highlight.js");
const cli = require("commander");
const path = require("path");

cli.option("-p --post <post_id>", "Transform a single post of the posts directory.");
cli.option("-a --all", "Rebuild all posts.");

cli.parse(process.argv);

const markedRenderer = new marked.Renderer();
const absUrlRegex = /^[a-z0-9+.-]+:/;
const relativeDirectLinkRegex = /^[#\/]/;
const dblQuoteRegex = new RegExp(`"`, "g");
var currentPostId = "";
markedRenderer.image = function (href, title, text) {
	const ext = href.slice(href.lastIndexOf(".") + 1);
	switch (ext) {
		case "mp4":
		case "ogg":
		case "webm":
			return handleMdVideo(href, ext, title, text);
	
		default:
			return handleMdImage(href, title, text);
	}
};
markedRenderer.link = handleMdLink;
marked.setOptions({
	highlight: function(code, lang) {
		if (!lang || lang === "txt" || lang === "text") {
			return code;
		}
		
		return hljs.highlight(lang, code).value;
	},
	renderer: markedRenderer
});

function handleMdImage(href, title, text) {
	var srcPart = "src=";
	if (absUrlRegex.test(href) || relativeDirectLinkRegex.test(href)) {
		srcPart += `"${href}"`;
	}
	else {
		srcPart += `"/posts/${currentPostId}/${href}"`;
	}

	var textPart = ` alt="${text.replace(dblQuoteRegex, "&quot;")}"`;

	var titlePart = " title=";
	if (title) {
		titlePart += `"${title.replace(dblQuoteRegex, "&quot;")}"`;
	}
	else {
		titlePart = "";
	}

	return `<img ${srcPart}${textPart}${titlePart}>`;
}

function handleMdVideo(href, ext, poster, text) {
	var posterPart = "";
	if (poster) {
		posterPart = `poster="${poster}"`
	}

	const src = `/posts/${currentPostId}/${href}`;

	return `<figure>
				<video controls="true" ${posterPart}>
					<source src="${src}" type="video/${ext}">
				</video>
				<figcaption>Video: ${text}</figcaption>
			</figure>`
}

function handleMdLink(href, title, text) {
	if (!absUrlRegex.test(href) && !relativeDirectLinkRegex.test(href)) {
		href = `/posts/${currentPostId}/${href}`;
		console.log("DEBUG fixing relative link: "+ href);
	}
	return marked.Renderer.prototype.link.call(this, href, title, text);
}

const ROOT = path.resolve(__dirname, "..");
const BLOGDIR = ROOT +"/posts";
const BLOGDIR_OUTDIR = ROOT +"/posts/json";
const POST_INDEX_FILE = BLOGDIR_OUTDIR +"/index.json";
const POST_FORMAT = /^\d{4}-\d{2}-\d{2}/;
const CODE_STYLESHEET = ROOT +"/node_modules/highlight.js/styles/vs2015.css";
const CODE_STYLESHEET_DEST = ROOT +"/assets/css/codestyle.css";

let startTime = new Date();
let index = {};

startTime = new Date();
console.log(`Started post transformation at ${startTime.toTimeString().slice(0,8)}.`);
if (cli.post) {
	console.log(`Building single post ${cli.post}.`);
	loadindex();

	const file = BLOGDIR +"/"+ cli.post +"/"+ cli.post +".md";
	fs.pathExists(file, (err, exists) => {
		if (exists) {
			transformPost(cli.post, processingFinished);
		}
	});
}
else if (cli.all) {
	/** rebuild all posts, dont load index file */
	console.log("Building all posts.");

	fs.readdir(BLOGDIR, (err, posts) => {
		/** subtract default non-posts */
		const nrOfPosts = posts.length - 1;
		var processedPosts = 0;
		console.log(`Found ${nrOfPosts} posts:`);

		posts.forEach(post => {
			transformPost(post, (ok) => {
				processedPosts++;

				if (processedPosts === nrOfPosts) {
					processingFinished();
				}
			});
		});
	});
}
else {
	/** build new posts */
	console.log("Building new posts only.");
	loadindex();

	fs.readdir(BLOGDIR, (err, posts) => {
		/** subtract default non-posts */
		const nrOfPosts = posts.length - 1;
		var processedPosts = 0;

		posts.forEach(post => {
			if (isIndexed(post)) {
				console.log(`Skipping ${post} because it already exists.`);
				processedPosts++;

				if (processedPosts === nrOfPosts) {
					processingFinished();
				}

				return;
			}

			transformPost(post, (ok) => {
				processedPosts++;

				if (processedPosts === nrOfPosts) {
					processingFinished();
				}
			});
		});
	});
}


function copyStylesheet () {
	if (fs.existsSync(CODE_STYLESHEET_DEST)) {
		const mod1 = fs.statSync(CODE_STYLESHEET).mtimeMs;
		const mod2 = fs.statSync(CODE_STYLESHEET_DEST).mtimeMs;

		if (mod1 <= mod2) {
			return;
		}
	}

	fs.copy(CODE_STYLESHEET, CODE_STYLESHEET_DEST, err => {
		if (err) {
			console.log(`[${"FAIL".red}] Copying code stylesheet: ${err.message}`);
		}
		else {
			console.log(`[${"OK".green}] Copying code stylesheet.`);
		}
	});
}
copyStylesheet();


function transformPost(postId, cb) {
	if (!POST_FORMAT.test(postId)) {
		return;
	}

	const file = BLOGDIR +"/"+ postId +"/"+ postId +".md";
	fs.readFile(file, "utf8", (err, data) => {
		if (err) {
			console.log(`[${"FAIL".red}] ${postId}: ${err.message}`);
			cb(false);
			return;
		}

		if (data === "" || data.length < 3) {
			console.log(`[${"FAIL".yellow}] ${postId}: ${"Invalid post! Skipping...".yellow}`);
			cb(false);
			return;
		}
		
		const post = createPost(postId, data);

		const postStr = JSON.stringify(post);
		const destination = BLOGDIR_OUTDIR +"/"+ postId +".json";
		fs.writeFile(destination, postStr, "utf8", (err) => {
			if (err) {
				console.log(`[${"FAIL".red}] ${postId}: ${err.message}`);
				cb(false);
				return;
			}

			console.log(`[${"OK".green}] ${postId}`);
			
			addToIndex(post);
			cb(true);
		});
	});
}

function processingFinished() {
	const endTime = new Date();
	console.log(`Finished post transformation at ${endTime.toTimeString().slice(0,8)}.`);
	console.log(`Time used: ${duration(startTime, endTime)}`)

	const indexStr = JSON.stringify(index);
	fs.writeFile(POST_INDEX_FILE, indexStr, "utf8", (err) => {
		if (err) {
			console.log(`[${"FAIL".red}] Writing index file: ${err.message}`);
			throw err;
		}

		console.log(`[${"OK".green}] Writing index file.`);
	});
}

function addToIndex(post) {
	if (!index[post.year]) {
		index[post.year] = {};
	}
	
	const indexObj = {};
	indexObj.id = post.id
	indexObj.title = post.title;
	indexObj.date = post.created;
	index[post.year][post.id] = indexObj;
}

function isIndexed(postId) {
	const year = postId.slice(0, 4);
	if (!index[year]) {
		return false;
	}

	if (!index[year][postId]) {
		return false;
	}

	return true;
}

function createPost(postId, data) {
	currentPostId = postId;

	const post = {};
	post.id = postId;
	post.title = data.slice(1, data.indexOf("\n")).trim();
	post.year = postId.slice(0, 4);
	post.created = postId.slice(0, 10);
	post.html = marked(data);
	post.lastUpdate = "";
	if (data.indexOf("*Update ") !== -1) {
		/** use natural sorting of updates: old -> new */
		const matches = [...data.matchAll(/^\*Update (\d{4}.\d{2}.\d{2}|\d{2}.\d{2}.\d{4}).*?\*/mg)];
		post.lastUpdate = matches[matches.length - 1][1];
	}

	return post;
}

function duration(start, end) {
	end = end || new Date();
	const durationMS = end - start;
	const ms = durationMS % 1000;
	const hhmmss = (new Date(durationMS)).toUTCString().slice(17,25);
	return hhmmss +"."+ ms;
}

function loadindex() {
	/** load possible existing index */
	if (fs.pathExistsSync(POST_INDEX_FILE)) {
		index = fs.readJSONSync(POST_INDEX_FILE);
		console.log(`Loaded index in ${duration(startTime)}`)
	}
}