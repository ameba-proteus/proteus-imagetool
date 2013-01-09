
var im = require('imagemagick');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var match = /(.+?)20(\.png$|\.jpg$|\.gif$)/;

// resize image to .75, .5 ratio
function convert(directory) {

	var inputdir = directory;

	_convert(inputdir, 1.5);
	_convert(inputdir, 1.3);
	_convert(inputdir, 1);
}

var queue = [];
var current = null;

// convert image with ratio
function _convert(inputdir, ratio) {
	// readdir
	ratio = ratio / 2;
	var files = fs.readdirSync(inputdir);
	files.forEach(function(filename) {
		var m = match.exec(filename);
		if (m) {
			// get stat of file
			var filepath = path.resolve(inputdir, filename);
			var outname = filename.replace('20', ratio*20);
			var outpath = path.resolve(inputdir, outname);
			var stat = fs.statSync(filepath);
			if (stat.isFile() && match.test(filename)) {
				// convert image to smaller sizes
				console.log('queueing', filepath, '->', outpath, 'x'+ratio);
				queue.push({
					input: filepath,
					output: outpath,
					ratio: ratio
				});
				invoke();
			} else if (stat.isDirectory()) {
				// recursive
				convert(filepath, outpath);
			}
		}
	});
}

function invoke() {
	if (!current && queue.length > 0) {
		current = queue.shift();
		console.log('identifing', current.input);
		im.identify(['-format','%w,%h', current.input], function(err, wh) {
			if (err) {
				// print and return if error occured
				console.error(err.message);
				current = null;
				return invoke();
			}
			wh = wh.split(',');
			var ratio = current.ratio;
			var width = Number(wh[0]);
			var height = Number(wh[1]);
			var rwidth = Math.floor(width * ratio);
			var rheight = Math.floor(height * ratio);
			console.log('resizing',width+'x'+height,'to',rwidth+'x'+rheight);
			im.resize({
				srcPath: current.input,
				dstPath: current.output,
				width: rwidth,
				height: rheight,
				strip: true,
				sharpening: 0.2
			}, function(err, stdout, stderr) {
				if (err) {
					console.error(err.message);
				}
				console.log('done', current.output);
				current = null;
				process.nextTick(invoke);
			});
		});
	}
}

exports.convert = convert;
