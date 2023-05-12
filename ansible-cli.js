const _ = require("lodash");

const {
  createDockerVolumeConfig,
  createDockerVolumeArguments,
  createEnvironmentVariableArguments,
} = require("./docker-helpers");
const { ANSIBLE_DOCKER_IMAGE } = require("./consts.json");
const { asyncExec } = require("./helpers");

async function execute({
  command,
  params = {},
  additionalArguments = [],
}) {
  const volumeConfigsMap = createVolumeConfigsMap(params);
  const volumeConfigsArray = [...volumeConfigsMap.values()].flat();
  // ANSIBLE_HOST_KEY_CHECKING averts common default where only known hosts can be reached by ssh
  // This is same as setting host_key_checking = False in ansible.cfg in the playbook
  // ANSIBLE_FORCE_COLOR is for color output in Activity log
  // This is hard (impossible?) to override so boolean parameter needed to opt OUT of these defaults
  const injectedVariables = {
    "ANSIBLE_HOST_KEY_CHECKING": "False",
    "ANSIBLE_FORCE_COLOR": "True"
  }

  const environmentVariables = volumeConfigsArray.reduce((acc, curr) => ({
    ...acc,
    ...curr.environmentVariables,
    ...injectedVariables,
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

  const {
    stdout,
    stderr,
    error,
  } = await asyncExec({
    command: dockerCommand,
    onProgressFn: console.info,
    options: {
      env: environmentVariables,
    },
  });

  if (error) {
    throw new Error(error.stdout || error.stderr || error.message || error);
  }

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
  const ansibleCommandVariables = {};

  if (sshPassword || sshPrivateKey) {
    ansibleCommandVariables.ansible_connection = "ssh";
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
