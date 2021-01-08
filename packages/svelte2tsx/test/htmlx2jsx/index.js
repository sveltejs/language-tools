const { htmlx2jsx } = require('../build/htmlxtojsx');
const { test_samples } = require('../helpers');

describe('htmlx2jsx', () => {
    test_samples(__dirname, htmlx2jsx, 'jsx');
});
