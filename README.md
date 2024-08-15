Transmission VPN
=================

[![GitHub Releases](https://img.shields.io/github/v/release/mrjackyliang/transmission-vpn?style=flat-square&logo=github&logoColor=%23ffffff&color=%23b25da6)](https://github.com/mrjackyliang/transmission-vpn/releases)
[![GitHub Top Languages](https://img.shields.io/github/languages/top/mrjackyliang/transmission-vpn?style=flat-square&logo=gnubash&logoColor=%23ffffff&color=%236688c3)](https://github.com/mrjackyliang/transmission-vpn)
[![GitHub License](https://img.shields.io/github/license/mrjackyliang/transmission-vpn?style=flat-square&logo=googledocs&logoColor=%23ffffff&color=%2348a56a)](https://github.com/mrjackyliang/transmission-vpn/blob/main/LICENSE)
[![Become a GitHub Sponsor](https://img.shields.io/badge/github-sponsor-gray?style=flat-square&logo=githubsponsors&logoColor=%23ffffff&color=%23eaaf41)](https://github.com/sponsors/mrjackyliang)
[![Donate via PayPal](https://img.shields.io/badge/paypal-donate-gray?style=flat-square&logo=paypal&logoColor=%23ffffff&color=%23ce4a4a)](https://liang.nyc/paypal)

This is a special script for Synology NAS that helps you force Transmission's connection under the VPN you specify. It works with L2TP, PPTP, and OpenVPN connections. The script connects to VPN then sets Transmission to your VPN port. If it cannot find one, it will shut off VPN and prevent Transmission from working.

__In other words, Transmission ONLY connects to VPN while other applications DO NOT!__

To use this script, here are the steps you need to follow:
1. Create the VPN using DiskStation Manager
2. Install Transmission from SynoCommunity's repo
3. Fill out the VPN Settings/Optionals (below)

## Retrieve Variables
These are the descriptions of the variables that may be changed depending on your configuration. Examples are located below and inside the script (`transmission-vpn.sh`). __If you need help, feel free to [open an issue](https://github.com/mrjackyliang/transmission-vpn/issues/new/choose) on GitHub!__

##### VPN Settings
1. __VPN_CONFID__ - Synology Configuration ID (e.g. l1234567890, instructions below)
2. __VPN_CONFNAME__ - Synology Configuration Name (l2tpclient, pptpclient, or ovpnclient)
3. __VPN_PROTO__ - Synology Protocol (l2tp, pptp, or openvpn)
4. __VPN_UINAME__ - Synology VPN Name (Control Panel > Network > Network Interface)

##### VPN Optionals
1. __VPN_TYPE__ - The type of connection you will route though (__ppp__ for L2TP/PPTP VPN, or __tun__ for OpenVPN)
2. __VPN_INTERFACE__ - The default interface you will be connecting to (__ppp0__ for L2TP/PPTP, or __tun0__ for OpenVPN)
3. __VPN_RETRY__ - How many retries (times) if VPN fails to connect (default is __10__)
4. __VPN_INTERVAL__ - The time (in seconds) to wait between each retry (default is __30__)

##### VPN Features
1. __PORT_FWD__ - Carries an additional port forwarding check (default is empty, 51413 for Transmission default)
2. __IP_CHECK__ - Which URL to use to check your external IP address (default is http://ipinfo.io/ip)

##### App Settings
1. __TRANS_USER__ - The user running under Transmission (default is __sc-transmission__)
2. __TRANS_GROUP__ - The group of Transmission's user (default is __transmission__)
3. __TRANS_VAR__ - Path where the settings.json file is located (full path, no ending backslash)

## Get Synology Configuration ID
To retrieve the VPN_CONFID, follow these steps:

1. SSH or Telnet into your Synology DiskStation
2. Type __cd /usr/syno/etc/synovpnclient/__
3. Type __cd PROTOCOL__ (Replace PROTOCOL with l2tp, openvpn, or pptp)
4. Type in __ls -l__ to list out the files
5. Find a file called __connect_l1234567890__
6. Copy the text __l1234567890__ to the VPN_CONFID above
7. Type __exit__ once to logout of SSH or Telnet

__Note:__ The "__l1234567890__" ID is an example. Each configuration ID (per VPN connection) is UNIQUE and YOU MUST connect to your Synology NAS though SSH or Telnet to retrieve it.

## Task Scheduling
If you want to automate the script, you can use the Task Scheduler application provided inside the DiskStation Manager. Make sure the script is ran under root to prevent any issues occurring.

This script is purely useful for checking if your Transmission connection is working properly, and breaks Transmission if the VPN connection is off to prevent a leak. Here is one scenario where I would use it:

* Run __/volume1/transmission-vpn.sh repair__ every 1 or 5 minutes

## How to Use this Script
Before you use this script, use the following commands:
1. __sh transmission-vpn.sh install__ - Installer. Stops VPN, binds 127.0.0.1 to Transmission
2. __sh transmission-vpn.sh uninstall__ - Uninstaller. Stops VPN, binds 0.0.0.0 to Transmission

To run this script, use the following commands:
1. __sh transmission-vpn.sh start__ - Start. Starts the VPN, binds VPN address to Transmission
2. __sh transmission-vpn.sh stop__ - Stop. Stops the VPN, binds 127.0.0.1 to Transmission
3. __sh transmission-vpn.sh repair__ - Repair. Fixes stalled VPNs, decides which IP address to bind

__Note:__ If the script is located in /volume1/examplefolder/, navigate to that folder (using the __cd__ command) before executing the commands above.

## No Internet Bug Fix
If this script took Transmission offline (cannot download), follow the instructions below:
1. In your DiskStation Manager
2. Go to Control Panel > Network > General
3. Click __Advanced Settings__
4. Check __Enable Multiple Gateways__
5. Click __OK__ then __Apply__

__Note:__ Once this setting is enabled, you do not need to re-run the script. The internet for Transmission will start working immediately.

## Wrong VPN Interface
When running the start script for the first time, you might come across this error: `ppp0: error fetching interface information: Device not found`.

Here's how you can fix this issue:
1. In your DiskStation Manager
2. Go to Control Panel > Network > Network Interface
3. Select your VPN, then click __Connect__
4. Once connected, SSH or Telnet into your NAS
5. Type __ifconfig__ into the Terminal
6. Find the VPN interface. It should NOT be `eth0` or `lo`
7. Copy the interface name (left of `Link encap:`)
8. Replace the VPN_INTERFACE with the copied interface name
9. Restart the Transmission VPN script

## Port Forwarding Limitations
If the script returns `Network Port is closed` every time you run the repair script, please check if your VPN is connected behind a NAT device.

The script does not support checking ports behind NAT, as it will simply mark the specified port as `closed`. If the VPN is behind a NAT device, make sure the `PORT_FWD` variable is blank.

__Note:__ The repair script will fail/restart when `PORT_FWD` is not empty while behind NAT.
