hstore-js
=========

Postgresql hstore stringify and parse functions, support nested hstore syntax.

## Install

``` bash
$ npm install hstore.js
```

## Usage

### Options
``` javascript
{
    // key: default value
    array_square_brackets: false,
    boolean_as_integer: false,
    numeric_check: false,
    root_hash_decorated: false,
    return_postgresql_expression: false
}
```

### Stringify

``` javascript
var hstore = require('hstore.js');

var data = {a: 1, b: null, c: true, d: false, e: '"', f: "'", g: '\\', h: '=>'};
var encoded = hstore.stringify(data, {boolean_as_integer: true});

// "a"=>1,"b"=>NULL,"c"=>1,"d"=>0,"e"=>"\"","f"=>"'","g"=>"\\","h"=>"=>"
console.log(encoded);

var expr = hstore.stringify(data, {boolean_as_integer: true, return_postgresql_expression: true});
var sql = 'select '+ expr;

// select '"a"=>1,"b"=>NULL,"c"=>1,"d"=>0,"e"=>"\"","f"=>"''","g"=>"\\","h"=>"=>"'::hstore
console.log(sql);
```

### Parse

``` javascript
var hstore = require('hstore.js');

var hstore_string = '"a"=>"1", "b"=>NULL, "c"=>"\\"", "d"=>"\'", "e"=>"\\\\", "f"=>"=>"';
var data = hstore.parse(hstore_string);

// { a: '1', b: null, c: '"', d: '\'', e: '\\', f: '=>' }
console.log(data);

data = hstore.parse(hstore_string, {numeric_check: true});

// { a: 1, b: null, c: '"', d: '\'', e: '\\', f: '=>' }
console.log(data);

```

## Nested hstore

Support nested hstore syntax in this [PDF](https://www.pgcon.org/2013/schedule/attachments/280_hstore-pgcon-2013.pdf)

### Stringify

``` javascript
var hstore = require('hstore.js');

var data = [
    {a: 1},
    [1, 2, 3],
    {c: ['d', 'f']}
];

var encoded = hstore.stringify(data);

// {"a"=>1},{1,2,3},{"c"=>{"d","f"}}
console.log(encoded);

var options = {array_square_brackets: true}
encoded = hstore.stringify(data, options);

// {"a"=>1},[1,2,3],{"c"=>["d","f"]}
console.log(encoded);
```

### Parse
``` javascript
var hstore = require('hstore.js');

var hstore_string = '"a"=>1, "b"=>{"c"=>3, "d"=>{4, 5, 6}}';

// { a: 1, b: { c: 3, d: [ 4, 5, 6 ] } }
console.log(hstore.parse(hstore_string));

hstore_string = 'a,b,3,4,5';
// [ 'a', 'b', 3, 4, 5 ]
console.log(hstore.parse(hstore_string));
```
