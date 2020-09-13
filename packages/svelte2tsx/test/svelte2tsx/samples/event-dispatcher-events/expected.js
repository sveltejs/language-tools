let assert = require('assert')

module.exports = function ({events}) {
    assert.deepEqual(
        events.getAll(),
        [
            {name: 'hi', type: 'CustomEvent<any>'},
            {name: 'bye', type: 'CustomEvent<any>'},
            {name: 'btn', type: 'CustomEvent<any>'}
        ]
    );
}
