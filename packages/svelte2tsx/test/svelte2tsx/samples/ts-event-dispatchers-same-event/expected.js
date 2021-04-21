let assert = require('assert');

module.exports = function ({ events }) {
    assert.deepEqual(events.getAll(), [
        { name: 'click', type: 'Event' },
        { name: 'hi', type: 'CustomEvent<any>' },
        { name: 'bye', type: 'CustomEvent<any>' }
    ]);
};
