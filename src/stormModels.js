/**
 * The following are key names of attributes that acceptable in a property configuration
 * @type {Array}
 */
var configurationAttrs = "rest eager persist basePath key split save view remote local queryBuilder auto".split(' '),
    validationAttrs = "required minLength maxLength min max step pattern dateISO date color number creditcard".split(' '),
    descriptorAttrs = "type foreignKey foreignKeys name complex nested".split(' ');

function siftAttributes(attrs) {
    var v = {}, c = {}, d = {};
    for (var attr in attrs) {
        if (hasOwnProperty.call(attrs, attr)) {
            if (contains(configurationAttrs, attr)) {
                c[attr] = attrs[attr];
            } else if (contains(validationAttrs, attr)) {
                v[attr] = attrs[attr];
            } else if (contains(descriptorAttrs, attr)) {
                d[attr] = attrs[attr];
            }
        }
    }
    return {
        validators: v,
        config: c,
        descriptor: d
    };
}

/**
 * Describes a property.
 * Descriptor is configured during first entity construction.
 * @param name
 * @param type
 * @param attrs
 * @param model
 * @constructor
 */
function PropertyDescriptor(name, type, attrs, model) {
    this.model = model;
    this.value = attrs.value === undefined ? null : attrs.value;
    this.name = name;
    this.type = type;
    var sifted = siftAttributes(attrs);
    this.config = deepExtend({}, model.config, sifted.config);
    this.validators = sifted.validators;
    this.needsDescriptor = true;
    this.descriptor = sifted.descriptor;
}

/**
 * Initialize custom types defined during configuration
 * @param customTypes
 */
function initTypes(customTypes) {
    for (var type in customTypes) {
        if (hasOwnProperty.call(customTypes, type)) {
            createType(type, customTypes[type]);
        }
    }
}
/**
 * Sets the custom type constructor.
 * Property constructor is executed with the entity's (constructors) context.
 * @param type
 * @param ctors
 */
function createType(type, ctors) {
    var constructor = ctors[CONSTRUCTOR],
        destructor = ctors[DESTRUCTOR];
    propertyTypes[type] = [function (prop) {
        this[prop.name] = constructor.call(this, this.$init[prop.name] || deepCopy(prop.val), prop);
    }, function (prop, dest) {
        destructor.call(this, prop, dest);
    }];
}
/**
 * Entry point for global storm configuration. a preprocessor of sorts for the configuration data.
 * Sets up the base object everything else is built onto.
 */
stormModels.$inject = ['$provide'];
function stormModels($provide) {
    //default config values.
    var config = {
            version: 0,
            key: 'id',
            split: '',
            basePath: '',
            isInjectable: true,
            queryBuilder: '',
            persist: false,
            saveWords: [],
            viewWords: [],
            //default methods
            remote: {
                all: {},// e.g. CORS => withCredentials: true
                retrieve: {method: 'GET'}, //unseen defaults (but configurable per model and or globally) => one: basePath+rest+'/:id', all: basePath+rest+'/'
                update: {method: 'PUT', exclude: []},
                create: {method: 'POST', exclude: []},
                destroy: {method: 'DELETE'}
            },
            //default configuration
            local: {}
        },
    //Just everything resides here
    //processed from queue to modelBases.
        queue = [],
        modelBases = {};

    this.setup = function (setupObject) {
        return deepExtend(config, setupObject);
    };

    this.define = function (input) {
        //queue up model definitions which are constructed on service creation
        if (isArray(input))
            queue = queue.concat(input);
        else
            queue.push(input);
    };

    this.propertyTypes = propertyTypes;

    function defineModels(modelDefs) {
        if (!isArray(modelDefs)) {
            modelDefs = [modelDefs];
        }
        var models = {};
        for (var i = 0; i < modelDefs.length; i++) {

            if (!isString(modelDefs[i].model)) {
                throw new Error("Model definition must have a 'model' property");
            }

            var model = modelDefs[i],
                props = model.properties,
                descriptors = model.descriptors = {},
                singleton = model.config && model.config.singleton || false;

            model.modelName = model.model;
            delete model.model;
            models[model.modelName] = model;

            extend(model, {
                $model: model,
                collectionName: model.collection ||
                    (singleton && model.modelName || pluralize(model.modelName)),
                rest: model.rest || model.config && model.config.rest ||
                    (singleton && ('/' + model.modelName).toLowerCase() ||
                        '/' + pluralize(model.modelName).toLowerCase()),
                entityExtensions: model.entityExtensions || {},
                collectionExtensions: model.collectionExtensions || {},
                entityActions: model.entityActions || {},
                collectionActions: model.collectionActions || {},
                config: deepExtend(deepCopy(config), model.config)
            });
            //make path:
            model.config.remote.path = model.config.basePath + model.rest;
            /**
             * iterate over defined properties
             * extracting the information. rename property simply to its name
             * assign property descriptor to props object.
             */
            for (var j = 0, jj = props.length; j < jj; j++) {
                var name, type, attr;
                if (isString(props[j])) {
                    name = props[j];
                    type = propertyTypes.Scalar;
                    attr = {};
                } else if (isArray(props[j])) {
                    name = props[j][NAME];
                    if (!isString(name))
                        throw new Error("Error processing model: '" + name + "' is not a valid model name");
                    type = props[j][TYPE] || propertyTypes.Scalar;
                    attr = props[j][ATTR] || {};
                } else
                    throw new Error('Property Descriptor must be a String or an Array');

                props[j] = name;
                descriptors[name] = new PropertyDescriptor(name, type, attr, model);
            }
            //append pk id to beginning of ordered array.
            //todo Managing Entity Primary Keys
            if(!descriptors[model.config.key]) {
                props.unshift(model.config.key);
                descriptors[model.config.key] = new PropertyDescriptor(model.config.key, propertyTypes.Key, {auto: true}, model);
            }
        }
        //save what we did..
        extend(modelBases, models);
        //return what we did.
        return models;
    }
    this.addValidator = addValidator;
    this.uuid = uuid;
    this.$get = $get;
    $get.$inject = ['$injector','linq'];
    function $get($injector,linq) {
        var modelIterable = linq(modelBases);
        function registerModelFactory(model,name){
            name = name+'Model';
            if($injector.has(name)) throw new Error("An injectable already exists with that name: "+ name);
            $provide.factory(name,function(){
                return model;
            });
        }

        function hasModel(model) {
            return hasOwnProperty.call(modelBases, model);
        }

        function getModel(model) {
            if(!model)
                return modelIterable;
            if (hasModel(model))
                return modelBases[model];
            else
                throw new Error("Model: '" + model + "' doesn't exist. Maybe you added it in the wrong order");
        }

        //initialize types that were configured.
        //Todo do this for every individual model config?? so types can be added at runtime.
        initTypes(config.types);
        delete config.types;
        config.getModel = getModel;
        //Config Provided:
        return {
            queue: queue,
            get: getModel,
            has: hasModel,
            define: defineModels,
            registerModelFactory: registerModelFactory,
            config: config,
            uuid:uuid
        };
    }
}
angular.module('storm').provider('stormModels', stormModels);
