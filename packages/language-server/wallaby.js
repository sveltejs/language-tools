module.exports = function(w) {
    return {
        files: ['src/**/*.ts'],
        tests: ['test/**/*.ts'],
        env: {
            type: 'node',
        },
    };
};
