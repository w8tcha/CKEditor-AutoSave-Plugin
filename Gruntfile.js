/**
 * Build process for CKEditor AutoSave Plugin
 * This file contributed by Timm Stokke <timm@stokke.me>
 *
 * Don't know where to start?
 * Try: http://24ways.org/2013/grunt-is-not-weird-and-hard/
 */
module.exports = function(grunt) {

  // CONFIGURATION
  grunt.initConfig({
      pkg: grunt.file.readJSON("package.json"),

      // Minimize JS
      uglify: {
          difflib: {
              options: {
                  sourceMap: false,
                  output: { beautify: true },
                  mangle: false,
                  compress: false
              },
              src: [
                  "autosave/js/difflib.js",
                  "autosave/js/diffview.js",
                  "autosave/js/jsdiff.js",
                  "node_modules/moment/min/moment-with-locales.js",
                  "node_modules/lz-string/libs/lz-string.js"
              ],
              dest: "autosave/js/extensions.js"
          },
          minify: {
              files: {
                  "autosave/js/extensions.min.js": "autosave/js/extensions.js"

              }
          }
      },

      // CSS Minify
      cssmin: {
          combine: {
              files: {
                  "autosave/css/autosave.min.css": "autosave/css/autosave.css",
              }
          }
      },
      devUpdate: {
            main: {
                options: {
                    reportUpdated: true,
					updateType: "force",
					semver: false
                }
            }
        }
  });

  // PLUGINS
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-contrib-cssmin");
  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("@w8tcha/grunt-dev-update");


  grunt.registerTask("watch",
      [
          "uglify",
          "cssmin"
      ]);

  grunt.registerTask("default", [
      "devUpdate",
	  "uglify",
      "cssmin"
    ]);

};
