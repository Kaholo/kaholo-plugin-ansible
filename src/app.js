const child_process = require("child_process");

function executeAnsible(action) {
    let execString = `ansible ${action.params.PARAMS}`;
    console.log(execString)
    return _executeSingleCommand(execString);
}

function executeAnsiblePlaybook (action) {
    let execString = `ansible-playbook ${action.params.YAML} ${action.params.PARAMS}`;
    return _executeSingleCommand(execString);
}

function _executeSingleCommand(command) {
    return new Promise((resolve,reject) => {
        child_process.exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`${stdout}`)
                return reject(`exec error: ${error}`);
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
            }
            return resolve(stdout);
        });
    });
}

module.exports = {
    executeAnsible : executeAnsible,
    executeAnsiblePlaybook : executeAnsiblePlaybook
}