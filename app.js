const _ = require("lodash");
const path = require("path");
const kaholoPluginLibrary = require("@kaholo/plugin-library");
const { execute } = require("./ansible-cli");

function checkAnsibleVersion() {
  return execute({
    command: "ansible-playbook --version",
  });
}

async function runPlaybook({
  playbookPath,
  sshPassword,
  sshPrivateKey,
  additionalArguments,
  vaultPasswordFile,
}) {
  const executionPayload = {
    command: "ansible-playbook",
    additionalArguments,
    params: {
      playbookName: path.basename(playbookPath),
      playbookDirectory: path.dirname(playbookPath),
    },
  };
  if (sshPassword) {
    executionPayload.params.sshPassword = sshPassword;
  }

  const secretFileContents = {};
  if (vaultPasswordFile) {
    secretFileContents.vaultPasswordFile = [vaultPasswordFile];
  }
  if (sshPrivateKey) {
    secretFileContents.sshPrivateKey = [sshPrivateKey];
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
        executionResult = await execute(executionPayload);
      },
    );
  } else {
    executionResult = await execute(executionPayload);
  }

  return executionResult;
}

module.exports = kaholoPluginLibrary.bootstrap({
  checkAnsibleVersion,
  runPlaybook,
});
