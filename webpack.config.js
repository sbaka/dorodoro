const path = require('path');

module.exports = [
    {
        // The entry point file described above
        entry: './scripts/signUpScript.js',
        // The location of the build folder described above
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'signUp.js'
        },
        // Optional and for development only. This provides the ability to
        // map the built code back to the original source format when debugging.
        devtool: 'eval-source-map',
    },
    {
        // The entry point file described above
        entry: './scripts/signInScript.js',
        // The location of the build folder described above
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'signIn.js'
        },
        // Optional and for development only. This provides the ability to
        // map the built code back to the original source format when debugging.
        devtool: 'eval-source-map',
    },
];