<?php
/**
 * Port forwarding check.
 *
 * @since 1.0.0
 */
$host = $argv[1];
$port = $argv[2];

$connection = @fsockopen( $host, $port, $errno, $errstr, 10 );

if ( is_resource( $connection ) ) {
	echo 'open' . "\n";
	fclose( $connection );
} elseif ( empty( $port ) ) {
	echo 'empty' . "\n";
} else {
	echo 'closed' . "\n";
}