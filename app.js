const path = require("path");
const kaholoPluginLibrary = require("@kaholo/plugin-library");
const { execute } = require("./ansible-cli");

async function runPlaybook({
  playbookPath,
  sshPassword,
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
    executionPayload.params.sshCredentials = {
      password: sshPassword,
    };
  }

  let executionResult;
  if (vaultPasswordFile) {
    await kaholoPluginLibrary.helpers.temporaryFileSentinel(
      [vaultPasswordFile],
      async (filePath) => {
        executionPayload.params.vaultPasswordFile = filePath;
        executionResult = await execute(executionPayload);
      },
    );
  } else {
    executionResult = await execute(executionPayload);
  }

  return executionResult;
}

module.exports = kaholoPluginLibrary.bootstrap({
  runPlaybook,
});
