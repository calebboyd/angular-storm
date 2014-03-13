var queryBuilders = {
    odata: function () {
        var o = {
            '==': 'eq', '&&': 'and', '||': 'or', '<': 'lt', '>': 'gt', '!=': 'ne', '-': 'sub',
            '>=': 'ge', '%': 'mod', '*': 'mult', '/': 'div', '+': 'add', '!': 'not', '<=': 'le'
        };

        var expressionRegex = /(==|&&|!=|%|\*|<=|<|>=|>|\|\||!|\s-\s|\+|\/)/;
        //swap operators in expression...
        function sO(expression) {
            var expArr = expression.split(expressionRegex);
            for (var i = 0, ii = expArr.length; i < ii; i++) {
                expArr[i] = o[expArr[i].trim()] || expArr[i];
            }
            return expArr.join(' ');
        }

        var ret = {};
        //query
        //param
        //changed

        'skip top expand select orderBy format filter'.split(' ').forEach(function (name) {
            var paramName = '$' + name.toLowerCase();
            ret[name] = function (expr) {
                return this.param(paramName, sO(expr));
            };
        });
        //alias filter with 'where'
        ret.where = ret.filter;
        return ret;
    }
};

function defaultQb(name, value) {
    this.query[name] = value;
    this.changed();
    return this;
}

function addQueryBuilders(qbs) {
    for (var name in qbs) {
        if (hasOwnProperty.call(qbs, name) && isFunction(qbs[name])) {
            queryBuilders[name] = qbs[name];
            return true;
        }
    }
    return false;
}
function getQueryBuilder(name) {
    //Returns a default #param query builder...
    return queryBuilders[name] && queryBuilders[name]() || {param: defaultQb};
}