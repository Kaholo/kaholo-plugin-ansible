const _ = require("lodash");
const path = require("path");
const kaholoPluginLibrary = require("@kaholo/plugin-library");

const ansibleCli = require("./ansible-cli");

function runCommand({ command, workingDirectory }) {
  return ansibleCli.execute({
    command,
    params: {
      workingDirectory,
    },
  });
}

async function runPlaybook({
  playbookPath = "./site.yml",
  sshPassword,
  sshPrivateKey,
  additionalArguments,
  vaultPasswordFile,
  helperVars,
}) {
  const executionPayload = {
    command: "ansible-playbook",
    additionalArguments,
    params: {
      playbookName: path.basename(playbookPath),
      workingDirectory: path.dirname(path.resolve(playbookPath)),
    },
  };
  if (helperVars) {
    executionPayload.params.helperVars = true;
  }
  if (sshPassword) {
    executionPayload.params.sshPassword = sshPassword;
  }

  const secretFileContents = {};
  if (vaultPasswordFile) {
    secretFileContents.vaultPasswordFile = [vaultPasswordFile];
  }
  if (sshPrivateKey) {
    secretFileContents.sshPrivateKey = [`${sshPrivateKey}\n`];
  }

  let executionResult;
  if (!_.isEmpty(secretFileContents)) {
    await kaholoPluginLibrary.helpers.multipleTemporaryFilesSentinel(
      secretFileContents,
      async (secretFilePaths) => {
        executionPayload.params = {
          ...executionPayload.params,
          ...secretFilePaths,
        };
        executionResult = await ansibleCli.execute(executionPayload);
      },
    );
  } else {
    executionResult = await ansibleCli.execute(executionPayload);
  }

  return executionResult;
}

module.exports = kaholoPluginLibrary.bootstrap({
  runCommand,
  runPlaybook,
});
