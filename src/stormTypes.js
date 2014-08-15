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
        case tComplexCollection:
            //don wanna write . so many times.
            var fk, fks, isOM, isMM;
            //Find related type, configuration OR inference
            descriptor.type = descriptor.type || depluralize(prop.name);
            //retrieve the model for that type
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type);
            //find fk names, configuration OR inference
            descriptor.foreignKey = fk = descriptor.foreignKey || prop.model.modelName + split + pk;
            descriptor.foreignKeys = fks = descriptor.foreignKeys || pluralize(fk);

            if (type === tComplexCollection) {
                descriptor.relatedModel.config.complex = true;
                var passed = this.$init[prop.name] || deepCopy(prop.value) || [];
                if(passed.collect) passed = passed.collect(function(x){return projectPojo(x);}).toArray();
                for (var i = 0, ii = passed.length; i < ii; i++) {
                    add(descriptor.relatedModel, passed[i], {fk:{name:descriptor.foreignKey,value:this[pk]},$wipUuid:this.$wipUuid});
                }
            }
            if (hasOwnProperty.call(descriptor.relatedModel.descriptors, fk) || descriptor.complex) {
                descriptor.isOM = true;
                descriptor.getter = function () {
                    var self = this,
                        col = descriptor.relatedModel.collection,
                        wipUuid = this.$wipUuid;
                    if(type === tComplexCollection && wipUuid) {
                        var wips = descriptor.relatedModel.data.wips;
                        wips[wipUuid] = wips[wipUuid] || {};
                        // TODO: I used Lazy here... :(
                        col = Lazy(wips[wipUuid]);
                    }

                    var ret = col.where(function (val) {
                        return val[fk] == self[pk];
                    });
                    ret.instance = function (init) {
                        init = init || {};
                        if(init[fk])
                            console.warn('foreign key is being overridden!', init[fk], self[pk]);
                        init[fk] = self[pk];
                        if(wipUuid)
                            init.$wipUuid = wipUuid;
                        var inst = descriptor.relatedModel.collection.instance(init);
                        return inst;
                    };

                    //setup collection extensions
                    applyExtentions(prop, ret);
                    ret.$model = descriptor.relatedModel;
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
                        inst[fks] = [self[pk]];
                        return inst;
                    };

                    //setup collection extensions
                    applyExtentions(prop, ret);
                    ret.$model = this.$model;
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
                return descriptor.relatedModel.data.store[self[prop.name]];
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
        case tComplex:
            descriptor.type = descriptor.type || prop.name;
            descriptor.foreignKey = descriptor.foreignKey || prop.model.modelName + split+pk;
            descriptor.relatedModel = prop.model.config.getModel(descriptor.type);
            descriptor.getter = function(){
                var self = this;
                var test = descriptor.relatedModel.collection.where(function(x){
                    return x[descriptor.foreignKey] === self[pk];
                }).first();
                console.log('getting entity',test);
                return test;
            };
            break;
    }
}

function applyExtentions(prop, ret) {
    // TODO HACK!!!! temporary fix since we can't re-create the collection extensions
    forEach(prop.model.collectionExtensions, function (val, name) {
        //todo refactor applying this type of mixin
        this[name] = function () {
            return prop.model.collection[name].apply(this, arguments);
        };
    }, ret);
}


/**
 * Collection Constructor
 * @param prop
 */
function collectionConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tCollection);
    this[prop.name] = prop.descriptor.getter.call(this);
}
/**
 * Collection Destructor
 * @param prop
 */
function collectionDestructor(prop, dest) {

}


/**
 * Entity Collection Constructor
 * Used for complex collections
 * @param prop
 */
function complexCollectionConstructor(prop) {
    if(this[prop.name])
        this[prop.name].each(function(x) {remove(x);});
    describe.call(this, prop, tComplexCollection);
    this[prop.name] = prop.descriptor.getter.call(this);
}

function complexCollectionDestructor(prop, dest) {
    var val = [];
    this[prop.name].each(function (value, idx) {
        // todo: take care of exclusions so that the ID(pk) isn't included in the pojo
        var pojo = projectPojo(value);
        delete pojo[prop.descriptor.foreignKey];
        var pk = prop.model.config.key;
        if(prop.model.descriptors[pk].config.auto)
            delete pojo[pk];
        val.push(pojo);
    });
    dest[prop.name] = val;
}

function complexCollectionWip(prop) {
    describe.call(this, prop, tComplexCollection);
    this[prop.name] = prop.descriptor.getter.call(this);
}

/**
 * Entity Constructor
 * @param prop
 */
function complexConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tEntity);
    defineProperty(this,prop.name,{
        get:prop.descriptor.getter
    });
}
/**
 * Entity Destructor
 * @param complex
 */
function complexDestructor(prop, dest) {
    console.log('entity destructor');
}

function complexWip(prop) {
    console.log('entity WIP');
}


function fksConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tForeignKeys);
    this[prop.name] = this.$init[prop.name] || prop.default || deepCopy(prop.value) || [];
    this[prop.descriptor.name] = prop.descriptor.getter.call(this);
}
function fksDestructor(prop, dest) {
    //todo do i need deepCopy???
    dest[prop.name] = deepCopy(this[prop.name]) || [];
}

function fkConstructor(prop) {
    if (prop.needsDescriptor)
        describe(prop, tForeignKey);
    this[prop.name] = this.$init[prop.name] || (isFunction(prop.value) ? prop.default : deepCopy(prop.value));
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
    val.$init = passed;
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
        collectionDestructor
    ],
    ComplexCollection: [
        complexCollectionConstructor,
        complexCollectionDestructor,
        complexCollectionWip
    ],
    ForeignKey: [
        fkConstructor,
        fkDestructor
    ],
    ForeignKeys: [
        fksConstructor,
        fksDestructor
    ],
    Complex: [
        complexConstructor,
        complexDestructor,
        complexWip
    ],
    Array: [
        arrayConstructor,
        arrayDestructor
    ],
    Date: [
        dateConstructor,
        dateDestructor
    ],
    RegExp: [
        noop,
        noop
    ]
};