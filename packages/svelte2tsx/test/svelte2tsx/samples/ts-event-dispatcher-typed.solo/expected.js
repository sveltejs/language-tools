let assert = require('assert')

module.exports = function ({events}) {
    assert.deepEqual(
        events.getAll(),
        [
            {name: 'hi', type: 'CustomEvent<boolean>', doc: '\nA DOC\n'},
            {name: 'bye', type: 'CustomEvent<boolean>', doc: '\nANOTHER DOC\n'},
            {name: 'btn', type: 'CustomEvent<string>', doc: undefined}
        ]
    );
}
