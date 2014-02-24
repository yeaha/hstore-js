"use strict";

var assert = require("assert");
var hstore = require("./index");

describe('simple hstore', function() {
    it('stringify and parse', function(done) {
        var data = {a: 1, b: '2', c: 'foobar', d: '"', e: "'", f: '', g: null};
        var encoded = hstore.stringify(data);

        assert.equal(encoded, '"a"=>1,"b"=>"2","c"=>"foobar","d"=>"\\"","e"=>"\'","f"=>"","g"=>NULL');

        var decoded = hstore.parse(encoded);
        assert.strictEqual(decoded['g'], null);

        done();
    });

    it('character escape', function(done) {
        var data = {
            '"foo' : 'foo"',
            '=>bar' : 'bar=>',
            '{foo': 'foo}',
            '[bar': 'bar]',
        };

        var encoded = hstore.stringify(data);
        assert.equal(encoded, '"\\"foo"=>"foo\\"","=>bar"=>"bar=>","{foo"=>"foo}","[bar"=>"bar]"');

        var decoded = hstore.parse(encoded);

        for (var k in decoded)
            assert.strictEqual(decoded[k], data[k]);

        done();
    });

    it('postgresql expression', function(done) {
        var data = {a: 1, b: 'foobar', c: '"', d: "'"};
        var encoded = hstore.stringify(data, {return_postgresql_expression: true});

        assert.equal(encoded, '\'"a"=>1,"b"=>"foobar","c"=>"\\"","d"=>"\'\'"\'::hstore');
        done();
    });

    it('boolean_as_integer option', function(done) {
        var encoded, decoded, data = {a: true, b: false};

        encoded = hstore.stringify(data);
        assert.equal(encoded, '"a"=>t,"b"=>f');

        decoded = hstore.parse(encoded);
        assert.strictEqual(decoded['a'], true);
        assert.strictEqual(decoded['b'], false);

        encoded = hstore.stringify(data, {boolean_as_integer: true});
        assert.equal(encoded, '"a"=>1,"b"=>0');

        done();
    });

    it('numeric_check option', function(done) {
        var decoded, encoded = '"a"=>"1","b"=>2';

        decoded = hstore.parse(encoded);
        assert.strictEqual(decoded['a'], '1');
        assert.strictEqual(decoded['b'], 2);

        decoded = hstore.parse(encoded, {numeric_check: true});
        assert.strictEqual(decoded['a'], 1);

        done();
    });
});

// https://www.pgcon.org/2013/schedule/attachments/280_hstore-pgcon-2013.pdf
describe('nested hstore', function() {
    it('stringify and parse', function(done) {
        var encoded, decoded, data = {a: {b: 1, c: '2'}, d: {e: "foo", f: "bar"}, g: 5};

        encoded = hstore.stringify(data);

        assert.equal(encoded, '"a"=>{"b"=>1,"c"=>"2"},"d"=>{"e"=>"foo","f"=>"bar"},"g"=>5');

        decoded = hstore.parse(encoded);

        assert.strictEqual(decoded['a']['b'], 1);
        assert.strictEqual(decoded['a']['c'], "2");
        assert.strictEqual(decoded['g'], 5);

        done();
    });

    it('array element', function(done) {
        var encoded, decoded, data = [1, 2, 3, "foo", "bar"];

        encoded = hstore.stringify(data);
        assert.equal(encoded, '1,2,3,"foo","bar"');

        decoded = hstore.parse(encoded);
        assert.equal(decoded.length, 5);

        data = {a: [1, 2, 3], b: ["foo", "bar"]};
        encoded = hstore.stringify(data);
        assert.equal(encoded, '"a"=>{1,2,3},"b"=>{"foo","bar"}');

        done();
    });

    it('array_square_brackets option', function(done) {
        var encoded, decoded, data = {a: [1, 2, 3], b: ["foo", "bar"]};

        encoded = hstore.stringify(data, {array_square_brackets: true});
        assert.equal(encoded, '"a"=>[1,2,3],"b"=>["foo","bar"]');

        decoded = hstore.parse(encoded);
        assert.equal(Object.prototype.toString.call(decoded['a']), '[object Array]');
        assert.equal(decoded['a'].length, 3);
        assert.equal(decoded['b'].length, 2);

        done();
    });

    it('root_hash_decorated option', function(done) {
        var encoded, decoded, options, data = {a: [1, 2, 3], b: ["foo", "bar"]};

        options = {root_hash_decorated: true};
        encoded = hstore.stringify(data, options);
        assert.equal(encoded, '{"a"=>{1,2,3},"b"=>{"foo","bar"}}');

        hstore.parse(encoded, options);

        options = {array_square_brackets: true, root_hash_decorated: true};
        encoded = hstore.stringify(data, options);
        assert.equal(encoded, '{"a"=>[1,2,3],"b"=>["foo","bar"]}');

        hstore.parse(encoded, options);

        options = {array_square_brackets: true};
        encoded = hstore.stringify(data, options);
        assert.equal(encoded, '"a"=>[1,2,3],"b"=>["foo","bar"]');

        hstore.parse(encoded);

        done();
    });
});
