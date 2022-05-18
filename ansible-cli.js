const { promisify } = require("util");
const childProcess = require("child_process");
const {
  prependNamedArguments,
  createDockerVolumeConfig,
  extractMountPointsFromVolumeConfigs,
  mergeVolumeConfigsEnvironmentVariables,
  validatePaths,
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
    throw new Error(error.stderr ?? error.stdout ?? error.message ?? error);
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
  vars,
}) {
  const additionalArguments = [playbookPath];

  const ansibleCommandVariables = vars;

  if (inventoryFiles.length > 0) {
    additionalArguments.push(...prependNamedArguments(inventoryFiles, "-i"));
  }
  if (limit.length > 0) {
    additionalArguments.push(...prependNamedArguments(limit, "-l"));
  }
  if (modules.length > 0) {
    additionalArguments.push(...prependNamedArguments(modules, "-M"));
  }

  if (inventoryIps.length > 0) {
    additionalArguments.push("-i", inventoryIps.join(","));
  }

  if (sshCredentials) {
    const { username, password, keyPath } = sshCredentials;

    if (username) {
      ansibleCommandVariables.ansible_user = username;
    }
    if (password) {
      ansibleCommandVariables.ansible_ssh_pass = password;
    }
    if (keyPath) {
      ansibleCommandVariables.ansible_ssh_private_key_file = keyPath;
    }
    if (password || keyPath) {
      ansibleCommandVariables.ansible_connection = "ssh";
    }
  }

  let finalCommand = baseCommand;
  if (additionalArguments.length > 0) {
    finalCommand += ` ${additionalArguments.join(" ")}`;
  }

  return finalCommand;
}

function sanitizeCommand(command) {
  // This is the safest way to escape the user provided command.
  // By putting the command in double quotes, we can be sure that
  // every character within the command is escaped, including the
  // ones that could be used for shell injection (e.g. ';', '|', etc.).
  // The escaped string needs then to be echoed back to the docker command
  // in order to be properly executed - simply passing the command in double quotes
  // would result in docker confusing the quotes as a part of the command.
  return `$(echo "${command}")`;
}

function createDockerCommand(command, { volumeConfigs, environmentVariables }) {
  let volumesString = "";
  let environmentVariablesString = "";

  if (volumeConfigs) {
    volumesString = volumeConfigs.map(({ path, mountPoint }) => `-v $${path}:$${mountPoint}`).join(" ");
  }
  if (environmentVariables.length > 0) {
    environmentVariablesString = environmentVariables.map((environmentVariable) => `-e ${environmentVariable}`).join(" ");
  }

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
