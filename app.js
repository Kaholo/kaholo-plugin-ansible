const kaholoPluginLibrary = require("kaholo-plugin-library");
const { execute } = require("./ansible-cli");
const { prepareRunPlaybookPayload } = require("./helpers");

function runPlaybook(params) {
  const payload = prepareRunPlaybookPayload(params);
  return execute({
    command: "ansible-playbook",
    config: payload,
  });
}

module.exports = kaholoPluginLibrary.bootstrap({
  runPlaybook,
});
