#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var program = require('commander');
program.version('0.0.1')
	.option('-d,--directory [directory]', 'Root directory')
	.option('--retina', 'Batch make image from retina size image.')
	.parse(process.argv);
	
fs.stat(program.directory, function(err, stat) {
	if (err) {
		console.error(err.message);
		return;
	}
	if (program.retina) {
		console.log('converting retina images');
		require('./lib/retina').convert(program.directory);
	}
});

