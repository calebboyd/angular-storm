var validators = {};
validators.methods = {
    required: function (val, arg) {
        if(arg === false)
            return true;
        if (!val) {
            return false;
        }
        else if (typeof (val) == 'object') {
            return isEmpty(val);
        }
        return true;
    },
    minLength: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (typeof (val.length) == 'number')
            return val.trim().length >= arg;
        return false;
    },
    maxLength: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (typeof (val.trim) == 'function' && typeof (val.length) == 'number')
            return val.trim().length <= arg;
        return false;
    },
    min: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (isNaN(parseInt(val, undefined))) {
            return false;
        } else if (typeof (parseInt(val, undefined)) == 'number') {
            val = parseInt(val, undefined);
            return val >= arg;
        }
        return false;
    },
    max: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (isNaN(parseInt(val, undefined))) {
            return false;
        } else if (typeof (parseInt(val, undefined)) == 'number') {
            val = parseInt(val, undefined);
            return val <= arg;
        }
        return false;
    },
    step: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (isNaN(parseInt(val, undefined))) {
            return false;
        } else if (typeof (parseInt(val, undefined)) == 'number') {
            val = parseInt(val, undefined);
            return (val % arg) === 0;
        }
        return false;
    },
    pattern: function (val, arg) {
        if (!val) // not our place to judge if there is no value
            return true;
        if (typeof (arg.test) != 'function') {
            throw new Error("Pattern Validation expects a Regex");
        }
        return arg.test(val);
    },
    dateISO: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return (/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/).test(val);
    },
    date: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return !(/Invalid|NaN/).test(new Date(val));
    },
    time: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return !(/Invalid|NaN/).test(new Date('1/1/2000 ' + val));
    },
    color: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).test(val);
    },
    number: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return (/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/).test(val);
    },
    firstLastName: function (val) {
        if (!val) // not our place to judge if there is no value
            return true;
        return (/\w+\s+\w+/).test(val);
    },
    creditcard: function (value, element) {
        if (!value) // not our place to judge if there is no value
            return true;
        if (this.optional(element))
            return "dependency-mismatch";
        // accept only digits and dashes
        if (/[^0-9-]+/.test(value))
            return false;
        var nCheck = 0,
            nDigit = 0,
            bEven = false;

        value = value.replace(/\D/g, "");

        for (var n = value.length - 1; n >= 0; n--) {
            var cDigit = value.charAt(n);
            /*jshint -W004 */
            var nDigit = parseInt(cDigit, 10);
            if (bEven) {
                if ((nDigit *= 2) > 9)
                    nDigit -= 9;
            }
            nCheck += nDigit;
            bEven = !bEven;
        }

        return (nCheck % 10) === 0;
    }
};

//messages for their corresponding validators
validators.messages = {
    required: 'This field is required',
    minLength: 'too short',
    maxLength: 'too long',
    min: 'too low',
    max: 'too high',
    step: '',
    pattern: '',
    dateISO: 'must Be a valid DateISO',
    date: 'must be a Date',
    time: 'must be a valid time',
    color: 'must Be a hex color',
    number: 'must be a number',
    firstLastName: 'last name required',
    creditcard: 'Must be a valid creditcard number'
};

function isValid(property) {
    return getValidationErrors.call(this, property).length === 0;
}

function getValidationErrors(property) {
    var errors = [];

    // Invididual property validation
    if (isString(property)) {
        var prop = this.$model.props[property],
            propValidators = prop.validators;

        for (var validatorName in propValidators) {
            if (!hasOwnProperty.call(propValidators, validatorName))
                continue;

            var validatorObj = propValidators[validatorName];

            if (!validators.methods[validatorName](this[property], getValidatorValue(validatorObj))) {
                errors.push(
                    {
                        property: property,
                        errorMessage: getValidatorMessage(validatorName, validatorObj)
                    }
                );
            }
        }

        return errors;
    }

    // Array of properties to validate
    if (isArray(property)) {
        var propsLength = property.length;
        for (var i = 0; i < propsLength; i++) {
            errors = errors.concat(getValidationErrors.call(this, property[i]));
        }
        return errors;
    }

    // No specific properties, get them all
    return getValidationErrors.call(this, this.$model.properties);
}

function addValidator(name, message, comp) {
    validators.methods[name] = comp;
    validators.messages[name] = message;

    createValidatorDirective(comp, name);
}

function getValidatorValue(validatorValue) {
    if(isArray(validatorValue))
        return validatorValue[0];
    return validatorValue;
}

function getValidatorMessage(validatorName, validatorValue) {
    if(isArray(validatorValue))
        return validatorValue[1];

    return validators.messages[validatorName];
}