#! /usr/bin/env node

console.log('importing.')

var os = require('os');
var fs = require('fs')
var fse = require('fs.extra')
var path = require('path')
var zip = require('node-zip')
var util = require('./util')

var args = process.argv.slice(2)
var machine = args[0]
if (!machine) {
    console.log('machine-import <config-zip>')
    process.exit(1)
}

var machine = path.basename(machine, '.zip');
var configDir = path.resolve(os.homedir(), '.docker/machine/machines', machine);
try {
    fs.statSync(configDir)
    console.log('that machine already exists')
    process.exit(1)
} catch (e) {
    //ok
}

var tmp = path.resolve(os.tmpdir(), machine);
fse.rmrfSync(tmp);
var certsDir = path.resolve(os.homedir(), '.docker/machine/certs', machine);
fse.rmrfSync(certsDir);

unzip();
processConfig();

fse.copyRecursive(path.resolve(tmp, 'certs'), certsDir, function(err) {
	if (err) {
		throw err;
	}
	fse.rmrfSync(path.resolve(tmp, 'certs'));

	fse.copyRecursive(tmp, configDir, function(err) {
		if (err) {
			throw err;
		}
		fse.rmrfSync(tmp);
	});
});

function unzip() {
    var zip = new require('node-zip')();
    zip.load(fs.readFileSync(machine + '.zip'));
    for (var f in zip.files) {
        var file = zip.files[f];
        if (!file.dir) {
            fse.mkdirp(path.dirname(path.resolve(tmp, file.name)));
            fs.writeFileSync(path.resolve(tmp, file.name), file.asNodeBuffer());
        }
    }
}

function processConfig() {
    var home = os.homedir();
    var configName = path.resolve(tmp, 'config.json');
    var configFile = fs.readFileSync(configName);
    var config = JSON.parse(configFile.toString())

    util.recurseJson(config, function (parent, key, value) {
        if (typeof value === 'string') {
			if (value.indexOf('{{HOME}}' > -1)) {
				parent[key] = path.normalize(value.replace('{{HOME}}', home));
			}
        }
    })

    var raw = config.RawDriver;
    if (raw) {
        var decoded = new Buffer(raw, 'base64').toString();
        var driver = JSON.parse(decoded);

        // update store path
        driver.StorePath = path.resolve(home, '.docker/machine');

        var updatedBlob = new Buffer(JSON.stringify(driver)).toString('base64');

        // update old config
        config.RawDriver = updatedBlob;
    }


    fs.writeFileSync(configName, JSON.stringify(config));
}
