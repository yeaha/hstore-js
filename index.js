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
    console.log(hstore);

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

    //console.log(env.container);
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
    }).join(', ');

    if (options['root_hash_decorated'])
        hstore = (is_array && options['array_square_brackets'])
               ? '['+hstore+']'
               : '{'+hstore+'}';

    return hstore;
};

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

function fsm() {
    var container, element;
    var stack = [];
    var state = 'ok';
    var quoted = false;

    function push_stack(c) {
        var env = {
            state: state,
            close_char: c == '[' ? ']' : '}'
        };

        if (container)
            env['container'] = container;

        if (element)
            env['element'] = element;

        stack.push(env);

        element = undefined;
        container = [];
        state = 'firstchar';
    }

    function pop_stack(c) {
        var pop = stack.pop();
        state = pop.state;

        if (element)
            container.push(element);

        if (pop.container) {
            var el = {value: container};
            if (pop.element && pop.element.key)
                el.key = pop.element.key;

            pop.container.push(el);
            container = pop.container;
        }

        element = undefined;
    }

    function fill_element(c) {
        if (element === undefined)
            element = {key: ''};

        if (element.value !== undefined) {
            element.value += c;
        } else {
            element.key += c;
        }

        if (quoted && element.quoted !== true)
            element.quoted = true;
    }

    function fix_element(el) {
        if (el.value === undefined) {
            el.value = el.key;
            delete el.key;
        }

        return el;
    }

    // '"a"=>1,"b"=>2,"c"=>3,"d"=>{"e"=>1}';
    var actions = {
        ok: function(c) {
            if (c == '{' || c == '[')
                push_stack(c);
        },
        firstchar: {
            '{': push_stack,
            '[': push_stack,
            '}': pop_stack,
            ']': pop_stack,
            '*': function(c, p) {
                if (c == ' ' || c == ',')
                    return;

                if (c == '"' && p != '\\') {
                    quoted = !quoted;
                } else {
                    fill_element(c);
                }

                state = 'element';
            }
        },
        element: function(c, p, n) {
            if (c == '"' && p != '\\') {
                quoted = !quoted;
                if (!quoted) return;
            }

            if (quoted)
                return fill_element(c);

            if (c == '}' || c == ']') {
                if (element.value === undefined) {
                    element.value = element.key;
                    delete element.key;
                }
                return pop_stack(c);
            }

            if (c == '=' && n == '>')
                return;

            if (c == '>' && p == '=') {
                element.value = '';
                element.quoted = false;
                state = 'firstchar';
                return;
            }

            if (c == ',') {
                if (element.value === undefined) {
                    element.value = element.key;
                    delete element.key;
                }

                container.push(element);
                element = undefined;
                state = 'firstchar';
                return;
            }

            fill_element(c);
        }
    };

    return function(c, p, n) {
        var action = actions[state];

        if (typeof action != 'function')
            action = action[c] || action['*'];

        action(c, p, n);

        return {container: container, state: state, stack: stack};
    };
}
