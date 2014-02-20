"use strict";

var _ = require('underscore');

var default_options = {
    array_square_brackets: false,
    root_hash_decorated: false
};

var decode = exports.decode = function (hstore, options) {
    options = _.defaults(options || {}, default_options);

    if (!options['root_hash_decorated'])
        hstore = '{'+hstore+'}';

    var machine = fsm();

    for (var env, c, n, p, i = 0, len = hstore.length; i < len; i++) {
        // current
        c = (i === 0) ? hstore.substr(i, 1) : n;
        // next
        n = (i+1 < len) ? hstore.substr(i+1, 1) : undefined;

        env = machine(c, p, n);

        // prev
        p = c;
    }

    if (env.state != 'ok')
        throw new SyntaxError('hstore');

    return combine(env.container);
};

var encode = exports.encode = function (object, options, top) {
    options = _.defaults(options || {}, default_options);
    if (_.isUndefined(top)) top = true;

    var is_array = _.isArray(object);

    var normalize = function(data, is_value) {
        if (is_value) {
            if (data === null)
                return 'NULL';

            if (data === '')
                return '""';

            if (_.isBoolean(data))
                return data ? 't': 'f';

            if (_.isNumber(data))
                return data;
        }

        data = data.replace('"', '\\"');

        return '"'+data+'"';
    };

    var hstore = _.map(object, function(value, key) {
        if (_.isObject(value)) {
            var o = _.clone(options);
            o['root_hash_decorated'] = true;
            value = encode(value, o);
        } else {
            value = normalize(value, true);
        }

        return is_array
             ? value
             : normalize(key)+'=>'+value;
    }).join(',');

    if (options['root_hash_decorated'])
        hstore = (is_array && options['array_square_brackets'])
               ? '['+hstore+']'
               : '{'+hstore+'}';

    return hstore;
};

function fsm() {
    var container, element;
    var stack = [];
    var state = 'ok';
    var quoted = false;

    function push(c) {
        var env = {
            state: state,
            close_char: c == '[' ? ']' : '}'
        };

        if (container)
            env.container = container;
        if (element)
            env.element = element;

        stack.push(env);

        element = undefined;
        container = [];
        state = 'firstchar';
    }

    function pop(c) {
        var pop = stack.pop();

        if (pop.close_char != c)
            throw new SyntaxError('Hstore: unexpected close char.');

        state = pop.state;

        if (pop.container) {
            element = pop.element || {};
            element.value = container;

            container = pop.container;
            state = 'comma';
        }
    }

    function fill(c) {
        if (element === undefined)
            element = {key: ''};

        if (element.value === undefined) {
            element.key += c;
        } else {
            element.value += c;
        }

        if (quoted && !element.quoted)
            element.quoted = true;
    }

    var actions = {
        ok: function(c) {
            if (c == '{' || c == '[')
                push(c);
        },
        firstchar: function(c, p, n) {
            if (c == ' ')   // ignore white space
                return;

            if (c == '{' || c == '[')
                return push(c);

            if (c == '}' || c == ']')
                return pop(c);

            if (c == '"' && p != '\\') {
                quoted = !quoted;
            } else {
                fill(c);
            }

            if (!quoted && (n == ',' || n == '}' || n == ']')) {
                state = 'comma';
            } else {
                state = 'keyvalue';
            }
        },
        keyvalue: function(c, p, n) {
            var ignore = false;
            if (c == '"' && p != '\\') {
                quoted = !quoted;
                ignore = true;
            }

            if (!quoted && c == '=' && n == '>')
                return state = 'arrow';

            if (!ignore)
                fill(c);

            if (!quoted && (n == ',' || n == '}' || n == ']'))
                return state = 'comma';
        },
        arrow: function(c, p, n) {
            element.value = '';
            element.quoted = false;
            state = 'firstchar';
        },
        comma: function(c, p, n) {
            if (element.value === undefined) {
                element.value = element.key;
                delete element.key;
            }
            container.push(element);
            element = undefined;

            if (c == '}' || c == ']')
                return pop(c);

            state = 'firstchar';
        }
    };

    return function(c, p, n) {
        (actions[state])(c, p, n);

        return {
            container: container,
            state: state
        };
    };
}

var number_reg = /^\d+(?:\.\d+)?$/;
function combine(container) {
    var data = {}, is_array = null;

    container.forEach(function(element) {
        if (is_array === null) {
            is_array = element.key === undefined;

            if (is_array)
                data = [];
        }

        var value = element.value;
        if (typeof value == 'object') {
            value = combine(value);
        } else if (element.quoted) {
        } else {
            if (value == 't') {
                value = true;
            } else if (value == 'f') {
                value = false;
            } else if (value == 'NULL') {
                value = null;
            } else if (number_reg.test(value)) {
                value = value * 1;
            }
        }

        if (is_array) {
            data.push(value);
        } else {
            var key = element.key;
            key = key.replace('\\"', '"');
            key = key.replace('\\\\', '\\');

            data[key] = value;
        }
    });

    return data;
}
