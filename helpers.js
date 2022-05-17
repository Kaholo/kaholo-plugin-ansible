const _ = require("lodash");
const { access } = require("fs/promises");
const fs = require("fs");

function prepareRunPlaybookPayload({
  sshUsername,
  sshPass,
  sshKeyPath,
  playbookPath,
  inventoryFiles,
  inventoryIPs: inventoryIps,
  limit,
  modules,
  vars,
}) {
  const sshCredentials = {};
  if (sshUsername.trim()) {
    sshCredentials.username = sshUsername.trim();
  }
  if (sshPass.trim()) {
    sshCredentials.password = sshPass.trim();
  }
  if (sshKeyPath.trim()) {
    sshCredentials.keyPath = sshKeyPath.trim();
  }

  return {
    playbookPath: playbookPath.trim(),
    sshCredentials,
    inventoryFiles,
    inventoryIps,
    limit,
    modules,
    vars: parseVarsParam(vars),
  };
}

function parseVarsParam(varsParam) {
  if (_.isNil(varsParam)) {
    return {};
  }

  if (_.isPlainObject(varsParam)) {
    return varsParam;
  }

  if (_.isArray(varsParam)) {
    return _.fromPairs(varsParam.map(
      (singleVar) => {
        const [key, ...valueSegments] = singleVar.split("=");
        return [key, valueSegments.join("=")];
      },
    ));
  }

  throw new Error(`Unsupported format of Vars parameter! Vars: ${JSON.stringify(varsParam)}`);
}

/**
 * Add a named argument before every
 * element in the passed list
 */
function prependNamedArguments(rawArguments, namedArgument) {
  return rawArguments.map((arg) => [namedArgument, arg]).flat();
}

function extractMountPointsFromVolumeConfigs(volumeConfigs) {
  return volumeConfigs
    .map((volumeConfig) => volumeConfig.mountPoint)
    .map((modulePath) => `$${modulePath}`);
}

function mergeVolumeConfigsEnvironmentVariables(volumeConfigs) {
  return volumeConfigs.reduce((accumulatedVariables, currentVolumeConfig) => ({
    ...accumulatedVariables,
    ...currentVolumeConfig.environmentVariables,
  }), {});
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

function generateRandomString() {
  return Math.random().toString(36).slice(2);
}

async function validatePaths(paths) {
  const pathsArray = _.isArray(paths) ? paths : [paths];

  const pathPromises = pathsArray.map(pathExists);
  const pathResults = await Promise.all(pathPromises);

  const nonexistentPaths = pathsArray.filter((path, index) => !pathResults[index]);

  if (nonexistentPaths.length === 1) {
    throw new Error(`Path ${nonexistentPaths[0]} does not exist!`);
  } else if (nonexistentPaths.length > 1) {
    throw new Error(`Paths ${nonexistentPaths.join(", ")} do not exist!`);
  }
}

async function pathExists(path) {
  try {
    await access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  validatePaths,
  prependNamedArguments,
  prepareRunPlaybookPayload,
  createDockerVolumeConfig,
  extractMountPointsFromVolumeConfigs,
  mergeVolumeConfigsEnvironmentVariables,
};
