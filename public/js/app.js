(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Browser Request
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// UMD HEADER START 
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.returnExports = factory();
  }
}(this, function () {
// UMD HEADER END

var XHR = XMLHttpRequest
if (!XHR) throw new Error('missing XMLHttpRequest')
request.log = {
  'trace': noop, 'debug': noop, 'info': noop, 'warn': noop, 'error': noop
}

var DEFAULT_TIMEOUT = 3 * 60 * 1000 // 3 minutes

//
// request
//

function request(options, callback) {
  // The entry-point to the API: prep the options object and pass the real work to run_xhr.
  if(typeof callback !== 'function')
    throw new Error('Bad callback given: ' + callback)

  if(!options)
    throw new Error('No options given')

  var options_onResponse = options.onResponse; // Save this for later.

  if(typeof options === 'string')
    options = {'uri':options};
  else
    options = JSON.parse(JSON.stringify(options)); // Use a duplicate for mutating.

  options.onResponse = options_onResponse // And put it back.

  if (options.verbose) request.log = getLogger();

  if(options.url) {
    options.uri = options.url;
    delete options.url;
  }

  if(!options.uri && options.uri !== "")
    throw new Error("options.uri is a required argument");

  if(typeof options.uri != "string")
    throw new Error("options.uri must be a string");

  var unsupported_options = ['proxy', '_redirectsFollowed', 'maxRedirects', 'followRedirect']
  for (var i = 0; i < unsupported_options.length; i++)
    if(options[ unsupported_options[i] ])
      throw new Error("options." + unsupported_options[i] + " is not supported")

  options.callback = callback
  options.method = options.method || 'GET';
  options.headers = options.headers || {};
  options.body    = options.body || null
  options.timeout = options.timeout || request.DEFAULT_TIMEOUT

  if(options.headers.host)
    throw new Error("Options.headers.host is not supported");

  if(options.json) {
    options.headers.accept = options.headers.accept || 'application/json'
    if(options.method !== 'GET')
      options.headers['content-type'] = 'application/json'

    if(typeof options.json !== 'boolean')
      options.body = JSON.stringify(options.json)
    else if(typeof options.body !== 'string')
      options.body = JSON.stringify(options.body)
  }
  
  //BEGIN QS Hack
  var serialize = function(obj) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    return str.join("&");
  }
  
  if(options.qs){
    var qs = (typeof options.qs == 'string')? options.qs : serialize(options.qs);
    if(options.uri.indexOf('?') !== -1){ //no get params
        options.uri = options.uri+'&'+qs;
    }else{ //existing get params
        options.uri = options.uri+'?'+qs;
    }
  }
  //END QS Hack
  
  //BEGIN FORM Hack
  var multipart = function(obj) {
    //todo: support file type (useful?)
    var result = {};
    result.boundry = '-------------------------------'+Math.floor(Math.random()*1000000000);
    var lines = [];
    for(var p in obj){
        if (obj.hasOwnProperty(p)) {
            lines.push(
                '--'+result.boundry+"\n"+
                'Content-Disposition: form-data; name="'+p+'"'+"\n"+
                "\n"+
                obj[p]+"\n"
            );
        }
    }
    lines.push( '--'+result.boundry+'--' );
    result.body = lines.join('');
    result.length = result.body.length;
    result.type = 'multipart/form-data; boundary='+result.boundry;
    return result;
  }
  
  if(options.form){
    if(typeof options.form == 'string') throw('form name unsupported');
    if(options.method === 'POST'){
        var encoding = (options.encoding || 'application/x-www-form-urlencoded').toLowerCase();
        options.headers['content-type'] = encoding;
        switch(encoding){
            case 'application/x-www-form-urlencoded':
                options.body = serialize(options.form).replace(/%20/g, "+");
                break;
            case 'multipart/form-data':
                var multi = multipart(options.form);
                //options.headers['content-length'] = multi.length;
                options.body = multi.body;
                options.headers['content-type'] = multi.type;
                break;
            default : throw new Error('unsupported encoding:'+encoding);
        }
    }
  }
  //END FORM Hack

  // If onResponse is boolean true, call back immediately when the response is known,
  // not when the full request is complete.
  options.onResponse = options.onResponse || noop
  if(options.onResponse === true) {
    options.onResponse = callback
    options.callback = noop
  }

  // XXX Browsers do not like this.
  //if(options.body)
  //  options.headers['content-length'] = options.body.length;

  // HTTP basic authentication
  if(!options.headers.authorization && options.auth)
    options.headers.authorization = 'Basic ' + b64_enc(options.auth.username + ':' + options.auth.password);

  return run_xhr(options)
}

var req_seq = 0
function run_xhr(options) {
  var xhr = new XHR
    , timed_out = false
    , is_cors = is_crossDomain(options.uri)
    , supports_cors = ('withCredentials' in xhr)

  req_seq += 1
  xhr.seq_id = req_seq
  xhr.id = req_seq + ': ' + options.method + ' ' + options.uri
  xhr._id = xhr.id // I know I will type "_id" from habit all the time.

  if(is_cors && !supports_cors) {
    var cors_err = new Error('Browser does not support cross-origin request: ' + options.uri)
    cors_err.cors = 'unsupported'
    return options.callback(cors_err, xhr)
  }

  xhr.timeoutTimer = setTimeout(too_late, options.timeout)
  function too_late() {
    timed_out = true
    var er = new Error('ETIMEDOUT')
    er.code = 'ETIMEDOUT'
    er.duration = options.timeout

    request.log.error('Timeout', { 'id':xhr._id, 'milliseconds':options.timeout })
    return options.callback(er, xhr)
  }

  // Some states can be skipped over, so remember what is still incomplete.
  var did = {'response':false, 'loading':false, 'end':false}

  xhr.onreadystatechange = on_state_change
  xhr.open(options.method, options.uri, true) // asynchronous
  if(is_cors)
    xhr.withCredentials = !! options.withCredentials
  xhr.send(options.body)
  return xhr

  function on_state_change(event) {
    if(timed_out)
      return request.log.debug('Ignoring timed out state change', {'state':xhr.readyState, 'id':xhr.id})

    request.log.debug('State change', {'state':xhr.readyState, 'id':xhr.id, 'timed_out':timed_out})

    if(xhr.readyState === XHR.OPENED) {
      request.log.debug('Request started', {'id':xhr.id})
      for (var key in options.headers)
        xhr.setRequestHeader(key, options.headers[key])
    }

    else if(xhr.readyState === XHR.HEADERS_RECEIVED)
      on_response()

    else if(xhr.readyState === XHR.LOADING) {
      on_response()
      on_loading()
    }

    else if(xhr.readyState === XHR.DONE) {
      on_response()
      on_loading()
      on_end()
    }
  }

  function on_response() {
    if(did.response)
      return

    did.response = true
    request.log.debug('Got response', {'id':xhr.id, 'status':xhr.status})
    clearTimeout(xhr.timeoutTimer)
    xhr.statusCode = xhr.status // Node request compatibility

    // Detect failed CORS requests.
    if(is_cors && xhr.statusCode == 0) {
      var cors_err = new Error('CORS request rejected: ' + options.uri)
      cors_err.cors = 'rejected'

      // Do not process this request further.
      did.loading = true
      did.end = true

      return options.callback(cors_err, xhr)
    }

    options.onResponse(null, xhr)
  }

  function on_loading() {
    if(did.loading)
      return

    did.loading = true
    request.log.debug('Response body loading', {'id':xhr.id})
    // TODO: Maybe simulate "data" events by watching xhr.responseText
  }

  function on_end() {
    if(did.end)
      return

    did.end = true
    request.log.debug('Request done', {'id':xhr.id})

    xhr.body = xhr.responseText
    if(options.json) {
      try        { xhr.body = JSON.parse(xhr.responseText) }
      catch (er) { return options.callback(er, xhr)        }
    }

    options.callback(null, xhr, xhr.body)
  }

} // request

request.withCredentials = false;
request.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;

//
// defaults
//

request.defaults = function(options, requester) {
  var def = function (method) {
    var d = function (params, callback) {
      if(typeof params === 'string')
        params = {'uri': params};
      else {
        params = JSON.parse(JSON.stringify(params));
      }
      for (var i in options) {
        if (params[i] === undefined) params[i] = options[i]
      }
      return method(params, callback)
    }
    return d
  }
  var de = def(request)
  de.get = def(request.get)
  de.post = def(request.post)
  de.put = def(request.put)
  de.head = def(request.head)
  return de
}

//
// HTTP method shortcuts
//

var shortcuts = [ 'get', 'put', 'post', 'head' ];
shortcuts.forEach(function(shortcut) {
  var method = shortcut.toUpperCase();
  var func   = shortcut.toLowerCase();

  request[func] = function(opts) {
    if(typeof opts === 'string')
      opts = {'method':method, 'uri':opts};
    else {
      opts = JSON.parse(JSON.stringify(opts));
      opts.method = method;
    }

    var args = [opts].concat(Array.prototype.slice.apply(arguments, [1]));
    return request.apply(this, args);
  }
})

//
// CouchDB shortcut
//

request.couch = function(options, callback) {
  if(typeof options === 'string')
    options = {'uri':options}

  // Just use the request API to do JSON.
  options.json = true
  if(options.body)
    options.json = options.body
  delete options.body

  callback = callback || noop

  var xhr = request(options, couch_handler)
  return xhr

  function couch_handler(er, resp, body) {
    if(er)
      return callback(er, resp, body)

    if((resp.statusCode < 200 || resp.statusCode > 299) && body.error) {
      // The body is a Couch JSON object indicating the error.
      er = new Error('CouchDB error: ' + (body.error.reason || body.error.error))
      for (var key in body)
        er[key] = body[key]
      return callback(er, resp, body);
    }

    return callback(er, resp, body);
  }
}

//
// Utility
//

function noop() {}

function getLogger() {
  var logger = {}
    , levels = ['trace', 'debug', 'info', 'warn', 'error']
    , level, i

  for(i = 0; i < levels.length; i++) {
    level = levels[i]

    logger[level] = noop
    if(typeof console !== 'undefined' && console && console[level])
      logger[level] = formatted(console, level)
  }

  return logger
}

function formatted(obj, method) {
  return formatted_logger

  function formatted_logger(str, context) {
    if(typeof context === 'object')
      str += ' ' + JSON.stringify(context)

    return obj[method].call(obj, str)
  }
}

// Return whether a URL is a cross-domain request.
function is_crossDomain(url) {
  var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/

  // jQuery #8138, IE may throw an exception when accessing
  // a field from window.location if document.domain has been set
  var ajaxLocation
  try { ajaxLocation = location.href }
  catch (e) {
    // Use the href attribute of an A element since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
  }

  var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
    , parts = rurl.exec(url.toLowerCase() )

  var result = !!(
    parts &&
    (  parts[1] != ajaxLocParts[1]
    || parts[2] != ajaxLocParts[2]
    || (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? 80 : 443))
    )
  )

  //console.debug('is_crossDomain('+url+') -> ' + result)
  return result
}

