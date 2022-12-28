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
  command,
  params = {},
  additionalArguments = [],
}) {
  const volumeConfigsMap = createVolumeConfigsMap(params);
  const volumeConfigsArray = [...volumeConfigsMap.values()].flat();
  const environmentVariables = volumeConfigsArray.reduce((acc, curr) => ({
    ...acc,
    ...curr.environmentVariables,
  }), {});

  const ansibleCommandParams = {
    playbookName: params.playbookName,
    sshPassword: params.sshPassword,
  };
  if (volumeConfigsMap.has("vaultPasswordFile")) {
    ansibleCommandParams.vaultPasswordFile = `$${volumeConfigsMap.get("vaultPasswordFile").mountPoint}`;
  }
  if (volumeConfigsMap.has("sshPrivateKey")) {
    ansibleCommandParams.sshPrivateKey = `$${volumeConfigsMap.get("sshPrivateKey").mountPoint}`;
  }

  const ansibleCommand = createAnsibleCommand(command, ansibleCommandParams, additionalArguments);
  const sanitizedAnsibleCommand = sanitizeCommand(ansibleCommand);
  const dockerCommand = createDockerCommand(sanitizedAnsibleCommand, {
    workingDirectory: `$${volumeConfigsMap.get("workingDirectory").mountPoint}`,
    environmentVariables: Object.keys(environmentVariables),
    volumeConfigsArray,
  });

  const { stdout, stderr } = await exec(dockerCommand, {
    env: environmentVariables,
  }).catch((error) => {
    throw new Error(error.stdout || error.stderr || error.message || error);
  });

  if (stderr && !stdout) {
    throw new Error(stderr);
  } else if (stderr) {
    console.error(stderr);
  }
  return stdout;
}

function createVolumeConfigsMap(params) {
  const volumeConfigsMap = new Map([
    ["workingDirectory", createDockerVolumeConfig(params.workingDirectory)],
  ]);

  if (params.vaultPasswordFile) {
    volumeConfigsMap.set("vaultPasswordFile", createDockerVolumeConfig(params.vaultPasswordFile));
  }
  if (params.sshPrivateKey) {
    volumeConfigsMap.set("sshPrivateKey", createDockerVolumeConfig(params.sshPrivateKey));
  }

  return volumeConfigsMap;
}

function createAnsibleCommand(
  baseCommand,
  {
    playbookName,
    sshPassword,
    sshPrivateKey,
    vaultPasswordFile,
  },
  additionalArguments = [],
) {
  const postArguments = [playbookName];
  const preArguments = [];
  const ansibleCommandVariables = {};

  if (sshPassword || sshPrivateKey) {
    ansibleCommandVariables.ansible_connection = "ssh";

    // Host authenticity checking requires user
    // to type "yes" in shell and in a Docker container
    // it fails instantaneously for some reason, ANSIBLE_HOST_KEY_CHECKING
    // variable is needed otherwise the ansible-playbook
    // fails with "Host key verification failed." error
    preArguments.push("ANSIBLE_HOST_KEY_CHECKING=False");
  }
  if (sshPassword) {
    ansibleCommandVariables.ansible_ssh_pass = sshPassword;
  }
  if (sshPrivateKey) {
    ansibleCommandVariables.ansible_ssh_private_key_file = sshPrivateKey;
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

  return finalCommand.trim();
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

  const dockerCommandArguments = ["docker", "run", "--rm"];

  if (environmentVariableArguments) {
    dockerCommandArguments.push(...environmentVariableArguments);
  }
  if (volumeArguments) {
    dockerCommandArguments.push(...volumeArguments);
  }
  if (workingDirectory) {
    dockerCommandArguments.push("-w", workingDirectory);
  }
  dockerCommandArguments.push(ANSIBLE_DOCKER_IMAGE, command);

  return dockerCommandArguments.join(" ");
}

module.exports = {
  execute,
};
