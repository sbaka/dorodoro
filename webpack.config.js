const path = require('path');
const webpack = require('webpack');
require('dotenv').config({ path: './.env' });
module.exports = [
    {
        // The entry point file described above
        entry: './scripts/serverConnectionHandler.js',
        // The location of the build folder described above
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'conn.js'
        },
        // Optional and for development only. This provides the ability to
        // map the built code back to the original source format when debugging.
        devtool: 'eval-source-map',
        plugins: [
            new webpack.DefinePlugin({
                "process.env": JSON.stringify(process.env),
            }),
        ],
        resolve: {
            fallback: {
                "fs": false
            },
        }
    },
];