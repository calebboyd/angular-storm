/**
 * Deconstructs object into its original dto
 * @param entity
 * @param deep copies related things too...
 */
function projectPojo(entity, deep) {
    var projection = {},
        descriptors = entity.$model.descriptors,
        properties = entity.$model.properties,
        pk = entity.$model.config.key;
    projection[pk] = entity[pk];
    for (var i = 0, ii = properties.length; i < ii; i++) {
        var descriptor = descriptors[properties[i]],
            name = descriptor.name;
        //scalar or not scalar?
        if (descriptor.type == tScalar) {
            projection[name] = entity[name];
        } else {
            descriptor.type[DESTRUCTOR].call(entity, descriptor, projection);
        }
    }
    return projection;
}

stormEntity.$inject = ['extensionFactory', 'stormHttp','$q','$injector'];
function stormEntity(extensionFactory, stormHttp,$q,$injector) {

    function removeProperties(object, properties) {
        for (var i = 0, ii = properties.length; i < ii; i++) {
            delete object[properties[i]];
        }
    }

    function revert() {
        this.update(this.$saved);
    }

    function update(value, options) {
        if (arguments.length === 0) {
            var self = this;
            var pk = this.$model.config.key;
            return this.$model.collection.get(this[pk],{bypass: true},false).then(function (response) {
                return self.update(response.data, {setSaved: true});
            });
        } else {
            if (this.isWip)
                return this.$self.update(value, options);
            if (this.$wip)
                this.$model.ctor.call(this.$wip, value, options);
            return this.$model.ctor.call(this, value, options);
        }

    }

    /**
     * To copy an entity is to create a new, attached entity, with the same data but different identifier.
     * Such that, It needs to be determined whether or not this is a deep copy. A deep copy, will copy related fields.. and thus it is more complex to implement.
     * @param deep
     */
    function copyEntity(deep) {
        if (deep) {

        }
        else {
            var pojo = projectPojo(this);
            delete pojo[this.$model.config.key];
            return this.$model.collection.instance(pojo);
        }
    }

    function pojoString() {
        var pojo = projectPojo(this);
        return JSON.stringify(pojo);
    }

    var wipProto = {
        wip: function () {
            throw new Error("Don't $wip your $self fool");
        },
        cancel: function () {
            if (this.isWip) {
                delete this.$self.$wip;
            }
            return false;
        },
        isolate: function() {
            if (this.isWip && this.$self.$wip === this) {
                delete this.$self.$wip;
            }
        }
    };

    /**
     * Work In progress. Aquire this for editing things.
     * Basically its a detached instance of an identical thing. (can't be attached and identical (same id), collection is a hash)
     * With links to attached things... But if this is 'open' then linked things can be changed no problem.
     * @returns {*|entityPrototype.$wip}
     */
    function wip(options) {
        options = options || {};
        // if the user wants a fresh wip, then isolate the old one
        if(options && options.fresh && this.$wip)
            this.$wip.isolate();

        // return the current wip if one already exists
        if (this.$wip) return this.$wip;

        // otherwise, create a new wip
        var initWith = (options.useLocal ? this : this.saved) || this;
        var aWip = this.$wip = new this.$model.ctor(initWith, {isWip: true});
        this.$wip.$self = this;
        extend(aWip, wipProto);
        return aWip;
    }

    function save() {
        return lazyExecute.call(this, this.hasUuid() && 'create' || 'update');
    }

    function destroy() {
        return lazyExecute.call(this, 'destroy');
    }

    function lazyExecute(type) {
        var deferred = $q.defer(),
            isDelete = type ==='destroy',
            entity = this,
            pk = entity.$model.config.key,
            callMe = (isDelete ? entity.beforeDestroy : entity.beforeSave) || noop,
            beforeExecutePromise = $q.when(callMe.call(entity, deferred.promise));

        // handle complex entities locally
        if(entity.$model.config.complex) {
            if(isDelete)
                remove(entity);
            else if(isCreate)
                add(entity.$model, entity, null);

            deferred.resolve($q.when(entity.$model.collection));
        } else {
            // lazily execute after 'before' conditions are met
            beforeExecutePromise.then(function (exec) {
                if(exec === false) return $q.reject();
                var pk = entity.$model.config.key,
                //todo this logic fails when pk's are acutally guids..
                    isCreate = uuidEx.test(entity[pk]),
                    config = {
                        data: !isDelete && projectPojo(entity, false),
                        action: isCreate || entity.$model.config.singleton ? '/' : '/'+entity[pk]
                    },
                    exclude = isCreate && entity.$model.config.remote.create.exclude || entity.$model.config.remote.update.exclude;
                if (exclude.length > 0 && config.data ) removeProperties(config.data, exclude);

                return stormHttp[type](entity,config).then(function (data) {
                    deferred.resolve(data);
                }, function (err) {
                    deferred.reject(err);
                });
            });
        }

        return {
            local: beforeExecutePromise,
            remote: deferred.promise
        };
    }

    function hasUuid() {
        return uuidEx.test(this[this.$model.config.key]);
    }

    var entityPrototype = {
        isValid: isValid,
        getValidationErrors: noop,//getValidationErrors,
        save: save,
        destroy: destroy,
        revert: revert,
        update: update,
        copyEntity: copyEntity,
        toString: pojoString,
        hasUuid: hasUuid,
        wip: wip
    };

    function stormCtor(model){
        var pk = model.config.key,
            properties = model.properties,
            descriptors = model.descriptors;

        return function stormEntity(initWith, options) {
            options = options || {};
            if (options.setSaved)
                this.$saved = initWith || {};

            // handle wips a little differently
            if(options.isWip) {
                this.$wipUuid = uuid();
                this.isWip = true;
            }

            var a = this.$init = initWith || {};
            this.$undo = this.$undo || [];
            if (isNumber(a[pk]) || uuidEx.test(a[pk])) {
                this[pk] = a[pk];
                //this.$state = state.unchanged;
            } else {
                this[pk] = uuid();
                //this.$state = state.added;
            }
            for (var i = 1, ii = properties.length; i < ii; i++) {
                var prop = descriptors[properties[i]];
                if (prop.type === tScalar)
                    this[prop.name] = a[prop.name] !== undefined ? a[prop.name] : deepCopy(prop.value);
                else {
                    if (isFunction(prop.value)) {
                        prop.default = $injector.invoke(prop.value);
                    }

                    var constructor = this.isWip && prop.type[WIP] || prop.type[CONSTRUCTOR];
                    constructor.call(this, prop);
                }
            }
            if (options && options.fk) {
                this[options.fk.name] = options.fk.value;
            }

            if(isFunction(this.constructed))
                this.constructed(initWith, options);
        };
    }

    function entityFac(model) {
        //close a ctor
        model.ctor = stormCtor(model);
        model.ctor.prototype = extend({$model: model}, entityPrototype);

        forEach(model.entityExtensions, function (fn, name) {
            model.ctor.prototype[name] = extensionFactory.resolveMethod(model, fn, name);
        });
        delete model.entityExtensions;
        forEach(model.entityActions, function (desc, name) {
            model.ctor.prototype[name] = extensionFactory.resolveAction(model, desc, name);
        });

        if(model.config.singleton) return singleton(model);
        delete model.entityActions;
        return true;
    }

    //close a singleton..
    function singleton(model){
        var instance;
        model.data = {store:null,wips:{}};
        model.ctor.prototype.get = function(config){
            config = config || {};
            return stormHttp.retrieve(model,extend(config,{bypass:true})).then(function(response){
                instance.update(response.data,{setSaved:true});
                return instance;
            },function(err){
                return $q.reject(err);
            });
        };
        model.data.store = instance = new model.ctor();
        return instance;
    }

    return entityFac;
}
angular.module('storm.util').factory('stormEntity', stormEntity);