const { textToArgs, runCLICommand, parseVars } = require('./helpers');

async function runPlaybook(action){
    const cmdArgs = getAnsibleCmd(action);
    return runCLICommand(`ansible-playbook`, cmdArgs);
}

function setSshInVars(action, vars){
    // non of these fields are required, check if the value is present. If so add it to the variables object
    const sshUser = (action.params.sshUsername || ``).trim();
    const sshPass = (action.params.sshPass || ``).trim();
    const sshKeyPath = (action.params.sshKeyPath || ``).trim();
    
    if (sshUser) vars.ansible_user = sshUser;
    if (sshPass) { vars.ansible_ssh_pass = sshPass; vars.ansible_connection = "ssh"; }
    if (sshKeyPath) { vars.ansible_ssh_private_key_file = sshKeyPath; vars.ansible_connection = "ssh"; }
}

function getAnsibleCmd(action){
    const playbookPath = (action.params.playbookPath || ``).trim();
    // check if playbook path exists
    if (!playbookPath){
        throw `Not given Playbook Path`;
    }
    // create an array of args to pass in the command
    let cmdArgs = [playbookPath];
    // push inventories and limit parameter to args
    textToArgs(action.params.inventories, '-i', cmdArgs);
    textToArgs(action.params.limit, '-l', cmdArgs);
    // parse the vars parameter to an object
    let vars = parseVars(action.params.vars);
    // set the ssh parameters as variables
    setSshInVars(action, vars);
    // push modules parameter to args
    textToArgs(action.params.modules, "-M", cmdArgs);
    // if the variables object is not empty, parse it to the cli argument format
    const varsArg = JSON.stringify(vars);
    if (varsArg !== `{}`){
        cmdArgs.push("-e", varsArg);
    }
    
    return cmdArgs;
}

module.exports = {
    runPlaybook
};