// MIT License from http://phpjs.org/functions/base64_encode:358
function b64_enc (data) {
    // Encodes string using MIME base64 algorithm
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

    if (!data) {
        return data;
    }

    // assume utf8 data
    // data = this.utf8_encode(data+'');

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
        break;
        case 2:
            enc = enc.slice(0, -1) + '=';
        break;
    }

    return enc;
}
    return request;
//UMD FOOTER START
}));
//UMD FOOTER END

},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (process){
/* @flow */
/*::

type DotenvParseOptions = {
  debug?: boolean
}

// keys and values from src
type DotenvParseOutput = { [string]: string }

type DotenvConfigOptions = {
  path?: string, // path to .env file
  encoding?: string, // encoding of .env file
  debug?: string // turn on logging for debugging purposes
}

type DotenvConfigOutput = {
  parsed?: DotenvParseOutput,
  error?: Error
}

*/

const fs = require('fs')
const path = require('path')

function log (message /*: string */) {
  console.log(`[dotenv][DEBUG] ${message}`)
}

const NEWLINE = '\n'
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/
const RE_NEWLINES = /\\n/g
const NEWLINES_MATCH = /\n|\r|\r\n/

// Parses src into an Object
function parse (src /*: string | Buffer */, options /*: ?DotenvParseOptions */) /*: DotenvParseOutput */ {
  const debug = Boolean(options && options.debug)
  const obj = {}

  // convert Buffers before splitting into lines and processing
  src.toString().split(NEWLINES_MATCH).forEach(function (line, idx) {
    // matching "KEY' and 'VAL' in 'KEY=VAL'
    const keyValueArr = line.match(RE_INI_KEY_VAL)
    // matched?
    if (keyValueArr != null) {
      const key = keyValueArr[1]
      // default undefined or missing values to empty string
      let val = (keyValueArr[2] || '')
      const end = val.length - 1
      const isDoubleQuoted = val[0] === '"' && val[end] === '"'
      const isSingleQuoted = val[0] === "'" && val[end] === "'"

      // if single or double quoted, remove quotes
      if (isSingleQuoted || isDoubleQuoted) {
        val = val.substring(1, end)

        // if double quoted, expand newlines
        if (isDoubleQuoted) {
          val = val.replace(RE_NEWLINES, NEWLINE)
        }
      } else {
        // remove surrounding whitespace
        val = val.trim()
      }

      obj[key] = val
    } else if (debug) {
      log(`did not match key and value when parsing line ${idx + 1}: ${line}`)
    }
  })

  return obj
}

// Populates process.env from .env file
function config (options /*: ?DotenvConfigOptions */) /*: DotenvConfigOutput */ {
  let dotenvPath = path.resolve(process.cwd(), '.env')
  let encoding /*: string */ = 'utf8'
  let debug = false

  if (options) {
    if (options.path != null) {
      dotenvPath = options.path
    }
    if (options.encoding != null) {
      encoding = options.encoding
    }
    if (options.debug != null) {
      debug = true
    }
  }

  try {
    // specifying an encoding returns a string instead of a buffer
    const parsed = parse(fs.readFileSync(dotenvPath, { encoding }), { debug })

    Object.keys(parsed).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = parsed[key]
      } else if (debug) {
        log(`"${key}" is already defined in \`process.env\` and will not be overwritten`)
      }
    })

    return { parsed }
  } catch (e) {
    return { error: e }
  }
}

