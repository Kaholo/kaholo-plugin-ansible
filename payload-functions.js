const _ = require("lodash");

function prepareRunPlaybookAnsibleParams({
  sshUsername,
  sshPass,
  sshKeyPath,
  playbookPath,
  inventoryFiles,
  inventoryIPs: inventoryIps,
  limit,
  modules,
  vars,
}) {
  const sshCredentials = {};
  if (sshUsername) {
    sshCredentials.username = sshUsername;
  }
  if (sshPass) {
    sshCredentials.password = sshPass;
  }
  if (sshKeyPath) {
    sshCredentials.keyPath = sshKeyPath;
  }

  return {
    playbookPath,
    sshCredentials,
    inventoryFiles,
    inventoryIps,
    limit,
    modules,
    vars: parseVarsParam(vars),
  };
}

function parseVarsParam(varsParam) {
  if (!_.isNil(varsParam) && !_.isPlainObject(varsParam) && !_.isArray(varsParam)) {
    throw new Error(`Unsupported format of Vars parameter! Vars: ${JSON.stringify(varsParam)}`);
  }

  if (_.isNil(varsParam)) {
    return {};
  }

  if (_.isPlainObject(varsParam)) {
    return varsParam;
  }

  return _.fromPairs(varsParam.map(
    (singleVar) => {
      const [key, ...valueSegments] = singleVar.split("=");
      return [key, valueSegments.join("=")];
    },
  ));
}

module.exports = {
  prepareRunPlaybookAnsibleParams,
};
