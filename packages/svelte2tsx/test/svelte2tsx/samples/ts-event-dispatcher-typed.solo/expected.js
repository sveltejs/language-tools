let assert = require('assert')

module.exports = function ({events}) {
    assert.deepEqual(
        events.getAll(),
        [
            {name: 'hi', type: 'CustomEvent<boolean>', doc: undefined},
            {name: 'bye', type: 'CustomEvent<boolean>', doc: undefined},
            {name: 'btn', type: 'CustomEvent<string>', doc: undefined}
        ]
    );
}
