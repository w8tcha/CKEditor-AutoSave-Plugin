/**
 * Build process for CKEditor AutoSave Plugin
 * Concatenates the diff/vendor JS into extensions.js, minifies it to
 * extensions.min.js, and minifies autosave.css to autosave.min.css.
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const JS_DIR = path.join(__dirname, "autosave/js");
const CSS_DIR = path.join(__dirname, "autosave/css");

const jsSources = [
	path.join(JS_DIR, "difflib.js"),
	path.join(JS_DIR, "diffview.js"),
	path.join(JS_DIR, "jsdiff.js"),
	require.resolve("moment/min/moment-with-locales.js"),
	require.resolve("lz-string/libs/lz-string.js")
];

const jsOut = path.join(JS_DIR, "extensions.js");
const jsMinOut = path.join(JS_DIR, "extensions.min.js");
const cssIn = path.join(CSS_DIR, "autosave.css");
const cssMinOut = path.join(CSS_DIR, "autosave.min.css");

async function build() {
	const combined = jsSources.map((file) => fs.readFileSync(file, "utf8")).join("\n");
	fs.writeFileSync(jsOut, combined);

	const minified = await esbuild.transform(combined, { minify: true });
	fs.writeFileSync(jsMinOut, minified.code);

	await esbuild.build({
		entryPoints: [cssIn],
		outfile: cssMinOut,
		minify: true
	});

	console.log("Build complete.");
}

if (require.main === module) {
	build().catch((err) => {
		console.error(err);
		process.exit(1);
	});

	if (process.argv.includes("--watch")) {
		const watched = [...jsSources.filter((file) => file.startsWith(JS_DIR)), cssIn];
		let pending = false;
		const rebuild = () => {
			if (pending) return;
			pending = true;
			setTimeout(() => {
				pending = false;
				build().catch((err) => console.error(err));
			}, 100);
		};
		for (const file of watched) fs.watch(file, rebuild);
		console.log("Watching for changes...");
	}
}

module.exports = { build };
