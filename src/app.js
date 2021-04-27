const { textToArgs, runCLICommand, parseVars } = require('./helpers');

async function runPlaybook(action){
    const cmd = getAnsibleCmd(action);
    return runCLICommand(cmd);
}

function setSshInVars(action, vars){
    // check if ssh username was passed. If so also check for ssh pass, and add it to the variables object
    const sshUser = (action.params.sshUsername || ``).trim();
    const sshPass = (action.params.sshPass || ``).trim();
    if (sshUser){
        if (!sshPass){
            throw "SSH password was expected but not provided";
        }
        vars.ansible_connection = "ssh";
        vars.ansible_user = sshUser;
        vars.ansible_ssh_pass = sshPass;
    }
    else if (sshPass){
        throw "SSH username was expected but not provided";
    }
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
        cmdArgs.push("--extra-vars", varsArg)
    }
    
    return `ansible-playbook ${cmdArgs.join(` `)}`;
}

module.exports = {
    runPlaybook
};
