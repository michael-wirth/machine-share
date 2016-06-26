exports.startsWith = function (s, prefix) {
    return s.substring(0, prefix.length) === prefix;
}

exports.recurseJson = function (obj, func) {
    for (var key in obj) {
        var val = obj[key];
        func(obj, key, val);
        if (val !== null && typeof val === 'object') {
            exports.recurseJson(val, func);
        }
    }
}
