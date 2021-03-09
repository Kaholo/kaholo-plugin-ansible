const child_process = require(`child_process`)
const { getAnsibleCmd } = require('./helpers');

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

async function runPlaybook(action){
    const cmd = getAnsibleCmd(action);
    return runCLICommand(cmd);
}

module.exports = {
    runPlaybook
};