module.exports.config = config
module.exports.parse = parse

}).call(this,require('_process'))
},{"_process":5,"fs":2,"path":4}],4:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":5}],5:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;
module.exports.TinyEmitter = E;

},{}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _signin = require('./components/signin');

var _signin2 = _interopRequireDefault(_signin);

var _signup = require('./components/signup');

var _signup2 = _interopRequireDefault(_signup);

var _tasks = require('./components/tasks');

var _tasks2 = _interopRequireDefault(_tasks);

var _taskForm = require('./components/taskForm');

var _taskForm2 = _interopRequireDefault(_taskForm);

var _user = require('./components/user');

var _user2 = _interopRequireDefault(_user);

var _menu = require('./components/menu');

var _menu2 = _interopRequireDefault(_menu);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var App = function () {
  function App(body, footer) {
    _classCallCheck(this, App);

    this.signin = new _signin2.default(body);
    this.signup = new _signup2.default(body);
    this.tasks = new _tasks2.default(body);
    this.taskForm = new _taskForm2.default(body);
    this.user = new _user2.default(body);
    this.menu = new _menu2.default(footer);
  }

  _createClass(App, [{
    key: 'init',
    value: function init() {
      this.signin.render();
      this.addEventListener();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.signinEvents();
      this.signupEvents();
      this.tasksEvents();
      this.taskFormEvents();
      this.userEvents();
      this.menuEvents();
    }
  }, {
    key: 'signinEvents',
    value: function signinEvents() {
      var _this = this;

      this.signin.on('error', function (err) {
        return alert('Erro de autentica\xE7\xE3o. ' + err.error);
      });
      this.signin.on('signin', function (token) {
        localStorage.setItem('token', 'bearer ' + token);
        _this.menu.render('tasks');
        _this.tasks.render();
      });
      this.signin.on('signup', function () {
        return _this.signup.render();
      });
    }
  }, {
    key: 'signupEvents',
    value: function signupEvents() {
      var _this2 = this;

      this.signup.on('error', function (err) {
        return alert('Erro no cadastro. ' + err.error);
      });
      this.signup.on('signup', function (user) {
        alert(user.name + ' voc\xEA foi cadastrado com sucesso!');
        _this2.signin.render();
      });
    }
  }, {
    key: 'tasksEvents',
    value: function tasksEvents() {
      var _this3 = this;

      this.tasks.on('error', function () {
        return alert('Erro ao listar tarefas');
      });
      this.tasks.on('remove-error', function () {
        return alert('Erro o excluir tarefa');
      });
      this.tasks.on('update-error', function () {
        return alert('Erro ao atualizar tarefa');
      });
      this.tasks.on('remove', function () {
        return _this3.tasks.render();
      });
      this.tasks.on('updated', function () {
        return _this3.tasks.render();
      });
    }
  }, {
    key: 'taskFormEvents',
    value: function taskFormEvents() {
      var _this4 = this;

      this.taskForm.on('error', function () {
        return alert('Erro ao cadastrar tarefa');
      });
      this.taskForm.on('submit', function () {
        _this4.menu.render('tasks');
        _this4.tasks.render();
      });
    }
  }, {
    key: 'userEvents',
    value: function userEvents() {
      var _this5 = this;

      this.user.on('error', function () {
        return alert('Erro ao carregar usuário!');
      });
      this.user.on('remove-error', function () {
        return alert('Erro ao excluir conta');
      });
      this.user.on('remove-account', function () {
        alert('Que pena! Sua conta foi excluida.');
        localStorage.clear();
        _this5.menu.clear();
        _this5.signin.render();
      });
    }
  }, {
    key: 'menuEvents',
    value: function menuEvents() {
      var _this6 = this;

      this.menu.on('click', function (path) {
        _this6.menu.render(path);
        _this6[path].render();
      });
      this.menu.on('logout', function () {
        localStorage.clear();
        _this6.menu.clear();
        _this6.signin.render();
      });
    }
  }]);

  return App;
}();

