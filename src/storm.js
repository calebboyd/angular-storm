storm.$inject = ['stormModels', 'stormCollection','stormEntity'];
function storm(stormModels, stormCollection,stormEntity) {
    var define = stormModels.define;

    this.propertyTypes = propertyTypes;
    this.define =
        stormModels.define =
            function (modelDef) {
                forEach(define(modelDef), function (model, name) {
                    if(model.config.singleton !== true){
                        stormCollection(model);
                        stormEntity(model);

                        this[model.collectionName] = model.collection;
                    }else{
                        this[name] = stormEntity(model);
                    }
                    //create an injectable of the whole model. called 'modelNameModel'
                    stormModels.registerModelFactory(model,name);
                },this);
            };
    //process the queue...
    this.define(stormModels.queue);
    stormModels.queue.length = 0;
}
angular.module('storm').service('storm', storm);