validateDirective.$inject = ['stormModels', '$compile'];
function validateDirective(stormModels, $compile){
    return {
        restrict: 'A',
        require: 'ngModel',
        priority: 0,
        terminal: true,
        link: function postLink(scope, iElement, iAttrs) {
            var names = getEntityAndPropertyNames(iAttrs.ngModel);
            var entity = scope.$eval(names.entityPath);

            // get the entity validators
            forEach(entity.$model.descriptors[names.property].validators, function(validatorValue, validatorName) {
                var value = getValidatorValue(validatorValue);
                var msg = getValidatorMessage(validatorName, validatorValue);
                iElement.attr(snake_case('sv-' + validatorName, '-'), value);

                if(isArray(validatorValue))
                    iElement.attr(snake_case('sv-' + validatorName + "Message", '-'), msg);
            });

            // add an sv-errors directive
            iElement.attr('sv-errors', '');

            $compile(iElement, false, 0)(scope);
        }
    };
}

forEach(validators.methods, createValidatorDirective);
function createValidatorDirective(validatorFn, validatorName) {
    var directiveName = 'sv' + validatorName[0].toUpperCase().concat(validatorName.slice(1));
    angular.module('storm').directive(directiveName,
        ['$parse', function($parse) {
            return {
                require: 'ngModel',
                priority: -2,
                link: function(scope, elm, attr, ctrl) {
                    if (!ctrl) return;
                    var arg = attr[directiveName];
                    var parsedArg = $parse(arg);
                    var msg = attr[directiveName + 'Message'] || validators.messages[validatorName];

                    var validator = function(value) {
                        if(validatorFn(value, parsedArg(scope))){
                            ctrl.$setValidity(msg, true);
                            return value;
                        } else {
                            ctrl.$setValidity(msg, false);
                            return value; // break pipeline
                        }
                    };
                    ctrl.$formatters.push(validator);
                    ctrl.$parsers.unshift(validator);

                    // watch the arg for any changes
                    if(arg && arg !== scope.$eval(arg)) {
                        scope.$watch(arg, function() {
                            validator(ctrl.$viewValue);
                        });
                    }

                    attr.$observe(directiveName, function() {
                        validator(ctrl.$viewValue);
                    });
                }
            };
        }]
    );
}

function getEntityAndPropertyNames(ngModel, entityType) {
    var paths = ngModel.split('.');
    return {
        property: paths.pop(),
        entityPath: paths.join('.'),
        entityType: entityType || paths.pop()
    };
}

var SNAKE_CASE_REGEXP = /[A-Z]/g;
function snake_case(name, separator){
    separator = separator || '_';
    return name.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
        return (pos ? separator : '') + letter.toLowerCase();
    });
}

angular.module('storm').directive('svErrors',
    function() {
        return {
            require: 'ngModel',
            priority: -1,
            link: {
                post: function(scope, elm, attr, ctrl) {
                    if (!ctrl) return;

                    var errorHolder;
                    scope.$watch(function(){return ctrl.$viewValue + ctrl.$modelValue + (ctrl.$valid ? 'v' : 'nv') + (ctrl.$pristine ? 'p' : 'np');}, function() {
                        var errors = ctrl.$error;
                        if(ctrl.$valid || ctrl.$pristine) {
                            // field is valid
                            if(errorHolder)
                                errorHolder.hide();
                        } else {
                            if(!errorHolder)
                                errorHolder = createErrorHolder(elm, attr.svErrors);
                            errorHolder.show();

                            var errorStrings = [];
                            forEach(errors, function(val, message) {
                                if(val) {
                                    if(message == 'email')
                                        message = 'not a valid email';
                                    errorStrings.push(message);
                                }
                            });

                            errorHolder.html(errorStrings.join(', '));
                        }
                    });
                }
            }
        };
    }
);

function createErrorHolder (elm, addtClass) {
    addtClass = addtClass || 'top-right';
    var holder = angular.element('<span class="svErrorHolder ' + addtClass + '"></span>');
    elm.after(holder);
    return holder;
}

angular.module('storm').directive('stormValidate', validateDirective);