exports.default = App;

},{"./components/menu":8,"./components/signin":9,"./components/signup":10,"./components/taskForm":11,"./components/tasks":12,"./components/user":13}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _footer = require('../templates/footer');

var _footer2 = _interopRequireDefault(_footer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Menu = function (_Ntask) {
  _inherits(Menu, _Ntask);

  function Menu(body) {
    _classCallCheck(this, Menu);

    var _this = _possibleConstructorReturn(this, (Menu.__proto__ || Object.getPrototypeOf(Menu)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Menu, [{
    key: 'render',
    value: function render(path) {
      this.body.innerHTML = _footer2.default.render(path);
      this.addEventListener();
    }
  }, {
    key: 'clear',
    value: function clear() {
      this.body.innerHTML = '';
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.pathsClick();
      this.logoutClick();
    }
  }, {
    key: 'pathsClick',
    value: function pathsClick() {
      var _this2 = this;

      var links = this.body.querySelectorAll('[data-path]');

      for (var i = 0, max = links.length; i < max; i++) {
        links[i].addEventListener('click', function (event) {
          event.preventDefault();

          var link = event.target.parentElement;
          var path = link.getAttribute('data-path');

          _this2.emit('click', path);
        });
      }
    }
  }, {
    key: 'logoutClick',
    value: function logoutClick() {
      var _this3 = this;

      var link = this.body.querySelector('[data-logout]');

      link.addEventListener('click', function (event) {
        event.preventDefault();

        _this3.emit('logout');
      });
    }
  }]);

  return Menu;
}(_ntask2.default);

exports.default = Menu;

},{"../ntask":14,"../templates/footer":15}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _signin = require('../templates/signin');

var _signin2 = _interopRequireDefault(_signin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Signin = function (_Ntask) {
  _inherits(Signin, _Ntask);

  function Signin(body) {
    _classCallCheck(this, Signin);

    var _this = _possibleConstructorReturn(this, (Signin.__proto__ || Object.getPrototypeOf(Signin)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Signin, [{
    key: 'render',
    value: function render() {
      this.body.innerHTML = _signin2.default.render();
      this.body.querySelector('[data-email]').focus;
      this.addEventListener();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.formSubmit();
      this.signupClick();
    }
  }, {
    key: 'formSubmit',
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector('form');

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var email = event.target.querySelector('[data-email]');
        var password = event.target.querySelector('[data-password]');
        var opts = {
          method: 'POST',
          url: _this2.URL + '/auth',
          json: true,
          body: {
            email: email.value,
            password: password.value
          }
        };

        _this2.request(opts, function (err, res, data) {
          if (err || res.status === 400 || res.status === 401 || res.status === 404) {
            _this2.emit('error', res.body);
          } else {
            _this2.emit('signin', data.token);
          }
        });
      });
    }
  }, {
    key: 'signupClick',
    value: function signupClick() {
      var _this3 = this;

      var signup = this.body.querySelector('[data-signup]');

      signup.addEventListener('click', function (event) {
        event.preventDefault();

        _this3.emit('signup');
      });
    }
  }]);

  return Signin;
}(_ntask2.default);

exports.default = Signin;

},{"../ntask":14,"../templates/signin":16}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _signup = require('../templates/signup');

var _signup2 = _interopRequireDefault(_signup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Signup = function (_Ntask) {
  _inherits(Signup, _Ntask);

  function Signup(body) {
    _classCallCheck(this, Signup);

    var _this = _possibleConstructorReturn(this, (Signup.__proto__ || Object.getPrototypeOf(Signup)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Signup, [{
    key: 'render',
    value: function render() {
      this.body.innerHTML = _signup2.default.render();
      this.body.querySelector('[data-name]').focus();
      this.addEventListener();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.formSubmit();
    }
  }, {
    key: 'formSubmit',
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector('form');

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var name = event.target.querySelector('[data-name]');
        var email = event.target.querySelector('[data-email]');
        var password = event.target.querySelector('[data-password]');
        var opts = {
          method: 'POST',
          url: _this2.URL + '/users/register',
          json: true,
          body: {
            name: name.value,
            email: email.value,
            password: password.value
          }
        };

        _this2.request(opts, function (err, res, data) {
          if (err || res.status === 400) {
            _this2.emit('error', res.body);
          } else {
            _this2.emit('signup', data);
          }
        });
      });
    }
  }]);

  return Signup;
}(_ntask2.default);

exports.default = Signup;

},{"../ntask":14,"../templates/signup":17}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _taskForm = require('../templates/taskForm');

