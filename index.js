"use strict";

var stringify = exports.stringify = function(data, options, top) {
    function normalize(data) {
        if (data === null)
            return 'NULL';

        if (data === '')
            return '""';

        if (data === true || data === false)
            return data ? 't' : 'f';

        if (Object.prototype.toString.call(data) == '[object Number]')
            return data;

        return quote(data);
    }

    function quote(data) {
        data = data.replace('"', '\\"');
        return '"'+data+'"';
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    if (top === undefined)
        top = true;

    if (top)
        options = normalize_options(options || {});

    var is_array = (Object.prototype.toString.call(data) == '[object Array]');
    var value, hstore = [];

    for (var key in data) {
        value = data[key];

        value = (typeof value == 'object')
              ? stringify(value, options, false)
              : normalize(value);

        hstore.push(is_array ? value : quote(key)+'=>'+value);
    }

    hstore = hstore.join(',');

    if (!top || options['root_hash_decorated'])
        hstore = (is_array && options['array_square_brackets'])
               ? '['+hstore+']'
               : '{'+hstore+'}';

    return hstore;
};

exports.parse = function (hstore, options) {
    options = normalize_options(options || {});

    if (!options['root_hash_decorated'])
        hstore = '{'+hstore+'}';

    var machine = fsm();

    for (var env, c, n, p, i = 0, len = hstore.length; i < len; i++) {
        // current
        c = (i === 0) ? hstore.substr(i, 1) : n;
        // next
        n = (i+1 < len) ? hstore.substr(i+1, 1) : undefined;

        env = machine(c, p, n);

        // previous
        p = c;
    }

    if (env.state != 'ok')
        throw new SyntaxError('Unexpected end of input');

    return combine(env.container);
};

function normalize_options(options) {
    var defaults = {
        array_square_brackets: false,
        root_hash_decorated: false
    };

    for (var k in defaults) {
        if (options[k] === undefined)
            options[k] = defaults[k];
    }

    return options;
}

function fsm() {
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
            throw new SyntaxError('Unexpected token '+c);

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

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    var container, element;
    var stack = [];
    var state = 'ok';
    var quoted = false;

    var actions = {
        ok: function(c) {
            if (c == '{' || c == '[')
                push(c);
        },
        firstchar: function(c, p, n) {
            if (c == ' ')   // ignore white space
                return;

            if (c == ',')
                throw new SyntaxError('Unexpected token '+c);

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

            if (!quoted && c == ' ')
                ignore = true;

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

var numeric_reg = /^\d+(?:\.\d+)?$/;
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
            value = value.replace('\\"', '"')
                         .replace('\\\\', '\\');
        } else {
            if (value == 't') {
                value = true;
            } else if (value == 'f') {
                value = false;
            } else if (value == 'NULL') {
                value = null;
            } else if (numeric_reg.test(value)) {
                value = value * 1;
            }
        }

        if (is_array) {
            data.push(value);
        } else {
            var key = element.key
                    .replace('\\"', '"')
                    .replace('\\\\', '\\');

            data[key] = value;
        }
    });

    return data;
}
