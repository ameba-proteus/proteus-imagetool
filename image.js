#!/usr/bin/env node

var fs = require('fs');
var program = require('commander');
program.version('0.0.1')
	.option('-d,--directory [directory]', 'Root directory')
	.option('--resize', 'Batch for resizing image to variour pixel-ratio.')
	.parse(process.argv);

fs.stat(program.directory, function(err) {

	if (err) {
		console.error(err.message);
		return;
	}
	if (program.resize) {
		console.log('resizing images');
		require('./lib/resize').convert(program.directory);
	}
});

