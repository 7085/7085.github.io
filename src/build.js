const fs = require("fs-extra");
const marked = require("marked");
const colors = require("colors");

const BLOGDIR = "../posts";
const BLOGDIR_OUTDIR = "../posts/json";

const POST_FORMAT = /^\d{4}-\d{2}-\d{2}/;

//fs.copyFile("node_modules/marked/marked.min.js", "assets/js/marked.min.js");

const startTime = new Date();
console.log(`Started post transformation at ${startTime.toTimeString().slice(0,8)}.`)

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
				console.log(`[${"FAIL".yellow}] ${file}: ${"Not a post! Skipping...".yellow}`);
				processedPosts++;
				return;
			}
			
			const json = {};
			json.html = marked(data);
			json.title = data.slice(1, data.indexOf("\n")).trim();
			json.created = file.slice(0, 10);
			json.lastUpdate = "";
			if (data.indexOf("*Update ") !== -1) {
				/** use natural sorting of updates: old -> new */
				const matches = [...data.matchAll(/^\*Update (\d{4}.\d{2}.\d{2}|\d{2}.\d{2}.\d{4}).*?\*/mg)];
				json.lastUpdate = matches[matches.length - 1][1];
			}

			const jsonStr = JSON.stringify(json);
			const fileName = file.replace(".md", ".json");
			fs.writeFile(BLOGDIR_OUTDIR +"/"+ fileName, jsonStr, "utf8", (err) => {
				if (err) {
					console.log(`[${"FAIL".red}] ${file}: ${err.message}`);
					throw err;
				}

				console.log(`[${"OK".green}] ${file}`);
				processedPosts++;

				if (processedPosts === nrOfPosts) {
					const endTime = new Date();
					const durationMS = endTime - startTime;
					const ms = durationMS % 1000;
					const hhmmss = (new Date(durationMS)).toUTCString().slice(17,25);
					console.log(`Finished post transformation at ${endTime.toTimeString().slice(0,8)}.`);
					console.log(`Time used: ${hhmmss +"."+ ms}`)
				}
			});
		});
	});
});