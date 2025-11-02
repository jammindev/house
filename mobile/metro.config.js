// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedPath = path.resolve(__dirname, '..', 'shared');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches the shared package so changes are picked up
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(sharedPath);

// Map the package name used in imports to the built dist folder of the shared package
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
    '@house/shared': path.join(sharedPath, 'dist'),
});

module.exports = config;
