
var im = require('imagemagick');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var match = /(.+?)20(\.png$|\.jpg$|\.gif$)/;

// resize image to .75, .5 ratio
function convert(directory) {
	
	if (directory.indexOf(',') >= 0) {
		directory = directory.split(',');
	} else {
		directory = [directory];
	}

	for (var i = 0; i < directory.length; i++) {
		var inputdir = directory[i];
		console.log('searching', inputdir);
		_convert(inputdir, 1.5);
		_convert(inputdir, 1.3);
		_convert(inputdir, 1);
	}
}

var queue = [];
var current = null;

// convert image with ratio
function _convert(inputdir, ratio) {
	// readdir
	var files = fs.readdirSync(inputdir);
	files.forEach(function(filename) {
		if (/^\./.test(filename)) {
			return;
		}
		// get stat of file
		var filepath = path.resolve(inputdir, filename);
		var outname = filename.replace('20', ratio*10);
		var outpath = path.resolve(inputdir, outname);
		var stat = fs.statSync(filepath);
		if (stat.isFile() && match.test(filename)) {
			// checking update
			var chkname = filename.replace('20', '10');
			var chkpath = path.resolve(inputdir, chkname);
			var chkstat = null;
			try {
				chkstat = fs.statSync(chkpath);
			} catch (e) {
			}
			if (chkstat === null || (chkstat && stat.mtime > chkstat.mtime)) {
				// convert image to smaller sizes
				console.log('queueing', filename, '->', outname, 'x'+ratio);
				queue.push({
					input: filepath,
					output: outpath,
					ratio: ratio
				});
				invoke();
			}
			return;
		} else if (stat.isDirectory()) {
			// recursive
			_convert(filepath, ratio);
		}
	});
}

function invoke() {
	if (!current && queue.length > 0) {
		current = queue.shift();
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
			var rwidth = Math.floor(width * ratio / 2);
			var rheight = Math.floor(height * ratio / 2);
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
				current = null;
				process.nextTick(invoke);
			});
		});
	}
}

exports.convert = convert;
