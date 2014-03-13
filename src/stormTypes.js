/**
 *
 * @param prop
 * @param type
 */
function describe(prop, type) {
    prop.needsDescriptor = false;
    var descriptor = prop.descriptor,
        pk = prop.model.config.key,
        split = prop.model.config.split;
    switch (type) {
        case tCollection:
            //don wanna write . so many times.
            var fk, fks, isOM, isMM;
            //Find related type, configuration OR inference
            descriptor.type = descriptor.type || depluralize(prop.name);
            //retrieve the model for that type
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type);
            //find fk names, configuration OR inference
            descriptor.foreignKey = fk = descriptor.foreignKey || prop.model.modelName + split + pk;
            descriptor.foreignKeys = fks = descriptor.foreignKeys || pluralize(fk);

            if (descriptor.complex === true) {
                var passed = this.$init[prop.name] || deepCopy(prop.value) || [];
                for (var i = 0, ii = passed.length; i < ii; i++) {
                    add(descriptor.relatedModel,passed[i], {fk:{name:descriptor.foreignKey,value:this[pk]}});
                }
            }
            if (hasOwnProperty.call(descriptor.relatedModel.descriptors, fk) || descriptor.complex) {
                descriptor.isOM = true;
                descriptor.getter = function () {
                    var self = this;
                    var ret = descriptor.relatedModel.collection.where(function (val) {
                        return val[fk] == self[pk];
                    });
                    ret.instance = function (init) {
                        var inst = descriptor.relatedModel.collection.instance(init);
                        inst[fk] = self[pk];
                        return inst;
                    };
                    //setup collection extensions
                    // TODO HACK!!!! temporary fix since we can't re-create the collection extensions
                    forEach(prop.model.collectionExtensions, function (val, name) {
                        //todo refactor applying this type of mixin
                        this[name] = function () {
                            return prop.model.collection[name].apply(this, arguments);
                        };
                    }, ret);
                    return ret;
                };
            }
            //check the related model for a foreignKey of name == fks
            if (hasOwnProperty.call(descriptor.relatedModel.descriptors, fks)) {
                descriptor.isMM = true;
                descriptor.getter = function () {
                    var self = this;
                    var ret = descriptor.relatedModel.collection.where(function (val) {
                        return contains(val[fks], self[pk]);
                    });
                    ret.instance = function (init) {
                        var inst = descriptor.relatedModel.collection.instance(init);
                        console.log('descriptor', descriptor, 'not quite sure how to do this');
                        return inst;
                    };
                    return ret;
                };
            }
            if(descriptor.isOM && descriptor.isMM)
                throw new Error("Conflicting related properties in '" + prop.model.modelName + "' and '" + descriptor.relatedModel.modelName + "'");
            break;
        case tForeignKey:
            //get navigation property name or infer()
            descriptor.name = descriptor.name || prop.name.split(split + pk)[0];
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type || descriptor.name);
            descriptor.getter = function () {
                var self = this;
                return descriptor.relatedModel.collection.data[self[prop.name]];
            };
            break;
        case tForeignKeys:
            descriptor.name = descriptor.name || prop.name.replace(split + pk, '');
            descriptor.type = descriptor.type || depluralize(prop.name.replace(split + pk, ''));
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type);
            descriptor.getter = function () {
                var self = this;
                return descriptor.relatedModel.collection.where(function (x) {
                    return contains(self[prop.name], x[pk]);
                });
            };
            break;
        case tArray:
            break;
        case tEntity:
            descriptor.type = descriptor.type || prop.name;
            descriptor.foreignKey = descriptor.foreignKey || prop.model.modelName + split+pk;
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type);
            descriptor.getter = function(){
                var self = this;
                var test = descriptor.relatedModel.collection.firstOrDefault(function(x){
                    return x[descriptor.foreignKey] === self[pk];
                },null);
                console.log('getting entity',test);
                return test;
            };
            break;
    }
}


/**
 * Collection Constructor
 * @param prop
 */
