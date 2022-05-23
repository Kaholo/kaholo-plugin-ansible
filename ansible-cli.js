const { promisify } = require("util");
const childProcess = require("child_process");
const _ = require("lodash");
const {
  validatePaths, prependNamedArguments,
} = require("./helpers");
const { ANSIBLE_DOCKER_IMAGE } = require("./consts.json");
const {
  createDockerVolumeConfig,
  createDockerVolumesString,
  createEnvironmentVariablesString,
} = require("./docker-helpers");

const exec = promisify(childProcess.exec);

async function execute({
  params: ansibleParams,
  command,
}) {
  const volumeConfigsMap = await createDockerVolumeConfigsMap(ansibleParams);
  const environmentVariables = [...volumeConfigsMap.values()].reduce((acc, curr) => ({
    ...acc,
    ...curr.environmentVariables,
  }), {});
  const ansibleCommandParams = createAnsibleCommandParams(ansibleParams, volumeConfigsMap);

  const ansibleCommand = createAnsibleCommand(command, ansibleCommandParams);
  const sanitizedAnsibleCommand = sanitizeCommand(ansibleCommand);
  const dockerCommand = createDockerCommand(sanitizedAnsibleCommand, {
    environmentVariables: Object.keys(environmentVariables),
    volumeConfigsArray: [...volumeConfigsMap.values()],
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

async function createDockerVolumeConfigsMap({
  sshCredentials,
  playbookPath,
  modules,
  inventoryFiles,
}) {
  const volumeConfigsMap = new Map();

  if (sshCredentials.keyPath) {
    await validatePaths(sshCredentials.keyPath);

    const keyVolumeConfig = createDockerVolumeConfig(sshCredentials.keyPath);

    volumeConfigsMap.set("sshCredentials.keyPath", keyVolumeConfig);
  }

  if (playbookPath) {
    await validatePaths(playbookPath);

    const playbookVolumeConfig = createDockerVolumeConfig(playbookPath);

    volumeConfigsMap.set("playbookPath", playbookVolumeConfig);
  }

  if (modules) {
    await validatePaths(modules);

    const moduleVolumeConfigs = modules.map(createDockerVolumeConfig);

    volumeConfigsMap.set("modules", moduleVolumeConfigs);
  }

  if (inventoryFiles) {
    await validatePaths(inventoryFiles);

    const inventoryVolumeConfigs = inventoryFiles.map(createDockerVolumeConfig);

    volumeConfigsMap.set("inventoryFiles", inventoryVolumeConfigs);
  }

  return volumeConfigsMap;
}

function createAnsibleCommandParams(
  {
    sshCredentials,
    inventoryIps,
    limit,
    vars,
  },
  volumeConfigs,
) {
  const ansibleCommandParams = {
    sshCredentials: {
      username: sshCredentials.username,
      password: sshCredentials.password,
    },
    inventoryIps,
    limit,
    vars,
  };

  if (volumeConfigs.has("sshCredentials.keyPath")) {
    const keyPathMountPoint = volumeConfigs
      .get("sshCredentials.keyPath")
      .mountPoint;

    ansibleCommandParams.sshCredentials.keyPath = `$${keyPathMountPoint}`;
  }

  if (volumeConfigs.has("playbookPath")) {
    const playbookPathMountPoint = volumeConfigs
      .get("playbookPath")
      .mountPoint;

    ansibleCommandParams.playbookPath = `$${playbookPathMountPoint}`;
  }

  if (volumeConfigs.has("modules")) {
    ansibleCommandParams.modules = volumeConfigs
      .get("modules")
      .map((volumeConfig) => `$${volumeConfig.mountPoint}`);
  }

  if (volumeConfigs.has("inventoryFiles")) {
    ansibleCommandParams.inventoryFiles = volumeConfigs
      .get("inventoryFiles")
      .map((volumeConfig) => `$${volumeConfig.mountPoint}`);
  }

  return ansibleCommandParams;
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

function createDockerCommand(command, { volumeConfigsArray, environmentVariables }) {
  const volumesString = createDockerVolumesString(volumeConfigsArray);
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
