const { generateRandomString } = require("./helpers");

/**
 * Add a named argument before every
 * element in the passed list
 */
function prependNamedArguments(rawArguments, namedArgument) {
  return rawArguments.map((arg) => [namedArgument, arg]).flat();
}

function extractMountPointsFromVolumeConfigs(volumeConfigs) {
  return volumeConfigs.map((volumeConfig) => `$${volumeConfig.mountPoint}`);
}

function mergeVolumeConfigsEnvironmentVariables(volumeConfigs) {
  return volumeConfigs.reduce((accumulatedVariables, currentVolumeConfig) => ({
    ...accumulatedVariables,
    ...currentVolumeConfig.environmentVariables,
  }), {});
}

function createEnvironmentVariablesString(environmentVariables = []) {
  return environmentVariables.map(
    (environmentVariable) => `-e ${environmentVariable}`,
  ).join(" ");
}

function createDockerVolumesString(volumeConfigs = []) {
  return volumeConfigs.map(
    ({ path, mountPoint }) => `-v $${path}:$${mountPoint}`,
  ).join(" ");
}

function createDockerVolumeConfig(path) {
  const pathEnvironmentVariable = generateRandomEnvironmentVariableName();
  const mountPointEnvironmentVariable = generateRandomEnvironmentVariableName();
  return {
    path: pathEnvironmentVariable,
    mountPoint: mountPointEnvironmentVariable,
    environmentVariables: {
      [pathEnvironmentVariable]: path,
      [mountPointEnvironmentVariable]: generateRandomTemporaryPath(),
    },
  };
}

function generateRandomEnvironmentVariableName() {
  return `KAHOLO_ANSIBLE_PLUGIN_ENV_${generateRandomString()}`;
}

function generateRandomTemporaryPath() {
  return `/tmp/kaholo_ansible_plugin_tmp_${generateRandomString()}`;
}

module.exports = {
  prependNamedArguments,
  createDockerVolumeConfig,
  extractMountPointsFromVolumeConfigs,
  mergeVolumeConfigsEnvironmentVariables,
  createDockerVolumesString,
  createEnvironmentVariablesString,
};
