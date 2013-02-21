

var im = require('imagemagick');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async');
var os = require('os');
var spawn = require('child_process').spawn;

var match = /(.+)(\.png$|\.jpg$|\.gif$)/;
var direct = /.+_[12][0-9](\.png$|\.jpg$|\.gif$)/;

var converts = [];

// resize image to .75, .5 ratio
function convert(inputdir, outputdir) {

	console.log('converting', inputdir, '>', outputdir);
	// queue tasks
	_convert(inputdir, outputdir, 2.0);
	_convert(inputdir, outputdir, 1.5);
	_convert(inputdir, outputdir, 1.3);
	_convert(inputdir, outputdir, 1.0);

	// concurrency
	var concurrency = os.cpus().length;

	// go execute
	async.parallelLimit(converts, concurrency, function(err) {
		if (err) {
			console.error(err.stack);
			process.exit(1);
			return;
		}
		console.log("done");
	});
}


function stat(path) {
	try {
		return fs.statSync(path);
	} catch (e) {
		if (e.code === 'ENOENT') {
			return null;
		} else {
			throw e;
		}
	}
}

function copy(inpath, outpath, callback) {
	// copy file
	var instream  = fs.createReadStream(inpath);
	var outstream = fs.createWriteStream(outpath);

	instream.on('error', callback);
	outstream.on('error', callback);
	outstream.on('close', function() {
		callback();
	});
	instream.pipe(outstream);
}

// convert image with ratio
function _convert(inputdir, outputdir, ratio) {

	// readdir
	fs.readdirSync(inputdir).forEach(function(filename) {

		if (/^\./.test(filename)) {
			return;
		}

		// get stat of file
		var inpath  = path.resolve(inputdir , filename);
		var instat  = stat(inpath);
		var outname, outpath, outstat;

		if (instat === null) {
			return;

		} else if (instat.isFile()) {

			if (direct.test(filename)) {

				outname = filename;
				outpath = path.resolve(outputdir, outname);
				outstat = stat(outpath);

				if (outstat && outstat.mtime > instat.mtime) {
					// skip non update file
					return;
				}

				converts.push(function(callback) {
					console.log('copy',inpath,'>',outpath);
					copy(inpath, outpath, callback);
				});

			} else if (match.test(filename)) {

				// resolve output path
				outname = RegExp.$1 + '_' + (ratio*10) + RegExp.$2;
				outpath = path.resolve(outputdir, outname);
				outstat = stat(outpath);

				// copy to output path
				if (outstat && outstat.mtime > instat.mtime) {
					// skip non-update time
					return;
				}

				converts.push(function(callback) {
					function resize(callback) {
						if (ratio*10 === 20) {
							// direct copy if ratio = 2.0
							copy(inpath, outpath, callback);
							return;
						}
						im.identify(['-format','%w,%h', inpath], function(err, wh) {
							if (err) {
								return callback(err);
							}
							wh = wh.split(',');
							var width = Number(wh[0]);
							var height = Number(wh[1]);
							var rwidth = Math.floor(width * ratio / 2);
							var rheight = Math.floor(height * ratio / 2);
							console.log('resizing', filename, width+'x'+height,'>',rwidth+'x'+rheight);
							im.resize({
								srcPath: inpath,
								dstPath: outpath,
								width: rwidth,
								height: rheight,
								strip: true,
								sharpening: 0.3
							}, function(err) {
								callback(err);
							});
						});
					}
					function optipng(callback) {
						var outstat = stat(outpath);
						var size1 = outstat.size;
						// optipng
						var cmd = spawn('optipng', [outpath]);
						cmd.stdout.setEncoding('utf8');
						cmd.stderr.setEncoding('utf8');
						cmd.stdout.on('data', function() {
							// console.log(data);
						});
						cmd.stderr.on('data', function() {
							// console.error(data);
						});
						cmd.on('exit', function(code) {
							if (code === 0) {
								var outstat2 = stat(outpath);
								var size2 = outstat2.size;
								var perc = Math.floor(((size1-size2)/size1)*1000)/10;
								console.log('optimized', outname, size1, '>', size2, '('+perc + '%)');
								callback();
							} else {
								callback(new Error('optipng exist abnormally'));
							}
						});
					}
					async.series([resize, optipng], callback);
				});

			} else {

				// direct copy with unmatched files
				outname = filename;
				outpath = path.resolve(outputdir, outname);
				outstat = stat(outpath);

				if (outstat && outstat.mtime > instat.mtime) {
					// skip non update file
					return;
				}

				converts.push(function(callback) {
					console.log('copy',inpath,'>',outpath);
					copy(inpath, outpath, callback);
				});

			}

		} else if (instat.isDirectory()) {
			// recursive
			outpath = path.resolve(outputdir, filename);
			outstat = stat(outpath);
			if (outstat === null) {
				console.log('mkdir', outpath);
				mkdirp(outpath, function(e) {
					if (e) {
						console.error(e.stack);
						return;
					}
					_convert(inpath, outpath, ratio);
				});
			} else {
				_convert(inpath, outpath, ratio);
			}
		}
	});
}

exports.convert = convert;
