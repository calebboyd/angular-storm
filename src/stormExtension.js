extensionFactory.$inject = ['$injector','$rootScope','linq','$http','$q'];
function extensionFactory($injector,$rootScope,linq,$http, $q){

    function resolveMethod(model,fn,name){
        var services = $injector.annotate(fn),
            args = [];

        fn = isArray(fn) ? fn[fn.length -1] : fn;

        for (var i = 0; i < services.length; i++) {
            args[i] = null;
            if ($injector.has(services[i])) {
                args[i] = $injector.get(services[i]);
            }
        }
        //beforeLoad beforeSave... other things
        var apply = linq(model.config.viewWords ).any(function (v) {
            return contains(name, v);
        });
        var save = linq(model.config.saveWords).any(function (v) {
            return contains(name, v);
        });

        if (!save && !apply && !args.length) {
            return fn;
        } else {
            return function () {
                //apply args(services) and callee arguments to the extension method.
                var ret = fn.apply(this, extend([], args, arguments));
                if (apply && !$rootScope.$$phase) $rootScope.$apply();
                if (save && this.save) this.save();
                return ret;
            };
        }
    }



    /**
     * Description object is
     *          -method
     *          -url
     *          -httpConfig
     *          -error
     *          -success
     *
     * @param model
     * @param desc
     * @param name
     * @returns {Function}
     */
    function resolveAction(model,desc, name) {
        desc = desc || {};
        var pk = model.config.key,
            config = extend({},
                model.config.remote.all,
                desc.config,
                {method: desc.method || 'GET'}
            ),
            matcher = new UrlMatcher(model.config.remote.path + (desc.url || ('/:__'+pk+'/'+name.toLowerCase()))),
            returnType = desc.returnType === false ? false : model.modelName,
            defaultError = desc.error || noop,
            defaultSuccess = desc.success || noop;

        return function(urlParams,queryParams){
            var entity = this;
            if(urlParams === null || urlParams === '') urlParams = {};
            if(config.method === 'GET'){
                config.params = queryParams || urlParams;
            }else{
                config.data = queryParams;
            }
            config.url = matcher.format(concatParams.call(this,urlParams ,matcher.params));
            return $http(config).then(function(response){
                defaultSuccess.call(entity,response);
                if(!returnType) return response;
                var relatedModel = entity.$model.config.getModel(returnType);
                add(relatedModel,response.data,{setSaved:true});
                return relatedModel.collection;
            },function(err){
                defaultError.call(entity,err);
                return $q.reject(err);
            });
        };
    }

    var paramsOnSelf = /^__\w+$/;
    function concatParams(passed,parsed){
        passed = passed || {};
        for(var i = 0; i < parsed.length;i++){
            if(paramsOnSelf.test(parsed[i])){
                passed[parsed[i]] = this[parsed[i].substring(2)];
            }
        }
        return passed;
    }
    return{
        resolveMethod:resolveMethod,
        resolveAction:resolveAction
    };
}
angular.module('storm.util').factory('extensionFactory',extensionFactory);


//todo eliminate...
//from ui-router..
function UrlMatcher(pattern) {
    //Process $
    pattern = pattern.replace(/:\$/g,":__");

    var placeholder = /([:*])([\w\$]+)|\{(\w+)(?:\:((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g,
        names = {}, compiled = '^', last = 0, m,
        segments = this.segments = [],
        params = this.params = [];

    function addParameter(id) {
        if (!/^\w+(-+\w+)*$/.test(id)) throw new Error("Invalid parameter name '" + id + "' in pattern '" + pattern + "'");
        if (names[id]) throw new Error("Duplicate parameter name '" + id + "' in pattern '" + pattern + "'");
        names[id] = true;
        params.push(id);
    }
    function quoteRegExp(string) {
        return string.replace(/[\\\[\]\^$*+?.()|{}]/g, "\\$&");
    }
    // Split into static segments separated by path parameter placeholders.
    // The number of segments is always 1 more than the number of parameters.
    var id, regexp, segment;
    while ((m = placeholder.exec(pattern))) {
        id = m[2] || m[3]; // IE[78] returns '' for unmatched groups instead of null
        regexp = m[4] || (m[1] == '*' ? '.*' : '[^/]*');
        segment = pattern.substring(last, m.index);
        if (segment.indexOf('?') >= 0) break; // we're into the search part
        compiled += quoteRegExp(segment) + '(' + regexp + ')';
        addParameter(id);
        segments.push(segment);
        last = placeholder.lastIndex;
    }
    segment = pattern.substring(last);
    segments.push(segment);
}

UrlMatcher.prototype.format = function (values) {
    var segments = this.segments, params = this.params;
    if (!values) return segments.join('');

    var nPath = segments.length-1, nTotal = params.length,
        result = segments[0], i, search, value;

    for (i=0; i<nPath; i++) {
        value = values[params[i]];
        // TODO: Maybe we should throw on null here? It's not really good style to use '' and null interchangeably
        /*jshint -W041*/
        if (value != null) result += encodeURIComponent(value);
        result += segments[i+1];
    }
    for (/**/; i<nTotal; i++) {
        value = values[params[i]];
        if (value != null) {
            result += (search ? '&' : '?') + params[i] + '=' + encodeURIComponent(value);
            search = true;
        }
    }
    return result;
};