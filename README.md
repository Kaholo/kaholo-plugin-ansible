# kaholo-plugin-ansible
Kaholo plugin for Ansible.

## How to use:
After you install the plugin on Kaholo,
make sure your agent runs on a linux enviroment and has Ansible installed.

## Method: Run Playbook
Execute an Ansible playbook. 

### Parameters
1. Playbook Path (String) **Required** - The path to the Ansible playbook to execute.
2. SSH Username (String) **Optional** - Username for authenticating with SSH.
3. SSH Password (Vault) **Optional** - Password for authenticating with SSH. 
4. Inventories (Text) **Optional** - The path(s) to the Ansible inventory file(s) to run the playbook on. Doesn't limit the playbook to run on any other playbooks specified in the yml You can enter multiple values, by seprating each with a new line.
5. Limit (Text) **Optional** - The path(s) to the Ansible inventory file(s) to limit the playbook to run only on them. You can enter multiple values, by seprating each with a new line.
6. Modules (Text) **Optional** - The path(s) to your modules directory. You can enter multiple values, by seprating each with a new line or with ':'.
7. Variables (Text) **Optional** - Any extra variables to define outside of the playbook. You can enter the variables either as key=value pairs, or pass an object in the following format *{varName: value, anotherVar: val2}*. When passed as key value pair, enter multiple variables by sepeating each pair with a new line.