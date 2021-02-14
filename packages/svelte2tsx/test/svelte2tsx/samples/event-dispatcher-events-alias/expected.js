let assert = require('assert');

module.exports = function ({ events }) {
    assert.deepEqual(events.getAll(), [
        { name: 'btn', type: 'CustomEvent<any>' },
        { name: 'hi', type: 'CustomEvent<any>' },
        { name: 'bye', type: 'CustomEvent<any>' }
    ]);
};
