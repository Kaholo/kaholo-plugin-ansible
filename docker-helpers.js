const { generateRandomString } = require("./helpers");

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
  createDockerVolumeConfig,
  createDockerVolumesString,
  createEnvironmentVariablesString,
};
