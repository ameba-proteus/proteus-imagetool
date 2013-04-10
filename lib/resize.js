

var im = require('imagemagick');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async');
var os = require('os');
var spawn = require('child_process').spawn;
var color = require('cli-color');

var match = /(.+)(\.png$|\.jpg$|\.gif$)/;
var direct1 = /.+_[1-9][0-9](\.png$|\.jpg$|\.gif$)/;
var direct2 = /^[1-9][0-9](\.png$|\.jpg$|\.gif$)/;

var converts, outs;
var ratios = [3.0, 2.0, 1.5, 1.3, 1.0];

// resize image to .75, .5 ratio
function convert(inputdir, outputdir) {

	console.log(
		color.green('converting'),
		color.cyan(inputdir),
		color.magenta('>'),
		color.yellow(outputdir));

	converts = [];
	outs = [];

	// queue resize tasks
	_convert(inputdir, outputdir);

	// concurrency
	var concurrency = os.cpus().length;

	// resize parallel
	async.parallelLimit(converts, concurrency, function(err) {

		if (err) {
			console.error(err.stack);
			process.exit(1);
			return;
		}

		console.log('start optimizing', color.magenta(outs.length), 'files');
		var optimizes = [];
		outs.forEach(function(outpath) {
			optimizes.push(optimize(outpath));
		});

		function optimize(outpath) {
			return function(done) {
				var pathname = outpath.substring(__dirname.length);
				if (match.test(outpath)) {
					var outstat = stat(outpath);
					var sizeBefore = outstat.size;
					var cmd = spawn('image_optim', [outpath]);
					cmd.on('exit', function(code) {
						if (code === 0) {
							outstat = stat(outpath);
							var sizeAfter = outstat.size;

							var percent = Math.round(((sizeBefore - sizeAfter) / sizeBefore) * 10000) / 100 + '%';

							console.log(
								color.green('optimized'),
								color.cyan(pathname),
								color.yellow(sizeBefore),
								color.magenta('>'),
								color.yellow(sizeAfter),
								color.magenta('('+percent+')')
							);
						} else {
							console.error(
								color.red('ERROR'),
								"cannot be optimized"
							);
						}
						done();
					});
				} else {
					done();
				}
			};
		}

		async.parallelLimit(optimizes, concurrency, function(err) {
			if (err) {
				console.error(color.red(err.stack || err.message));
			} else {
				console.log(color.bold("done"));
			}
		});
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
	console.log(
		color.green('copy'),
		color.cyan(inpath.substring(__dirname.length))
	);
	// copy file
	var instream  = fs.createReadStream(inpath);
	var outstream = fs.createWriteStream(outpath);

	instream.on('error', callback);
	outstream.on('error', callback);
	outstream.on('close', function() {
		outs.push(outpath);
		callback();
	});
	instream.pipe(outstream);
}

// convert image with ratio
function _convert(inputdir, outputdir) {

	// readdir
	fs.readdirSync(inputdir).forEach(function(filename) {

		if (/^\./.test(filename)) {
			return;
		}

		// get stat of file
		var inpath  = path.resolve(inputdir , filename);
		var instat  = stat(inpath);
		var outname, outpath, outstat, outs= [];

		if (instat === null) {
			return;

		} else if (instat.isFile()) {

			if (direct1.test(filename) || direct2.test(filename)) {

				outname = filename;
				outpath = path.resolve(outputdir, outname);
				outstat = stat(outpath);

				if (outstat && outstat.mtime > instat.mtime) {
					// skip non update file
					return;
				}

				converts.push(function(callback) {
					copy(inpath, outpath, callback);
				});

			} else if (match.test(filename)) {

				var matchname = RegExp.$1;
				var matchext  = RegExp.$2;

				var resize = function(inpath, instat, ratio) {

					return function(callback) {

						// resolve output path
						var outname = matchname + '_' + (ratio*10) + matchext;
						var outpath = path.resolve(outputdir, outname);
						var outstat = stat(outpath);

						// copy to output path
						if (outstat && outstat.mtime > instat.mtime) {
							// skip non-update time
							callback();
							return;
						}

						if (ratio === 3) {
							// direct copy if ratio = 3.0
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
							var rwidth = Math.ceil(width * ratio / 3);
							var rheight = Math.ceil(height * ratio / 3);

							console.log(
								color.green('resizing'),
								color.magenta(ratio*10),
								color.cyan(filename),
								color.yellow(width+'x'+height),
								color.magenta('>'),
								color.yellow(rwidth+'x'+rheight)
							);

							outs.push(outpath);
							im.resize({
								srcPath: inpath,
								dstPath: outpath,
								width: rwidth,
								height: rheight,
								strip: true,
								sharpening: 0.3
							}, callback);
						});
					};
				};

				for (var i = 0; i < ratios.length; i++) {
					converts.push(resize(inpath, instat, ratios[i]));
				}

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
					copy(inpath, outpath, callback);
				});

			}

		} else if (instat.isDirectory()) {
			// recursive
			outpath = path.resolve(outputdir, filename);
			outstat = stat(outpath);
			if (!outstat) {
				console.log(
					color.green('mkdir'),
					color.cyan(outpath.substring(__dirname.length))
				);
				mkdirp.sync(outpath);
				outstat = stat(outpath);
				_convert(inpath, outpath);
			} else {
				_convert(inpath, outpath);
			}
		}
	});
}

exports.convert = convert;
