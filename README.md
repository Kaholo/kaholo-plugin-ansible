# Kaholo Ansible Plugin
This plugin adds [Ansible](https://www.ansible.com/) functionality to Kaholo pipelines.

Ansible is an open-source software provisioning, configuration management, and application-deployment tool enabling infrastructure as code. It is agentless, and as such relies primarily on SSH and python, or in the case of Windows, WinRM and Powershell. The instructions, hosts on which to act, variables, roles and such are organized into what is called an Ansible playbook. This plugin runs `ansible-playbook site.yml`, where site.yml is the defacto standard name for the main playbook. A file in the same folder named ansible.cfg is often responsible for locating the inventory, typically named `hosts` and in the same folder as the main playbook, and also roles, variables, and various other details that ansible needs, such as the SSH key and username used to access managed nodes in the inventory.

It is possible to run ansible specifying inventory, SSH user and key, variables, roles and such using the command line but this is generally not a best practice. The plugin has a parameter "Additional Command Line Arguments" that allows you to run ansible anyway you wish, but it is recommended to organize your playbooks such that the only command line argument required is the location of the main playbook.

The location of the SSH key and ansible username password is commonly defined using variables in the inventory file, usually named `hosts`, and is discovered on account of the ansible.cfg in the same directory as the main playbook. For example:

    [all:vars]
    ansible_connection=ssh
    ansible_user=ubuntu
    ansible_ssh_private_key_file=./keys/mysshkey.pem

This requires the SSH key to be available to Ansible within the Ansible playbook's directory. Also Ansible does not support encrypting this key with Ansible vault so it presents somewhat of a security dillemna - Ansible is designed to be configuration as code, and if the SSH key is in the playbook, then it would seem to be checked in as code, a notoriously bad security practice. **A future release of the Ansible plugin will address this** by delivering the key to the playbook from the Kaholo Vault and securely deleting after the playbook has run. Meanwhile, as a work-around, it is suggested that the Text Editor plugin be used with method "Create File From Vault" to deliver the SSH key to the playbook, and then Command Line plugin to chmod 400 the key file. Or you may simply check your SSH key into code (inside the playbook) if confident the security risk is carefully managed or otherwise acceptable.

## Use of Docker
This plugin relies on the [Will Hall Online](https://www.willhallonline.co.uk/) [Ansible docker image](https://hub.docker.com/r/willhallonline/ansible) to run Ansible within a docker container. This has many upsides but a few downsides as well of which the user should be aware.

If running your own Kaholo agents in a custom environment, you will have to ensure docker is installed and running on the agent and has sufficient privilege to retrieve the image and start a container. If the agent is already running in a container (kubernetes or docker) then this means a docker container running within another container.

The first time the plugin is used on each agent, docker may spend a minute or two downloading the docker image. After that the delay of starting up another docker image each time is quite small, just a second or two.

Next, because the Ansible is running inside a docker container, it will not have access to the filesystem on the agent. If for example you have used the Git plugin to clone a repository of playbooks to the agent, with the main playbook located at `/home/ansible/myplaybook/site.yml`, Ansible will be able to access only files within the directory `/home/ansible/myplaybook`. This means for example your SSH key needs to be in that directory or declared in a relative path within that directory, e.g. `./keys/mykey.pem`. If the key is located elsewhere it will not be found.

Also, the docker image configuration does strict host key checking with SSH keys, so you may find it necessary to override this using the ansible.cfg in your playbook:

    [defaults]
    host_key_checking = False

Should these limitations negatively impact on your use case, Ansible can be installed on the agent and run via the Command Line plugin instead. A main purpose for this plugin is to help you avoid that inconvenience. Please [let us know](https://kaholo.io/contact/) if you encounter a use case that the plugin does not adequately accomodate.

## Plugin Installation
For download, installation, upgrade, downgrade and troubleshooting of plugins in general, see [INSTALL.md](./INSTALL.md).

## Method: Run Playbook
Ideally, if your playbook is well organized all that is needed to run the playbook is a path to the main playbook file, typically named site.yml. There are however additional optional parameters for use in various special circumstances, such as using passwords from the Kaholo Vault, and then there is "Additional Command Line Arguments", which accomodates every imaginable `ansible-playbook` use case.

### Parameters
1. Playbook Path (String) **Required** - The path to the main Ansible playbook file, typically named site.yml. All other files and roles used by the playbook must be located within the directory of this file or a subdirectory.
1. Ansible Vault Password File (Vault) **Optional** - if using Ansible vault to conceal secrets in code a password is needed to decrypt them at run time. If you store this password in the Kaholo vault, you may use this parameter to securely provide the vault password when the playbook runs, equivalent to `--vault-password-file`. If your playbook normally runs with `--ask-vault-password`, simply store the password in the Kaholo Vault and use it with this parameter and it will have the same effect. The difference is that this parameter writes it to a file for use by `ansible-playbook` and then securely deletes it after the playbook has run.
1. SSH Password (Vault) **Optional** - Password for authenticating with SSH. This is not commonly required.
1. Additional Command Line Arguments (String) **Optional** - this accomodates ansible-playbook use cases not adequately covered by other parameters, things not adequately designed into the playbook, and any over-rides or run-time options you may wish to build into the pipeline itself.