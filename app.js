const kaholoPluginLibrary = require("kaholo-plugin-library");
const { execute } = require("./ansible-cli");
const { prepareRunPlaybookAnsibleParams } = require("./payload-functions");

function runPlaybook(params) {
  const ansibleParams = prepareRunPlaybookAnsibleParams(params);

  return execute({
    command: "ansible-playbook",
    params: ansibleParams,
  });
}

module.exports = kaholoPluginLibrary.bootstrap({
  runPlaybook,
});