var _taskForm2 = _interopRequireDefault(_taskForm);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TaskForm = function (_Ntask) {
  _inherits(TaskForm, _Ntask);

  function TaskForm(body) {
    _classCallCheck(this, TaskForm);

    var _this = _possibleConstructorReturn(this, (TaskForm.__proto__ || Object.getPrototypeOf(TaskForm)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(TaskForm, [{
    key: 'render',
    value: function render() {
      this.body.innerHTML = _taskForm2.default.render();
      this.body.querySelector('[data-task]').focus();
      this.addEventListener();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.formSubmit();
    }
  }, {
    key: 'formSubmit',
    value: function formSubmit() {
      var _this2 = this;

      var form = this.body.querySelector('form');

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var task = event.target.querySelector('[data-task]');
        var opts = {
          method: 'POST',
          url: _this2.URL + '/tasks/register',
          json: true,
          headers: {
            authorization: localStorage.getItem('token')
          },
          body: {
            title: task.value
          }
        };

        _this2.request(opts, function (err, res, data) {
          if (err || res.status === 400) {
            _this2.emit('error');
          } else {
            _this2.emit('submit');
          }
        });
      });
    }
  }]);

  return TaskForm;
}(_ntask2.default);

exports.default = TaskForm;

},{"../ntask":14,"../templates/taskForm":18}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _tasks = require('../templates/tasks');

