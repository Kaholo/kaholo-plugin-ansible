const _ = require("lodash");
const { access } = require("fs/promises");
const fs = require("fs");

/**
 * Add a named argument before every
 * element in the passed list
 */
function prependNamedArguments(rawArguments, namedArgument) {
  return rawArguments.map((arg) => [namedArgument, arg]).flat();
}

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

module.exports = {
  validatePaths,
  generateRandomString,
  prependNamedArguments,
};
