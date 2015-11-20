transmissionVPN
================

This is a Transmission + VPN script for Synology NAS devices. It's entire purpose is to connect to a VPN of your choice (L2TP, PPTP, or OpenVPN) then checks the interface's IP address and binds it to the Transmission configuration file.

To use this script, you must first create the VPN using DiskStation Manager and install Transmission from SynoCommunity's repository. Then change the variables in this script.

## Retrieve Variables
By default, you must retrieve these bits of information before the script works. This requires basic knowledge of SSH. Here are the variables that may be changed depending on your configuration. Examples will be contained inside the file. Please follow the exact format.

__VPN_CONFID__ - Synology Configuration ID (Instructions Below)

__VPN_CONFNAME__ - Synology Configuration Name (l2tpclient, pptpclient, ovpnclient)

__VPN_PROTO__ - Synology Protocol (l2tp, pptp, openvpn)

__VPN_UINAME__ - Synology VPN Profile Name (Found in Control Panel > Network > Network Interface)

__TRANS_USER__ - The user running under Transmission

__TRANS_GROUP__ - The group of Transmission's user

__TRANS_VAR__ - Path where the settings.json file is located (Full Path, no ending backslash)

__TRANS_SSSS__ - Path where the Transmission start-stop-status file is located (Full Path, no ending backslash)

## Get Synology Configuration ID
To retrieve the __VPN_CONFID__, follow these steps:

1. SSH into __/usr/syno/etc/synovpnclient/__
1. Type cd YOUR_PROTOCOL (l2tp, openvpn, or pptp)
1. Type in __ls -l__ to list out the files
1. Find a file called connect_l4758264759 (something similar)
1. __l4758264759__ is your Configuration ID

NOTE: If you have more than one of the same protocol connections (e.g. Two L2TP VPNs), use __vim__ or __nano__ to dig around the files and find the correct Configuration ID.

## Scheduling
If you want to automate the script, you can use the Task Scheduler application provided inside the DiskStation Manager. Make sure the script is ran under root to prevent any issues.

To run this script, use __transmissionvpn.sh start__ or __transmissionvpn.sh stop__