var _tasks2 = _interopRequireDefault(_tasks);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Tasks = function (_Ntask) {
  _inherits(Tasks, _Ntask);

  function Tasks(body) {
    _classCallCheck(this, Tasks);

    var _this = _possibleConstructorReturn(this, (Tasks.__proto__ || Object.getPrototypeOf(Tasks)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(Tasks, [{
    key: 'render',
    value: function render() {
      this.renderTaskList();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.taskDoneCheckbox();
      this.taskRemoveClick();
    }
  }, {
    key: 'renderTaskList',
    value: function renderTaskList() {
      var _this2 = this;

      var opts = {
        method: 'GET',
        url: this.URL + '/tasks',
        json: true,
        headers: {
          authorization: localStorage.getItem('token')
        }
      };

      this.request(opts, function (err, res, data) {
        if (err) {
          _this2.imit('error', err);
        } else {
          _this2.body.innerHTML = _tasks2.default.render(data);
          _this2.addEventListener();
        }
      });
    }
  }, {
    key: 'taskDoneCheckbox',
    value: function taskDoneCheckbox() {
      var _this3 = this;

      var dones = this.body.querySelectorAll('[data-done]');

      for (var i = 0, max = dones.length; i < max; i++) {
        dones[i].addEventListener('click', function (event) {
          event.preventDefault();

          var id = event.target.getAttribute('data-task-id');
          var done = event.target.getAttribute('data-task-done');
          var opts = {
            method: 'PUT',
            url: _this3.URL + '/tasks/' + id,
            headers: {
              authorization: localStorage.getItem('token'),
              'Content-type': 'application/json'
            },
            body: JSON.stringify({
              done: !done
            })
          };

          _this3.request(opts, function (err, res, data) {
            if (err || res.status === 400 || res.status === 404) {
              _this3.emit('uptade-error', err);
            } else {
              _this3.emit('updated');
            }
          });
        });
      }
    }
  }, {
    key: 'taskRemoveClick',
    value: function taskRemoveClick() {
      var _this4 = this;

      var removes = this.body.querySelectorAll('[data-remove]');

      for (var i = 0, max = removes.length; i < max; i++) {
        removes[i].addEventListener('click', function (event) {
          event.preventDefault();

          if (confirm('Deseja excluir esta tarefa?')) {
            var id = event.target.getAttribute('data-task-id');
            var opts = {
              method: 'DELETE',
              url: _this4.URL + '/tasks/' + id,
              headers: {
                authorization: localStorage.getItem('token')
              }
            };

            _this4.request(opts, function (err, res, data) {
              if (err || res.status === 400 || res.status === 404) {
                _this4.imit('remove-error', err);
              } else {
                _this4.emit('remove');
              }
            });
          }
        });
      }
    }
  }]);

  return Tasks;
}(_ntask2.default);

exports.default = Tasks;

},{"../ntask":14,"../templates/tasks":19}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ntask = require('../ntask');

var _ntask2 = _interopRequireDefault(_ntask);

var _user = require('../templates/user');

var _user2 = _interopRequireDefault(_user);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var User = function (_Ntask) {
  _inherits(User, _Ntask);

  function User(body) {
    _classCallCheck(this, User);

    var _this = _possibleConstructorReturn(this, (User.__proto__ || Object.getPrototypeOf(User)).call(this));

    _this.body = body;
    return _this;
  }

  _createClass(User, [{
    key: 'render',
    value: function render() {
      this.renderUserData();
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      this.userCancelClick();
    }
  }, {
    key: 'renderUserData',
    value: function renderUserData() {
      var _this2 = this;

      var opts = {
        method: 'GET',
        url: this.URL + '/users',
        json: true,
        headers: {
          authorization: localStorage.getItem('token')
        }
      };

      this.request(opts, function (err, res, data) {
        if (err || res.status === 400) {
          _this2.imit('error', err);
        } else {
          _this2.body.innerHTML = _user2.default.render(data);
          _this2.addEventListener();
        }
      });
    }
  }, {
    key: 'userCancelClick',
    value: function userCancelClick() {
      var _this3 = this;

      var button = this.body.querySelector('[data-remove-accont]');

      button.addEventListener('click', function (event) {
        event.preventDefault();

        if (confirm('Tem certeza que deseja excluir sua conta?')) {
          var opts = {
            method: 'DELETE',
            url: _this3.URL + '/users',
            headers: {
              authorization: localStorage.getItem('token')
            }
          };

          _this3.request(opts, function (err, res, data) {
            if (err || res.status === 400 || res.status === 401) {
              _this3.emit('remove-error', err);
            } else {
              _this3.emit('remove-account');
            }
          });
        }
      });
    }
  }]);

  return User;
}(_ntask2.default);

exports.default = User;

},{"../ntask":14,"../templates/user":20}],14:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _tinyEmitter = require('tiny-emitter');

