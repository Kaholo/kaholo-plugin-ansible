const child_process = require(`child_process`)

function textToArgs(text, argTail, argsArr){
    if (text){
        text.split('\n').forEach(function(arg){
            const fixed = arg.trim();
            if (fixed){
                argsArr.push(argTail, arg);
            }
        })
    }
}

function parseVars(varsParam){
    if (varsParam){
        if (typeof varsParam === "string"){
            let vars = {};
            // if the variables paramater was passed as string, suppose format is key=value pairs and parse it
            varsParam.split(`\n`).forEach(function(varLine) {
                const [key,...values] = varLine.split(`=`);
                if (!values){
                    throw "variables were passed in a bad format";
                }
                vars[key] = values.join('=');
            });
            return vars;
        }
        else if (typeof varsParam === "object"){    
            return varsParam;
        }
        else {
            throw "variables wasn't passed as string or object";
        }
    }
    return {};
}

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

module.exports = {
    textToArgs,
    runCLICommand,
    parseVars
}