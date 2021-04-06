let assert = require('assert');

module.exports = function ({ events }) {
    assert.deepEqual(events.getAll(), [
        { name: 'click', type: 'Event' },
        { name: 'hi', type: 'CustomEvent<boolean>', doc: '\nA DOC\n' },
        { name: 'btn', type: 'CustomEvent<string>', doc: undefined },
        { name: 'bye', type: 'CustomEvent<any>' }
    ]);
};
