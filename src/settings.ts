/* eslint-disable @typescript-eslint/no-var-requires */
const configSchema = require('../config.schema.json');
const npmPackage = require('../package.json');

export const PLATFORM_NAME = configSchema.pluginAlias;
export const PLUGIN_VERSION = npmPackage.version;
export const PLUGIN_NAME = npmPackage.name;
