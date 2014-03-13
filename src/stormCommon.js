'use strict';
var isDefined = angular.isDefined,
    encodeURIComponent = window.encodeURIComponent,
    isDate = angular.isDate,
    toJson = angular.toJson,
    isUndefined = angular.isUndefined,
    isNull = function (arg) {
        return arg === null;
    },
    isNumber = angular.isNumber,
    isFunction = angular.isFunction,
    isString = angular.isString,
    isObject = angular.isObject,
    isEmpty = function (data) {
        if (isDate(data))
            return !isNaN(Date.parse(data));
        if (isArray(data)) {
            return data.length > 0;
        } else if (isObject(data)) {
            for (var p in data) {
                if (hasOwnProperty.call(data, p)) {
                    return true;
                }
            }
        }
        return false;
    },
    noop = angular.noop,
    deepCopy = angular.copy,
    isArray = angular.isArray,
    /**
     * Native Methods...
     * @type {Object|Function|Array}
     */
        arrayProto = Array.prototype,
    arrayForEach = arrayProto.forEach,
    nativeFilter = arrayProto.filter,
    slice = arrayProto.slice,
    concat = arrayProto.concat,
    defineProperty = Object.defineProperty,
    hasOwnProperty = Object.prototype.hasOwnProperty,

    /**
     * Enumerations
     * @type {number}
     */
//Typ constructor indicies
        CONSTRUCTOR = 0,
    DESTRUCTOR = 1,
    WIP = 2,
//PreProcessed property descriptor indicies
    NAME = 0,
    TYPE = 1,
    ATTR = 2,
//Type enumerations
    tScalar = 0,
    tCollection = 1,
    tArray = 2,
    tForeignKey = 3,
    tForeignKeys = 4,
    tEntity = 5,
//State enumerators
    sAdded = 0,
    sUnchanged = 1,
    sDeleted = 3,
    sDirty = 4,
    sWip = 5,
    sUnknown = 6,
//for exposing
    state = {
        added: sAdded, unchanged: sUnchanged, deleted: sDeleted,
        dirty: sDirty, wip: sWip, unknown: sUnknown
    },
//todo its probably bad that I strain the http config...
    httpConfigKeys = {
        method: null,
        url: null,
        params: null,
        data: null,
        headers: null,
        xsrfHeaderName: null,
        xsrfCookieName: null,
        transformResponse: null,
        cache: null,
        timeout: null,
        withCredentials: null,
        responseType: null,
        returnType: null
    };


function forEach(data, itr, ctx) {
    if (!data) return;
    if (arrayForEach && data.forEach === arrayForEach) data.forEach(itr, ctx);
    else if (data.length === +data.length)
        for (var i = 0, ii = data.length; i < ii; i++) {
            itr.call(ctx, data[i], i);
        }
    else
        for (var key in data) {
            if (hasOwnProperty.call(data, key))
                itr.call(ctx, data[key], key);
        }
}
/**
 * Basic object extend/mixin
 * @param dst
 * @returns {*}
 */
function extend(dst) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
        forEach(arguments[i], itr);
    }
    function itr(value, key) {
        dst[key] = value;
    }

    return dst;
}

/**
 * Returns new object with all properties present in sources that exist on the strainer
 *
 * @param strainer
 * @returns {*}
 */
function strain(strainer) {
    var ret = {};
    for (var i = 1, ii = arguments.length; i < ii; i++) {
        forEach(arguments[i], itrStrain);
    }
    function itrStrain(value, key) {
        if (hasOwnProperty.call(strainer, key))
            ret[key] = value;
    }

    return ret;
}
/**
 * Extend, but don't overwrite destination properties.
 * @param dst
 * @returns {*}
 */
function merge(dst) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
        forEach(arguments[i], mergeIn);
    }
    function mergeIn(value, key) {
        if (!hasOwnProperty.call(dst, key))
            dst[key] = value;
    }

    return dst;
}

//The following 4 methods are unexposed methods from angular.js source code....
function sortedKeys(obj) {
    var keys = [];
    if (Object.keys) return Object.keys(obj).sort();
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys.sort();
}

function forEachSorted(obj, iterator, context) {
    var keys = sortedKeys(obj);
    for (var i = 0; i < keys.length; i++) {
        iterator.call(context, obj[keys[i]], keys[i]);
    }
    return keys;
}

//dervied from https://gist.github.com/kurtmilam/1868955
function deepExtend(dst) {
    var parentRE = /#{\s*?_\s*?}/;

    function rejectFilter(item) {
        return isNull(item);
    }

    forEach(slice.call(arguments, 1), function (source) {
        for (var prop in source) {
            if (hasOwnProperty.call(source, prop)) {
                //added this
                if (isArray(dst) && isArray(source)) {
                    dst = dst.concat(source);
                } else if (isUndefined(dst[prop]) || isFunction(dst[prop]) || isNull(source[prop])) {
                    dst[prop] = source[prop];
                }
                else if (isString(source[prop]) && parentRE.test(source[prop])) {
                    if (isString(obj[prop])) {
                        dst[prop] = source[prop].replace(parentRE, dst[prop]);
                    }
                }
                else if (isArray(dst[prop]) || isArray(source[prop])) {
                    if (!isArray(dst[prop]) || !isArray(source[prop])) {
                        throw 'Error: Trying to combine an array with a non-array (' + prop + ')';
                    } else {
                        dst[prop] = reject(deepExtend(dst[prop], source[prop]), rejectFilter);
                    }
                }
                else if (isObject(dst[prop]) || isObject(source[prop])) {
                    if (!isObject(dst[prop]) || !isObject(source[prop])) {
                        throw 'Error: Trying to combine an object with a non-object (' + prop + ')';
                    } else {
                        dst[prop] = deepExtend(dst[prop], source[prop]);
                    }
                } else {
                    dst[prop] = source[prop];
                }
            }
        }
    });
    return dst;
}

