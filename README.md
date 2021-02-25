# kaholo-plugin-ansible
Kaholo plugin for Ansible.

## How to use:
After you install the plugin on Kaholo,
make sure your agent runs on a linux enviroment and has Ansible insttaled.

## Method: Run Playbook
Execute an Ansible playbook. 

### Parameters
1) Playbook Path(required): The path to the Ansible playbook to execute.
2) Inventories: The host Ansible inventories to run the playbook on. Can enter either a [host pattern](https://docs.ansible.com/ansible/latest/user_guide/intro_patterns.html) or the path to a host file. You can enter multiple values, by seprating each with a new line.
3) SSH Username - Username for authentication with SSH.
4) SSH Password - Password for authentication with SSH. This is a vault type so you have to enter it's value to the Kaholo vault first.
5) Modules - The path(s) to module library. You can enter multiple values, by seprating each with a new line.
    Default is `~/.ansible/plugins/modules:/usr/share/ansible/plugins/modules`
6) Variables - Any extra variables to define outside of the playbook. You can enter the variables either as key=value pairs, or 
    in a JSON format. When passed as key value pair, you can enter multiple vars by sepeating each pair in a new line.