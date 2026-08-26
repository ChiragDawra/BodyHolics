// Metro has to be told about the monorepo: the workspace packages live outside
// this app's folder, and their dependencies are hoisted to the repo root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Without this, a package hoisted to the root can be resolved twice and React
// ends up duplicated, which breaks hooks in ways that are hard to trace back.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
