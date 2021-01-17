let assert = require('assert');

module.exports = function ({ events }) {
    assert.deepEqual(events.getAll(), [
        { name: 'a-b', type: 'boolean', doc: '\nSome doc\n' },
        { name: 'b', type: 'string', doc: undefined },
        { name: 'c', type: 'Event', doc: undefined }
    ]);
};
