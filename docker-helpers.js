const {
  generateRandomTemporaryPath,
  generateRandomEnvironmentVariableName,
} = require("./helpers");

function createEnvironmentVariableArguments(environmentVariables = []) {
  return environmentVariables.map(
    (environmentVariable) => ["-e", environmentVariable],
  ).flat();
}

function createDockerVolumeArguments(volumeConfigs = []) {
  return volumeConfigs.map(
    ({ path, mountPoint }) => ["-v", `$${path}:$${mountPoint}`],
  ).flat();
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

module.exports = {
  createDockerVolumeConfig,
  createDockerVolumeArguments,
  createEnvironmentVariableArguments,
};
