const { promisify } = require("util");
const childProcess = require("child_process");
const _ = require("lodash");
const { ANSIBLE_DOCKER_IMAGE } = require("./consts.json");
const {
  createDockerVolumeConfig,
  createDockerVolumeArguments,
  createEnvironmentVariableArguments,
} = require("./docker-helpers");
const { logToActivityLog } = require("./helpers");

const exec = promisify(childProcess.exec);

async function execute({
  params,
  additionalArguments,
  command,
}) {
  const volumeConfigsMap = createVolumeConfigsMap(params);
  const volumeConfigsArray = [...volumeConfigsMap.values()].flat();
  const environmentVariables = volumeConfigsArray.reduce((acc, curr) => ({
    ...acc,
    ...curr.environmentVariables,
  }), {});

  const updatedParams = _.cloneDeep(params);
  if (volumeConfigsMap.has("vaultPasswordFile")) {
    updatedParams.vaultPasswordFile = `$${volumeConfigsMap.get("vaultPasswordFile").mountPoint}`;
  }

  const ansibleCommand = createAnsibleCommand(
    command,
    {
      playbookName: updatedParams.playbookName,
      sshPassword: updatedParams.sshCredentials.password,
      vaultPasswordFile: updatedParams.vaultPasswordFile,
    },
    additionalArguments,
  );
  const sanitizedAnsibleCommand = sanitizeCommand(ansibleCommand);
  const dockerCommand = createDockerCommand(sanitizedAnsibleCommand, {
    workingDirectory: `$${volumeConfigsMap.get("playbookDirectory").mountPoint}`,
    environmentVariables: Object.keys(environmentVariables),
    volumeConfigsArray,
  });
  logToActivityLog(`Generated Docker command: ${dockerCommand}`);

  return exec(dockerCommand, {
    env: environmentVariables,
  }).catch((error) => {
    throw new Error(error.stdout || error.stderr || error.message || error);
  });
}

function createVolumeConfigsMap(params) {
  const volumeConfigsMap = new Map([
    ["playbookDirectory", createDockerVolumeConfig(params.playbookDirectory)],
  ]);

  if (params.vaultPasswordFile) {
    volumeConfigsMap.set("vaultPasswordFile", createDockerVolumeConfig(params.vaultPasswordFile));
  }

  return volumeConfigsMap;
}

function createAnsibleCommand(
  baseCommand,
  {
    playbookName,
    sshPassword,
    vaultPasswordFile,
  },
  additionalArguments = [],
) {
  const postArguments = [playbookName];
  const preArguments = [];
  const ansibleCommandVariables = {};

  if (sshPassword) {
    ansibleCommandVariables.ansible_connection = "ssh";
    ansibleCommandVariables.ansible_ssh_pass = sshPassword;

    // Host authenticity checking requires user
    // to type "yes" in shell and in a Docker container
    // it fails instantaneously for some reason, ANSIBLE_HOST_KEY_CHECKING
    // variable is needed otherwise the ansible-playbook
    // fails with "Host key verification failed." error
    preArguments.push("ANSIBLE_HOST_KEY_CHECKING=False");
  }
  if (vaultPasswordFile) {
    postArguments.push("--vault-password-file", vaultPasswordFile);
  }

  if (!_.isEmpty(ansibleCommandVariables)) {
    postArguments.push("-e", JSON.stringify(JSON.stringify(ansibleCommandVariables)));
  }
  postArguments.push(...additionalArguments);

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

function createDockerCommand(command, {
  volumeConfigsArray,
  environmentVariables,
  workingDirectory,
}) {
  const volumeArguments = createDockerVolumeArguments(volumeConfigsArray);
  const environmentVariableArguments = createEnvironmentVariableArguments(environmentVariables);
  const workingDirectoryArguments = workingDirectory && ["-w", workingDirectory];

  const dockerCommandArguments = ["docker", "run", "--rm"];

  if (environmentVariableArguments) {
    dockerCommandArguments.push(...environmentVariableArguments);
  }
  if (volumeArguments) {
    dockerCommandArguments.push(...volumeArguments);
  }
  if (workingDirectoryArguments) {
    dockerCommandArguments.push(...workingDirectoryArguments);
  }
  dockerCommandArguments.push(ANSIBLE_DOCKER_IMAGE, command);

  return dockerCommandArguments.join(" ");
}

module.exports = {
  execute,
};
