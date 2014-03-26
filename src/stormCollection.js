/**
* Method used (internally) for adding objects to a specified collection.
    * Not exposed on the model or collection. Only the factory.
    * @param model {Object}
* @param initWith
* @param options {Object}
*/
function add(model, initWith, options) {
    //handle multiple things being added...
    if (isArray(initWith)) {
        for (var i = 0, ii = initWith.length; i < ii; i++) {
            add(model, initWith[i], options);
        }
    } else {
        var pk = model.config.key,
            store = model.data.store;
        options = options || {};
        if (initWith && initWith[pk] && store[initWith[pk]]) {
            store[initWith[pk]].update(initWith, {setSaved: true});
            return store[initWith[pk]];
        } else if (initWith instanceof model.ctor) {
            store[initWith[pk]] = initWith;
            return initWith;
        } else {
            var init = new model.ctor(initWith, options);
            store[init[pk]] = init;
            return init;
        }
    }
}

stormCollection.$inject = ['stormHttp', 'linq', '$q', 'extensionFactory', '$timeout'];
function stormCollection(stormHttp, linq, $q, extensionFactory, $timeout) {
    /**
     * Finds an entity object, either in the data store, or, it will query the api for it.
     * If no arguments are passed it is assumed the object is a singleton. Thus functions as a getter for the singleton model object
     * Behaves like $resource in the fact that an instance object is always returned, which could be populated by a Future Object
     */
    function find(uuid) {
        var found,
            model = this.$model,
            store = model.data.store,
            fixup = model.data.fixup,
            pk = this.$model.config.key;

        //handle singleton case...
        if (!uuid && model.singleton) {
            return store;
        }

        //handle everything else
        //see if this id is being fixed up at the moment...
        if (hasOwnProperty.call(fixup, uuid) && fixup[uuid] !== null) {
            if (store[uuid] && uuid !== store[uuid][pk]) {
                console.log('this should not happen');
            } else {
                uuid = fixup[uuid];
            }
        }

        if (store[uuid]) {
            found = store[uuid];
            found.$promise = $q.when(found);
            return found;
        } else {
            var entity = {};
            entity[pk] = parseInt(uuid, 10);
            found = add(model, entity, null);
            //todo optimize through stormHttp
            found.$promise = model.collection.get(uuid, {bypass: true}, false).then(function (response) {
                found.update(response.data, true);
                return found;
            }, function (err) {
                model.collection.remove(found);
                return $q.reject(err);
            });
            return found;
        }
    }

    /**
     * Provides an entity of the model its mixed in with. (helper method...
     */
    function instance(initWith, options) {
        return new this.$model.ctor(initWith, options);
    }

    function remove(entity) {
        delete entity.$model.data.store[entity[entity.$model.config.key]];
        if (isFunction(entity.onRemove)) {
            if (entity.onRemove() !== true)
                return false;
        }
        //cascading remove...
        /*
         * _.chain(entity.$model.props).where(function(val){
         *   return val.descriptor.isOM;
         * }).each(function(entity){
         *   remove(entity);
         * });
         *
         * */
        var props = entity.$model.properties,
            propsLength = props.length;
        for (var i = 0; i < propsLength; i++) {
            var prop = entity.$model.descriptors[props[i]];
            if (prop.descriptor.isOM) {
                //todo lodash, inner and outer...
                entity[prop.name].each(remove); // remove all child entities of this type
            }
        }
        return true;
    }

    var queryBuilderBase = {
        param: defaultQb,
        changed: function () {
            if (!this.invoking) {
                this.invoking = $timeout(this, 0, false);
            }
            return this.invoking;
        },
        then:function(success,error){
            return this.changed().then(success,error);
        }
    };

    //process the get functions arugments
    function processArgs(args, query) {
        var config = {},
            uuid = null;
        for (var i = 0; i < args.length; i++) {
            switch (typeof args[i]) {
                case 'object':
                    config = args[i];
                    break;
                case 'number':
                case 'string':
                    uuid = '/' + args[i];
                    break;
            }
        }
        config.params = config.params ? extend(config.params, query) : query;
        config.action = uuid ? uuid : '/';
        return config;
    }


    //Get a #get method for specific model.
    function getter(model) {
        return function () {
            var query = go.query = {};
            function go() {
                var args = processArgs(arguments, query);
                return stormHttp.retrieve(model, args);
            }

            return extend(go, queryBuilderBase, model.queryBuilder);
        };
    }


    function cFactory(model) {
        //all data for this particular model sits here.
        model.data = {
            store: {},
            wips: {},
            fixup: {}
        };
        var collection = model.collection = linq(model.data.store);

        forEach(model.collectionExtensions, function (fn, name) {
            collection[name] = extensionFactory.resolveMethod(model, fn, name);
        });
        //delete model.collectionExtensions;

        forEach(model.collectionActions, function (desc, name) {
            collection[name] = extensionFactory.resolveAction(model, desc, name);
        });
        //delete model.collectionActions;
        model.queryBuilder = getQueryBuilder(model.config.queryBuilder);

        defineProperty(collection, 'get', {get: getter(model)});

        //append/mixin collection api
        extend(collection, {
            $model: model,
            find: find,
            instance: instance,
            remove: remove
        });

        return true;
    }

    cFactory.attach = function(entities) {
        var model = null;
        if(isArray(entities)) {
            if(entities.length > 0)
                model = entities[0].$model;
            else
                model = entities.$model;
        }

        return add(model, entities);
    };

    return cFactory;
}
angular.module('storm').factory('stormCollection', stormCollection);