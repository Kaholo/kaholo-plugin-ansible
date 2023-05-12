const _ = require("lodash");
const fs = require("fs");
const childProcess = require("child_process");
const { promisify } = require("util");

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
    await fs.promises.access(path, fs.constants.F_OK);
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

async function asyncExec(params) {
  const {
    command,
    onProgressFn,
    options = {},
  } = params;

  let childProcessError;
  let childProcessInstance;
  try {
    childProcessInstance = childProcess.exec(command, options);
  } catch (error) {
    return { error };
  }

  const outputChunks = [];

  childProcessInstance.stdout.on("data", (data) => {
    outputChunks.push({ type: "stdout", data });

    onProgressFn?.(data);
  });
  childProcessInstance.stderr.on("data", (data) => {
    outputChunks.push({ type: "stderr", data });

    onProgressFn?.(data);
  });
  childProcessInstance.on("error", (error) => {
    childProcessError = error;
  });

  try {
    await promisify(childProcessInstance.on.bind(childProcessInstance))("close");
  } catch (error) {
    childProcessError = error;
  }

  const outputObject = outputChunks.reduce((acc, cur) => ({
    ...acc,
    [cur.type]: `${acc[cur.type]}${cur.data.toString()}`,
  }), { stdout: "", stderr: "" });

  if (childProcessError) {
    outputObject.error = childProcessError;
  }

  return outputObject;
}

module.exports = {
  validatePaths,
  generateRandomString,
  generateRandomEnvironmentVariableName,
  generateRandomTemporaryPath,
  asyncExec,
};
