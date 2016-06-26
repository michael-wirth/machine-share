#! /usr/bin/env node

console.log('exporting.');

var os = require('os');
var fs = require('fs');
var path = require('path');
var fse = require('fs.extra');
var zip = require('node-zip');
var util = require('./util');

var args = process.argv.slice(2);

var machine = args[0];
if (!machine) {
    console.log('machine-export <machine-name>');
    process.exit(1);
}

var tmp = path.resolve(os.tmpdir(), process.env.TEMP, machine);
fse.rmrfSync(tmp);

var home = os.homedir();
var configDir = path.resolve(home, '.docker/machine/machines', machine);

fse.copyRecursive(configDir, tmp, function(err) {
	if (err) {
		throw err;
	}
	
	processConfig();
	createZip();	
});

function processConfig() {
    var configName = path.resolve(tmp, 'config.json');
    var configFile = fs.readFileSync(configName);
    var config = JSON.parse(configFile.toString());
	var certsDir = path.resolve(home, '.docker/machine/certs');
	fse.mkdirp(path.resolve(tmp, 'certs'));

    util.recurseJson(config, function (parent, key, value) {
        if (typeof value === 'string') {
			var tempPath = path.normalize(value);
            if (tempPath.length > certsDir.length && util.startsWith(tempPath, certsDir)) {
				console.log(key, tempPath);
                var name = path.basename(tempPath);
                fse.copy(tempPath, path.resolve(tmp, 'certs', name));
                value = path.resolve(home, '.docker/machine/certs', machine, name);
            }
            value = value.replace(home, '{{HOME}}').replace(/\\/g, '/');
            parent[key] = value;
        }
    })

    fs.writeFileSync(configName, JSON.stringify(config))
}

function createZip() {
    var zip = new require('node-zip')()
    var walker = fse.walk(tmp)
    walker.on('file', function (root, stat, next) {
        var dir = path.resolve(root, stat.name)
        zip.folder(root.substring(tmp.length + 1)).file(stat.name, fs.readFileSync(dir).toString())
        next()
    });
    walker.on('end', function () {
        var data = zip.generate({base64: false, compression: 'DEFLATE'});
        fs.writeFileSync(machine + '.zip', data, 'binary')
        fse.rmrfSync(tmp)
    })
}
