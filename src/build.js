const fs = require("fs-extra");
const marked = require("marked");
const colors = require("colors");
const hljs = require("highlight.js");

marked.setOptions({
	highlight: function(code, lang) {
		if (!lang) {
			return code;
		}
		
		return hljs.highlight(lang, code).value;
	}
});

const BLOGDIR = "../posts";
const BLOGDIR_OUTDIR = "../posts/json";
const POST_INDEX_NAME = "index.json";
const POST_FORMAT = /^\d{4}-\d{2}-\d{2}/;
const CODE_STYLE = "vs2015.css"

const startTime = new Date();
const index = {};

fs.copy("../node_modules/highlight.js/styles/"+ CODE_STYLE, "../assets/css/codestyle.css", err => {
	if (err) {
		console.log(`[${"FAIL".red}] Copying code stylesheet: ${err.message}`);
	}
	else {
		console.log(`[${"OK".green}] Copying code stylesheet.`);
	}
});

console.log(`Started post transformation at ${startTime.toTimeString().slice(0,8)}.`);

fs.readdir(BLOGDIR, (err, files) => {
	/** subtract default non-posts */
	const nrOfPosts = files.length - 2;
	var processedPosts = 0;
	console.log(`Found ${nrOfPosts} posts:`);

	files.forEach(file => {
		if (!file.endsWith(".md") || !POST_FORMAT.test(file)) {
			return;
		}

		fs.readFile(BLOGDIR +"/"+ file, "utf8", (err, data) => {
			if (err) {
				console.log(`[${"FAIL".red}] ${file}: ${err.message}`);
				throw err;
			}

			if (data === "" || data.length < 3) {
				console.log(`[${"FAIL".yellow}] ${file}: ${"Invalid post! Skipping...".yellow}`);
				processedPosts++;
				return;
			}
			
			const post = createPost(file, data);

			const postStr = JSON.stringify(post);
			const fileName = file.slice(0, -3) + ".json";
			const destination = BLOGDIR_OUTDIR +"/"+ fileName;
			fs.writeFile(destination, postStr, "utf8", (err) => {
				if (err) {
					console.log(`[${"FAIL".red}] ${file}: ${err.message}`);
					throw err;
				}

				console.log(`[${"OK".green}] ${file}`);
				processedPosts++;

				addToIndex(post);

				if (processedPosts === nrOfPosts) {
					processingFinished();
				}
			});
		});
	});
});

function processingFinished() {
	const endTime = new Date();
	const durationMS = endTime - startTime;
	const ms = durationMS % 1000;
	const hhmmss = (new Date(durationMS)).toUTCString().slice(17,25);
	console.log(`Finished post transformation at ${endTime.toTimeString().slice(0,8)}.`);
	console.log(`Time used: ${hhmmss +"."+ ms}`)

	const indexStr = JSON.stringify(index);
	fs.writeFile(BLOGDIR_OUTDIR +"/"+ POST_INDEX_NAME, indexStr, "utf8", (err) => {
		if (err) {
			console.log(`[${"FAIL".red}] Writing index file: ${err.message}`);
			throw err;
		}

		console.log(`[${"OK".green}] Writing index file.`);
	});
}

function addToIndex(post) {
	if (!index[post.year]) {
		index[post.year] = [];
	}
	
	const indexObj = {};
	indexObj.id = post.id
	indexObj.title = post.title;
	index[post.year].push(indexObj);
}

function createPost(file, data) {
	const post = {};
	post.id = file.slice(0, -3);
	post.title = data.slice(1, data.indexOf("\n")).trim();
	post.year = file.slice(0, 4);
	post.created = file.slice(0, 10);
	post.html = marked(data);
	post.lastUpdate = "";
	if (data.indexOf("*Update ") !== -1) {
		/** use natural sorting of updates: old -> new */
		const matches = [...data.matchAll(/^\*Update (\d{4}.\d{2}.\d{2}|\d{2}.\d{2}.\d{4}).*?\*/mg)];
		post.lastUpdate = matches[matches.length - 1][1];
	}

	return post;
}