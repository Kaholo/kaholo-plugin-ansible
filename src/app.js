const child_process = require(`child_process`)

async function runCLICommand(command){
	return new Promise((resolve,reject) => {
		child_process.exec(command, (error, stdout, stderr) => {
			if (error) {
			   return reject(`exec error: ${error}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			return resolve(stdout);
		});
	})
}

function getAnsibleCmd(action){
    const playbookPath = (action.params.playbookPath || ``).trim();
    // check if playbook path exists
    if (!playbookPath){
        throw `Not given Playbook Path`;
    }
    // create an array of args to pass in the command
    let cmdArgs = [playbookPath];
    // if inventories parameter was passed parse it to the cli argument format
    const inventories = (action.params.inventories || ``).trim();
    if (inventories){
        inventories.split(`\n`).forEach(function(inventory) {
            if (inventory){
                cmdArgs.push(`-i ${inventory.trim()}`);
            }
        });
    }
    let vars = {};
    // check if the variables parameter was passed. If so, parse it to an object
    const paramVars = (action.params.vars || ``).trim();
    if (paramVars){
        if (typeof paramVars === "string"){
            // if the variables paramater was passed as string, suppose format is key=value pairs and parse it
            paramVars.split(`\n`).forEach(function(paramVar) {
                const [key,...values] = paramVar.split(`=`);
                if (!values){
                    throw "variables were passed in a bad format";
                }
                vars[key] = values.join('=');
            });
        }
        else if (typeof paramVars === "object"){    
            for (var key in paramVars){
                if (paramVars.hasOwnProperty(key)) {
                    vars[key] = paramVars[key];
                }
            }
        }
        else {
            throw "variables wasn't passed as string or object";
        }
    }
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
    // check if modules paramater was passed, and if so parse it to the cli argument format
    const modules = (action.params.modules || ``).trim();
    if (modules){
       modules.split(`\n`).forEach(mod => {
            if (mod){
                cmdArgs.push(`-M ${mod.trim()}`)
            }
       });
    }
    // if the variables object is not empty, parse it to the cli argument format
    const varsArg = JSON.stringify(vars);
    if (varsArg !== `{}`){
        cmdArgs.push(`--extra-vars '${varsArg}'`)
    }
    
    return `ansible-playbook ${cmdArgs.join(` `)}`;
}

async function runPlaybook(action){
    const cmd = getAnsibleCmd(action);
    return runCLICommand(cmd);
}


module.exports = {
    runPlaybook,
    getAnsibleCmd
};
