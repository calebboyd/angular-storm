'use strict';

var config,
    eventer,
    stormService;

describe('angular-storm', function () {

    it('should have a storm module and a util module', function () {
        expect(angular.module('storm')).toBeDefined();
        expect(angular.module('storm.util')).toBeDefined();
    });

    it("stormConfigProvider should be  and injectable",function(){
        module('storm', function (stormConfigProvider) {
            stormConfigProvider.setup({
                key: 'ID',
                basePath: 'http://devapi.keepalo.com',
                queryBuilder: 'oData',
                remote:{withCredentials:true}
            });
            stormConfigProvider.define({
                $name:"TestModel",
                data: 'string'
            });
        });
        inject(function (stormConfig,storm) {
            config = stormConfig;
            stormService = storm;
        });
        expect(config).toBeDefined();
    });

    it('should have been configured', function () {
        expect(config.basePath).toEqual('http://devapi.keepalo.com');
        expect(config.key).toEqual("ID");
        expect(config.queryBuilder).toEqual('oData');
    });

    it('should be able to add a model',function(){
        stormService.add([{
            $name: 'TaskList',
            Name: ['string', {required: true, maxLength: 40}],
            Tasks: ['nested', {eager:true}]
        },{
            $name: 'Task',
            Name: ['string', {required: true}],
            TaskListID: 'foreignKey',
            DoneTime: 'datetime'
        }]);
        expect(stormService.TaskLists).toBeDefined();
    });
    describe("Collection API definition",function(){

        it("should have an add method",function(){
            expect(stormService.TaskLists.add).toBeDefined();
        });
        it("should have an data member",function(){
            expect(stormService.TaskLists.data).toBeDefined();
        });
        it("should have an get method",function(){
            expect(stormService.TaskLists.get).toBeDefined();
        });
        it("should have a find method",function(){
           expect(stormService.TaskLists.find).toBeDefined();
        });
    });
    describe("Collection API functionality",function(){


    });






});
