const { promisify } = require("util");
const childProcess = require("child_process");
const _ = require("lodash");
const {
  prependNamedArguments,
  createDockerVolumeConfig,
  extractMountPointsFromVolumeConfigs,
  mergeVolumeConfigsEnvironmentVariables,
  validatePaths,
  createDockerVolumesString,
  createEnvironmentVariablesString,
} = require("./helpers");
const { ANSIBLE_DOCKER_IMAGE } = require("./consts.json");

const exec = promisify(childProcess.exec);

async function execute({
  config: unparsedAnsibleConfig,
  command,
}) {
  const {
    volumeConfigs,
    environmentVariables,
    ansibleConfig,
  } = await parseAnsibleConfig(unparsedAnsibleConfig);

  const ansibleCommand = createAnsibleCommand(command, ansibleConfig);
  const sanitizedAnsibleCommand = sanitizeCommand(ansibleCommand);
  const dockerCommand = createDockerCommand(sanitizedAnsibleCommand, {
    environmentVariables: Object.keys(environmentVariables),
    volumeConfigs,
  });

  let result;
  try {
    result = await exec(dockerCommand, {
      env: environmentVariables,
    });
  } catch (error) {
    throw new Error(error.stdout || error.stderr || error.message || error);
  }

  return result;
}

async function parseAnsibleConfig(rawAnsibleConfig) {
  let environmentVariables = {};
  const volumeConfigs = [];
  const ansibleConfig = rawAnsibleConfig;

  if (rawAnsibleConfig.sshCredentials.keyPath) {
    await validatePaths(rawAnsibleConfig.sshCredentials.keyPath);

    const keyVolumeConfig = createDockerVolumeConfig(ansibleConfig.sshCredentials.keyPath);

    ansibleConfig.sshCredentials.keyPath = `$${keyVolumeConfig.mountPoint}`;
    environmentVariables = Object.assign(
      environmentVariables,
      keyVolumeConfig.environmentVariables,
    );
    volumeConfigs.push(keyVolumeConfig);
  }

  if (ansibleConfig.playbookPath) {
    await validatePaths(ansibleConfig.playbookPath);

    const playbookVolumeConfig = createDockerVolumeConfig(ansibleConfig.playbookPath);

    ansibleConfig.playbookPath = `$${playbookVolumeConfig.mountPoint}`;
    environmentVariables = Object.assign(
      environmentVariables,
      playbookVolumeConfig.environmentVariables,
    );
    volumeConfigs.push(playbookVolumeConfig);
  }

  if (ansibleConfig.modules) {
    await validatePaths(ansibleConfig.modules);

    const moduleVolumeConfigs = ansibleConfig.modules.map(createDockerVolumeConfig);

    ansibleConfig.modules = extractMountPointsFromVolumeConfigs(moduleVolumeConfigs);
    environmentVariables = Object.assign(
      environmentVariables,
      mergeVolumeConfigsEnvironmentVariables(moduleVolumeConfigs),
    );
    volumeConfigs.push(...moduleVolumeConfigs);
  }

  if (ansibleConfig.inventoryFiles) {
    await validatePaths(ansibleConfig.inventoryFiles);

    const inventoryVolumeConfigs = ansibleConfig.inventoryFiles.map(createDockerVolumeConfig);

    ansibleConfig.inventoryFiles = extractMountPointsFromVolumeConfigs(inventoryVolumeConfigs);
    environmentVariables = Object.assign(
      environmentVariables,
      mergeVolumeConfigsEnvironmentVariables(inventoryVolumeConfigs),
    );
    volumeConfigs.push(...inventoryVolumeConfigs);
  }

  return {
    volumeConfigs,
    environmentVariables,
    ansibleConfig,
  };
}

function createAnsibleCommand(baseCommand, {
  sshCredentials,
  playbookPath,
  inventoryFiles,
  inventoryIps,
  limit,
  modules,
  vars = {},
}) {
  const postArguments = [playbookPath];
  const preArguments = [];

  const ansibleCommandVariables = vars;

  if (inventoryFiles?.length > 0) {
    postArguments.push(...prependNamedArguments(inventoryFiles, "-i"));
  }
  if (limit?.length > 0) {
    postArguments.push(...prependNamedArguments(limit, "-l"));
  }
  if (modules?.length > 0) {
    postArguments.push(...prependNamedArguments(modules, "-M"));
  }

  if (inventoryIps?.length > 0) {
    postArguments.push("-i", inventoryIps.join(","));
  }

  if (sshCredentials) {
    const { username, password, keyPath } = sshCredentials;

    if (username) {
      postArguments.push("-u", username);
    }
    if (password) {
      ansibleCommandVariables.ansible_ssh_pass = password;
    }
    if (keyPath) {
      postArguments.push("--private-key", keyPath);
    }
    if (password || keyPath) {
      ansibleCommandVariables.ansible_connection = "ssh";

      // Host authenticity checking requires user
      // to type "yes" in shell and in a Docker container
      // it fails for some reason, ANSIBLE_HOST_KEY_CHECKING
      // variable is needed otherwise the ansible-playbook
      // fails with "Host key verification failed." error
      preArguments.push("ANSIBLE_HOST_KEY_CHECKING=False");
    }
  }

  if (!_.isEmpty(ansibleCommandVariables)) {
    postArguments.push("-e", JSON.stringify(JSON.stringify(ansibleCommandVariables)));
  }

  let finalCommand = baseCommand;
  if (preArguments.length > 0) {
    finalCommand = `${preArguments.join(" ")} ${finalCommand}`;
  }
  if (postArguments.length > 0) {
    finalCommand = `${finalCommand} ${postArguments.join(" ")}`;
  }

  return finalCommand;
}

function sanitizeCommand(command) {
  return `sh -c ${JSON.stringify(command)}`;
}

function createDockerCommand(command, { volumeConfigs, environmentVariables }) {
  const volumesString = createDockerVolumesString(volumeConfigs);
  const environmentVariablesString = createEnvironmentVariablesString(environmentVariables);

  return (
    `docker run --rm \
    ${environmentVariablesString} \
    ${volumesString} \
    ${ANSIBLE_DOCKER_IMAGE} ${command}`
  );
}

module.exports = {
  execute,
};