function reject(obj, iterator, context) {
    return filter(obj, function (value, index, list) {
        return !iterator.call(context, value, index, list);
    }, context);
}

function filter(obj, iterator, context) {
    var results = [];
    if (obj === null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    forEach(obj, function (value, index, list) {
        if (iterator.call(context, value, index, list)) results.push(value);
    });
    return results;
}

/****************************************************
 * String helpers
 *****************************************/
function pluralize(word) {
    var CONSONANTS = "bcdfghjklmnpqrstvwxz";
    var arg = word.toString();
    // Handle ending with "o" (if preceeded by a consonant, end with -es, otherwise -s: Potatoes and Radios)
    if (endsWith(arg, "o") && CONSONANTS.contains(arg[arg.length - 2])) {
        return arg + "es";
    }
    // Handle ending with "y" (if preceeded by a consonant, end with -ies, otherwise -s: Companies and Trays)
    if (endsWith(arg, "y") && CONSONANTS.contains(arg[arg.length - 2])) {
        return arg.substring(0, arg.length - 1) + "ies";
    }
    // Ends with a whistling sound: boxes, buzzes, churches, passes
    if (endsWith(arg, "s") || endsWith(arg, "sh") || endsWith(arg, "ch") || endsWith(arg, "x") || endsWith(arg, "z")) {
        return arg + "es";
    }
    return arg + "s";
}

function depluralize(word) {
    if (endsWith(word, 'ies')) return slice.call(word, 0, -3).join('') + 'y';
    if (endsWith(word, 'ses')) return slice.call(word, 0, -2).join('');
    if (endsWith(word, 's')) return slice.call(word, 0, -1).join('');
    return word;
}

function endsWith(arg, suffix) {
    return arg.indexOf(suffix, arg.length - suffix.length) !== -1;
}

function contains(arg, test, lower) {
    return lower ? ~arg.toLowerCase().indexOf(test.toLowerCase()) : ~arg.indexOf(test);
}


/****************************************************
 * Url helpers
 *****************************************/
function buildUrl(url, params) {
    if (!params) return url;
    var parts = [];
    forEachSorted(params, function (value, key) {
        if (value === null || isUndefined(value)) return;
        if (!isArray(value)) value = [value];

        forEach(value, function (v) {
            if (isObject(v)) {
                v = toJson(v);
            }
            parts.push(encodeUriQuery(key) + '=' +
                encodeUriQuery(v));
        });
    });
    return url + ((url.indexOf('?') == -1) ? '?' : '&') + parts.join('&');
}

function encodeUriQuery(val, pctEncodeSpaces) {
    return encodeURIComponent(val).
        replace(/%40/gi, '@').
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
}


/**
 * From uuid.js -- https://github.com/broofa/node-uuid
 *    Copyright (c) 2010-2012 Robert Kieffer
 *    MIT License - http://opensource.org/licenses/mit-license.php
 */
var rng,
    uuidEx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    bth = [];
for (var i = 0; i < 256; i++) {
    bth[i] = (i + 0x100).toString(16).substr(1);
}
if (window.crypto && window.crypto.getRandomValues) {
    var rnds8 = new Uint8Array(16);
    rng = function () {
        window.crypto.getRandomValues(rnds8);
        return rnds8;
    };
}
if (!rng) {
    var rnds = new Array(16);
    rng = function () {
        for (var i = 0, r; i < 16; i++) {
            if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
            rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
        }
        return rnds;
    };
}
function uuid() {
    var rnds = rng(), i = 0;
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    return bth[rnds[i++]] + bth[rnds[i++]] +
        bth[rnds[i++]] + bth[rnds[i++]] + '-' +
        bth[rnds[i++]] + bth[rnds[i++]] + '-' +
        bth[rnds[i++]] + bth[rnds[i++]] + '-' +
        bth[rnds[i++]] + bth[rnds[i++]] + '-' +
        bth[rnds[i++]] + bth[rnds[i++]] +
        bth[rnds[i++]] + bth[rnds[i++]] +
        bth[rnds[i++]] + bth[rnds[i++]];
}

//Module Declaration
angular.module('storm.util', ['ng']).constant('linq', from);
angular.module('storm', ['storm.util'])
    .run(['storm', function (storm) {
        //todo change to noop
        //todo HACK
        window.storm = storm;
    }]);

//setup filters...
var stormFilterProvider = angular.module('storm.util').filter;
'toArray toDictionary where any aggregate all average at contains count distinct except some take sum skip select selectMany min max last'.split(' ')
    .forEach(closeFilters);
function closeFilters(name, alias) {
    stormFilterProvider(isString(alias) ? alias : name, function () {
        return function (o, clause) {
            if (o && isFunction(o[name]))
                return o[name](clause);
            return o;
        };
    });
}
closeFilters('toArray','array');
closeFilters('toDictionary','hash');