var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

var _browserRequest = require('browser-request');

var _browserRequest2 = _interopRequireDefault(_browserRequest);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

_dotenv2.default.config();

var Ntask = function (_TinyEmitter) {
  _inherits(Ntask, _TinyEmitter);

  function Ntask() {
    _classCallCheck(this, Ntask);

    var _this = _possibleConstructorReturn(this, (Ntask.__proto__ || Object.getPrototypeOf(Ntask)).call(this));

    _this.request = _browserRequest2.default;
    _this.URL = process.env.BASE_URL;
    return _this;
  }

  return Ntask;
}(_tinyEmitter2.default);

exports.default = Ntask;

}).call(this,require('_process'))
},{"_process":5,"browser-request":1,"dotenv":3,"tiny-emitter":6}],15:[function(require,module,exports){
'use strict';

exports.render = function (path) {
  var isTasks = path === 'tasks' ? 'active' : '';
  var isTaskForm = path === 'taskForm' ? 'active' : '';
  var isUser = path === 'user' ? 'active' : '';

  return '<div class="tabs-striped tabs-color-calm">\n    <div class="tabs">\n      <a data-path="tasks" class="tab-item ' + isTasks + '">\n        <i class="icon ion-home"></i>\n      </a>\n      <a data-path="taskForm" class="tab-item ' + isTaskForm + '">\n        <i class="icon ion-compose"></i>\n      </a>\n      <a data-path="user" class="tab-item ' + isUser + '">\n        <i class="icon ion-person"></i>\n      </a>\n      <a data-logout class="tab-item">\n        <i class="icon ion-android-exit"></i>\n      </a>\n    </div>\n  </div>';
};

},{}],16:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Email</span>\n        <input type=\"email\" data-email />\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Senha</span>\n        <input type=\"password\" data-password />\n      </label>\n    </div>\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-home\"></i> Entrar\n      </button>\n    </div>\n  </form>\n  <div class=\"padding\">\n    <button class=\"button button-block\" data-signup>\n      <i class=\"ion-person-add\"></i> Cadastrar\n    </button>\n  </div>";
};

},{}],17:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Nome</span>\n        <input type=\"text\" data-name />\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Email</span>\n        <input type=\"email\" data-email />\n      </label>\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Senha</span>\n        <input type=\"password\" data-password />\n      </label>\n    </div>\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-thumbsup\"></i> Cadastrar\n      </button>\n    </div>\n  </form>";
};

},{}],18:[function(require,module,exports){
"use strict";

exports.render = function () {
  return "<form>\n    <div class=\"list\">\n      <label class=\"item item-input item-stacked-label\">\n        <span class=\"input-label\">Tarefa</span>\n        <input type=\"text\" data-task />\n      </label>\n    </div>\n\n    <div class=\"padding\">\n      <button class=\"button button-positive button-block\">\n        <i class=\"ion-compose\"></i> Salvar\n      </button>\n    </div>\n  </form>";
};

},{}],19:[function(require,module,exports){
'use strict';

var renderTasks = function renderTasks(tasks) {
  return tasks.map(function (task) {
    var done = task.done ? 'ios-checkmark' : 'ios-circle-outline';

    return '<li class="item item-icon-left item-button-right">\n      <i class="icon ion-' + done + '" data-done data-task-done="' + (task.done ? 'done' : '') + '" data-task-id="' + task.id + '"></i> ' + task.title + '\n    <button data-remove data-task-id="' + task.id + '" class="button button-assertive"">\n      <i class="ion-trash-a"></i>\n    </button>\n    </li>';
  }).join('');
};

exports.render = function (tasks) {
  if (tasks && tasks.length) {
    return '<ul class="list">' + renderTasks(tasks) + '</ul>';
  } else {
    return '<h4 class="text-center">Nenhuma tarefa cadastrada!</h4>';
  }
};

},{}],20:[function(require,module,exports){
"use strict";

exports.render = function (user) {
  return "<div class=\"list\">\n    <label class=\"item item-input item-stacked-label\">\n      <span class=\"input-label\">Nome</span>\n      <small class=\"dark\">" + user.name + "</small>\n    </label>\n    <label class=\"item item-input item-stacked-label\">\n      <span class=\"input-label\">Email</span>\n      <small class=\"dark\">" + user.email + "</small>\n    </label>\n  </div>\n  <div class=\"padding\">\n    <button data-remove-accont class=\"button button-assertive button-block\">\n      <i class=\"ion-trash-a\"></i> Excluir conta\n    </button>\n  </div>";
};

},{}],21:[function(require,module,exports){
'use strict';

var _app = require('./app');

var _app2 = _interopRequireDefault(_app);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.onload = function () {
  var main = document.querySelector('main');
  var footer = document.querySelector('footer');

  new _app2.default(main, footer).init();
};

},{"./app":7}]},{},[21]);
