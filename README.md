transmissionVPN
================

This is a Transmission + VPN script for Synology NAS devices. Its entire purpose is to connect to a VPN of your choice (L2TP, PPTP, or OpenVPN) then checks the VPN interface's IP address and binds it to the Transmission configuration file.

__In other words, Transmission ONLY connects to VPN while other applications DO NOT!__

To use this script, you must first create the VPN using DiskStation Manager and install Transmission from SynoCommunity's repository. After all that, then change the variables in this script.

## Retrieve Variables
You must retrieve the required settings before the script works. Here are the variables that may be changed depending on your configuration. Examples will be provided inside the script.

Please follow the exact format unless you know what you're doing. Some variables DO NOT need to be changed, but are provided in case you do. __If you need help, feel free to open an issue on GitHub!__

##### VPN Settings
1. __VPN_CONFID__ - Synology Configuration ID (Instructions Below)
2. __VPN_CONFNAME__ - Synology Configuration Name (l2tpclient, pptpclient, ovpnclient)
3. __VPN_PROTO__ - Synology Protocol (l2tp, pptp, openvpn)
4. __VPN_UINAME__ - Synology VPN Profile Name (Found in Control Panel > Network > Network Interface)

##### VPN Optionals
1. __VPN_TYPE__ - The type of connection you will route though (__ppp__ for L2TP/PPTP VPN, or __tun__ for OpenVPN)
2. __VPN_INTERFACE__ - The default interface you will be connecting to (__ppp0__ for L2TP/PPTP, or __tun0__ for OpenVPN)
3. __VPN_RETRY__ - How many retries (times) if VPN fails to connect (default is 10)
4. __VPN_INTERVAL__ - The time (in seconds) to wait between each retry (default is 30)

##### App Settings
1. __TRANS_USER__ - The user running under Transmission
2. __TRANS_GROUP__ - The group of Transmission's user
3. __TRANS_VAR__ - Path where the settings.json file is located (Full Path, no ending backslash)
4. __TRANS_SSSS__ - Path where the Transmission start-stop-status file is located (Full Path, no ending backslash)

## Get Synology Configuration ID
To retrieve the __VPN_CONFID__, follow these steps:

1. SSH or Telnet into __/usr/syno/etc/synovpnclient/__
2. Type cd PROTOCOL (Replace PROTOCOL with l2tp, openvpn, or pptp)
3. Type in __ls -l__ to list out the files
4. Find a file called __connect_l4758264759__
5. __l1234567890__ is your Configuration ID
6. Copy the text __l1234567890__ to the variable above

NOTE 1: __l1234567890__ is an example. Each configuration ID is unique and YOU must connect to your Synology NAS though SSH or Telnet to retrieve it.

NOTE 2: If you have more than one of the same protocol connections (e.g. two L2TP VPNs), you can use __vim__ or __nano__ (install it with SynoCommunity's repo) to dig around the files to find the correct Configuration ID. __EXPERIENCED USERS ONLY!__

## Scheduling
If you want to automate the script, you can use the Task Scheduler application provided inside the DiskStation Manager. Make sure the script is ran under root to prevent any issues occurring.

## How to use
Before you use this script, use the following commands:

1. __transmissionvpn.sh install__ - INSTALLER. Stops VPN, binds 127.0.0.1 to Transmission
2. __transmissionvpn.sh uninstall__ - UNINSTALLER. Stops VPN, binds 0.0.0.0 to Transmission

To run this script, use the following commands:

1. __transmissionvpn.sh start__ - Starts the VPN, binds VPN address to Transmission
2. __transmissionvpn.sh stop__ - Stops the VPN, binds 127.0.0.1 to Transmission
3. __transmissionvpn.sh repair__ - Fixes stalled VPNs, decides which IP address to bind