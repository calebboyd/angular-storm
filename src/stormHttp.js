stormHttp.$inject = ['$http', 'stormModels','$q', '$timeout'];
function stormHttp($http, stormModels, $q, $timeout) {
    var factory = {};
    "create retrieve update destroy".split(' ')
    .forEach(function (crud) {
        factory[crud] = function (stormObj, config) {
            return http(stormObj, config, crud);
        };
    });

    function http(stormObj, config, crud) {
        //either an entity, collection, or property descriptor..(nested)
        var model = stormObj.$model,
            modelConfig = model.config.remote[crud],
            all = model.config.remote.all,
            httpConfig = extend({},all, modelConfig, config,
            {
                url: model.config.remote.path + (config.action || '/'),
                cache: (config.cache === true || config.cache === false) ? config.cache : modelConfig.cache
            });
        var promise = $http(httpConfig);
        if (httpConfig.bypass === true) return promise;
        return processResponse(stormObj, httpConfig, crud, promise);
    }

    var tempCache = {};
    function setCache(key){
        tempCache[key] = true;
    }


    function processResponse(stormObj, config, crud,promise) {
        var model = stormObj.$model,
            pk = model.config.key,
            uid = stormObj[pk];
        switch (crud) {
            case 'create':
                var toFixup = add(model,stormObj,null);
                model.data.fixup[uid] = null;
                return promise.then(function (response) {
                    //update key only on return.... Cause it may have been edited...
                    //todo fixup will need to be outsourced to function that recursively fixes related items.
                    var key = response.data[pk];
                    toFixup[pk] = key;
                    if(toFixup.$wip) toFixup.$wip[pk] = key;
                    //toFixup.update(response.data, true);
                    model.data.fixup[uid] = toFixup[pk];
                    model.data.store[toFixup[pk]] = toFixup;
                    delete model.data.store[uid];
                    return response;
                }, function (err) {
                    model.collection.remove(stormObj);
                    return $q.reject(err);
                });

            case 'retrieve':
                return promise.then(function (response) {//
                    var jsonParams = JSON.stringify(response.config.params);
                    if(tempCache[config.url+jsonParams]) return response;
                    setCache(config.url+jsonParams);
                    add(stormModels.get(config.returnType || model.modelName),response.data,{setSaved:true});
                    return response;
                }, function (err) {
                    return $q.reject(err);
                });

            case 'update':
                stormObj.update(config.data);
                return promise.then(function (response) {
                    stormObj.update(response.data,{setSaved:true});
                    return response;//
                }, function (err) {
                    //TODO ACTUALLY DON'T DO THIS.....?
                    stormObj.revert();
                    return $q.reject(err);
                });

            case 'destroy':
                //remove it immediately anticipating success..
                model.collection.remove(stormObj);
                return promise.then(function (response) {
                    return response;
                }, function (err) {
                    //well crap it came back...
                    add(model,stormObj,null);
                    return $q.reject(err);
                });
        }
    }
    return factory;
}
angular.module('storm.util').service('stormHttp', stormHttp);