function collectionConstructor(prop) {
    if (prop.descriptor.complex === true) {
        describe.call(this, prop, tCollection);
    }
    if (prop.needsDescriptor)
        describe(prop, tCollection);
    this[prop.name] = prop.descriptor.getter.call(this);
}
/**
 * Collection Destructor
 * @param prop
 */
function collectionDestructor(prop, dest) {
    if (prop.descriptor.complex === true) {
        var val = [];
        this[prop.name].each(function (value, idx) {
            delete value[prop.descriptor.foreignKey];
            val.push(prop.descriptor.type[DESTRUCTOR](value));
        });
        dest[prop.name] = val;
    }

}
//Generate wip.... Only needed on complex type entity models.
function collectionWip(prop) {

}


/**
 * Entity Constructor
 * @param prop
 */
function entityConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tEntity);
    defineProperty(this,prop.name,{
        get:prop.descriptor.getter
    });
}
/**
 * Entity Destructor
 * @param entity
 */
function entityDestructor(entity) {
    console.log('entity destructor');
}


function fksConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tForeignKeys);
    this[prop.name] = this.$init[prop.name] || prop.default || deepCopy(prop.value);
    this[prop.descriptor.name] = prop.descriptor.getter.call(this);
}
function fksDestructor(prop, dest) {
    //todo do i need deepCopy???
    dest[prop.name] = deepCopy(this[prop.name]) || [];
}

function fkConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tForeignKey);
    this[prop.name] = this.$init[prop.name] || prop.default || deepCopy(prop.value);
    //fk property is actually a 'getter'
    defineProperty(this, prop.descriptor.name, {
        configurable: true,
        get: prop.descriptor.getter
    });
}
function fkDestructor(prop, dest) {
    dest[prop.name] = this[prop.name];
}


/**
 * Array Constructor.
 * @param prop
 */
function arrayConstructor(prop) {
    //get default value.
    var val;
    //keep reference.. if update...
    if (isArray(this[prop.name])) {
        val = this[prop.name];
        val.length = 0;
    }
    var passed = this.$init[prop.name] || deepCopy(prop.value) || [];
    if (!val) val = [];
    var ctor = prop.descriptor.type && prop.descriptor.type[CONSTRUCTOR];

    for (var i = 0, ii = passed.length; i < ii; i++) {
        if (prop.descriptor.type != tScalar && ctor)
            ctor.call(val, {name: i, value: passed[i]});
        else
            val.push(passed[i]);
    }
    this[prop.name] = val;
}
/**
 * Array Deconstructor
 * @param prop
 * @param dest
 * @returns {Array}
 */
function arrayDestructor(prop, dest) {
    var dtor;
    if (prop.descriptor.type != tScalar) {
        dtor = prop.descriptor.type[DESTRUCTOR];
    }
    var val = this[prop.name];
    var length = val.length;
    var ret = [];
    if (dtor) {
        for (var i = 0; i < length; i++) {
            dtor.call(val, {name: i}, ret);
        }
        dest[prop.name] = ret;
    }
    else {
        dest[prop.name] = deepCopy(val) || [];
    }
}

function dateConstructor(prop) {
    this[prop.name] = new Date(this.$init && this.$init[prop.name] || deepCopy(prop.value));
}

function dateDestructor(prop, dest) {
    dest[prop.name] = this[prop.name] && this[prop.name].toISOString && this[prop.name].toISOString() || null;
}

//refactored...
var propertyTypes = {
    Key: [noop, noop, noop],
    Scalar: tScalar,
    Collection: [
        collectionConstructor,
        collectionDestructor,
        collectionWip
    ],
    ForeignKey: [
        fkConstructor,
        fkDestructor,
        noop//fkWip
    ],
    ForeignKeys: [
        fksConstructor,
        fksDestructor,
        noop//fksWip
    ],
    Entity: [
        entityConstructor,
        entityDestructor,
        noop//entityWip
    ],
    Array: [
        arrayConstructor,
        arrayDestructor,
        noop//arrayWip
    ],
    Date: [
        dateConstructor,
        dateDestructor,
        noop//dateWip
    ],
    RegExp: [
        noop,
        noop,
        noop
    ]
};