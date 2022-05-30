const _ = require("lodash");
const { access } = require("fs/promises");
const fs = require("fs");

function generateRandomString() {
  return Math.random().toString(36).slice(2);
}

async function validatePaths(paths) {
  const pathsArray = _.isArray(paths) ? paths : [paths];

  const pathPromises = pathsArray.map(pathExists);
  const pathResults = await Promise.all(pathPromises);

  const nonexistentPaths = pathsArray.filter((path, index) => !pathResults[index]);

  if (nonexistentPaths.length === 1) {
    throw new Error(`Path ${nonexistentPaths[0]} does not exist!`);
  } else if (nonexistentPaths.length > 1) {
    throw new Error(`Paths ${nonexistentPaths.join(", ")} do not exist!`);
  }
}

async function pathExists(path) {
  try {
    await access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function generateRandomEnvironmentVariableName() {
  return `KAHOLO_ANSIBLE_PLUGIN_ENV_${generateRandomString()}`;
}

function generateRandomTemporaryPath() {
  return `/tmp/kaholo_ansible_plugin_tmp_${generateRandomString()}`;
}

function logToActivityLog(message) {
  // TODO: Change console.error to console.info
  // Right now (Kaholo v4.2.3) console.info
  // does not print messages to Activity Log
  // Jira ticket: https://kaholo.atlassian.net/browse/KAH-3636
  console.error(message);
}

module.exports = {
  validatePaths,
  generateRandomString,
  generateRandomEnvironmentVariableName,
  generateRandomTemporaryPath,
  logToActivityLog,
};
