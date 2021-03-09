import { htmlx2jsx } from '../build/htmlxtojsx';
import { test_samples } from '../helpers';

describe('htmlx2jsx', () => {
	test_samples(__dirname, htmlx2jsx, 'jsx');
});