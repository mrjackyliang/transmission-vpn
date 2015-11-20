# Transmission VPN for Synology NAS
# ----------------------------------
# VPN Settings
VPN_CONFID=l1234567890
VPN_CONFNAME=l2tpclient
VPN_PROTO=l2tp
VPN_UINAME=VPN

# System Settings
TRANS_USER=transmission
TRANS_GROUP=users
TRANS_VAR=/volume1/@appstore/transmission/var
TRANS_SSSS=/var/packages/transmission/scripts/start-stop-status

# Script Starts
case "$1" in
start)
    if echo `ifconfig` | grep -q "ppp"; then
        echo "VPN is connected!"
    else
        echo "VPN is connecting ..."
        echo conf_id=$VPN_CONFID > /usr/syno/etc/synovpnclient/vpnc_connecting
        echo conf_name=$VPN_CONFNAME >> /usr/syno/etc/synovpnclient/vpnc_connecting
        echo proto=$VPN_PROTO >> /usr/syno/etc/synovpnclient/vpnc_connecting
        synovpnc reconnect --protocol=$VPN_PROTO --name=$VPN_UINAME --retry=10 --interval=30

        if echo `ifconfig` | grep -q "ppp"; then
            # Show Success Message
            echo "VPN is connected!"

            # Get VPN IP Address
            VPN_ADDR=`ifconfig ppp0 | grep 'inet addr:' | cut -d: -f2 | awk '{ print $1}'`
            echo "VPN Address is "$VPN_ADDR

            # Stops Transmission
            $TRANS_SSSS stop

            # Binds IPv4 Address to ppp0
            echo "Binding IPv4 VPN Address ..."
            cat $TRANS_VAR/settings.json | sed "s/.*bind-address-ipv4.*/    \"bind-address-ipv4\"\: \"$VPN_ADDR\",/g" > $TRANS_VAR/settings.json.bak
            chmod 600 $TRANS_VAR/settings.json.bak
            chown $TRANS_USER:$TRANS_GROUP $TRANS_VAR/settings.json.bak
            mv $TRANS_VAR/settings.json.bak $TRANS_VAR/settings.json

            # Starts Transmission
            $TRANS_SSSS start
        else
            echo "ERROR 1000: VPN cannot be connected."
            exit 1
        fi
    fi
;;
stop)
    if echo `ifconfig` | grep -q "ppp"; then
        echo "VPN is disconnecting ..."
        synovpnc kill_client

        if echo `ifconfig` | grep -q "ppp"; then
            echo "ERROR 1001: VPN cannot be disconnected."
            exit 1
        else
            # Stops Transmission
            $TRANS_SSSS stop

            # Binds IPv4 Address to ppp0
            echo "Binding IPv4 Home Address ..."
            cat $TRANS_VAR/settings.json | sed "s/.*bind-address-ipv4.*/    \"bind-address-ipv4\"\: \"127.0.0.1\",/g" > $TRANS_VAR/settings.json.bak
            chmod 600 $TRANS_VAR/settings.json.bak
            chown $TRANS_USER:$TRANS_GROUP $TRANS_VAR/settings.json.bak
            mv $TRANS_VAR/settings.json.bak $TRANS_VAR/settings.json

            # Starts Transmission
            $TRANS_SSSS start
        fi
    else
        echo "VPN is disconnected!"
    fi
;;
*)
    echo "TransmissionVPN Usage: {start|stop}"
    exit 1
esac

exit 0