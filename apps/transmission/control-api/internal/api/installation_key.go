package api

import (
	"context"
	"fmt"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	// installationKeyCheckSecretKey is the associated data for the key check value.
	installationKeyCheckSecretKey = "installation-key-check"

	// installationKeyCheckValue is the known plaintext sealed as the key check value.
	installationKeyCheckValue = "transmission-vpn-installation-key-check"
)

// InstallationKeyResult describes what preparing the installation key did on this start.
//
// Removed names each saved secret that was locked with a lost key, in words for the
// container log; it is empty when the key was there or nothing depended on it.
type InstallationKeyResult struct {
	Key     []byte
	Created bool
	Removed []string
}

// removedSecretResponse describes one saved secret that a lost installation key took.
//
// A notification destination's entry also carries its name and identifier, so the
// notice can say which one to set up again.
type removedSecretResponse struct {
	Kind           string    `json:"kind"`
	Name           string    `json:"name,omitempty"`
	NotificationID string    `json:"notificationId,omitempty"`
	RemovedAt      time.Time `json:"removedAt"`
}

// PrepareInstallationKey loads the installation key, or makes a new one when the file
// is missing.
//
// A new key on a database that still holds secrets sealed with the old one removes
// those secrets and records them for the web interface before the key is saved, so an
// interrupted start can run again. A key file that belongs to another database stops
// startup with a message that says how to fix it.
func PrepareInstallationKey(
	ctx context.Context,
	store *storage.Store,
	path string,
) (InstallationKeyResult, error) {
	key, found, err := security.LoadInstallationKey(path)
	if err != nil {
		return InstallationKeyResult{}, err
	}

	if found {
		if err := verifyInstallationKey(ctx, store, key, path); err != nil {
			return InstallationKeyResult{}, err
		}
		if err := resealLegacyVPNCredentials(ctx, store, key); err != nil {
			return InstallationKeyResult{}, err
		}

		return InstallationKeyResult{Key: key}, nil
	}

	key, err = security.GenerateInstallationKey()
	if err != nil {
		return InstallationKeyResult{}, err
	}

	checkNonce, checkCiphertext, err := security.EncryptSecret(
		key,
		installationKeyCheckSecretKey,
		[]byte(installationKeyCheckValue),
	)
	if err != nil {
		return InstallationKeyResult{}, fmt.Errorf("seal installation key check: %w", err)
	}

	report, err := store.ReplaceInstallationKey(ctx, checkNonce, checkCiphertext)
	if err != nil {
		return InstallationKeyResult{}, err
	}
	if err := resealLegacyVPNCredentials(ctx, store, key); err != nil {
		return InstallationKeyResult{}, err
	}

	if err := security.SaveInstallationKey(path, key); err != nil {
		return InstallationKeyResult{}, err
	}

	removed := []string{}
	if report.VPN {
		removed = append(removed, "the VPN details for each connection")
	}
	for _, username := range report.AuthenticatorUsernames {
		removed = append(removed, "the authenticator app for "+username)
	}
	for _, name := range report.NotificationNames {
		removed = append(removed, "the "+name+" notification")
	}

	return InstallationKeyResult{
		Key:     key,
		Created: true,
		Removed: removed,
	}, nil
}

// verifyInstallationKey confirms that an existing key opens what the database holds.
//
// Databases written before the check value existed are tested with one sealed value,
// then get a check value so later starts compare against it directly.
func verifyInstallationKey(ctx context.Context, store *storage.Store, key []byte, path string) error {
	mismatch := fmt.Errorf(
		"the installation key at %s doesn't belong to this database. Put back the key file this database was created with, or delete %s and restart to make a new key, then enter the saved secrets again",
		path,
		path,
	)

	checkNonce, checkCiphertext, found, err := store.InstallationKeyCheck(ctx)
	if err != nil {
		return err
	}

	if found {
		value, decryptError := security.DecryptSecret(
			key,
			installationKeyCheckSecretKey,
			checkNonce,
			checkCiphertext,
		)
		if decryptError != nil || string(value) != installationKeyCheckValue {
			return mismatch
		}

		return nil
	}

	sample, found, err := store.SealedSample(ctx)
	if err != nil {
		return err
	}

	if found {
		secretKey := "vpn/profile/" + sample.ProfileID
		switch sample.Kind {
		case "vpn-connection":
			secretKey = "vpn/connection/" + sample.ConnectionID
			if sample.LegacyProfileID != "" {
				secretKey = "vpn/configuration/" + sample.LegacyProfileID
			}
		case "authenticator":
			secretKey = totpSecretKey(sample.AdministratorID, false)
		}

		plaintext, decryptError := security.DecryptSecret(key, secretKey, sample.Nonce, sample.Ciphertext)
		if decryptError != nil {
			return mismatch
		}
		clear(plaintext)
	}

	checkNonce, checkCiphertext, err = security.EncryptSecret(
		key,
		installationKeyCheckSecretKey,
		[]byte(installationKeyCheckValue),
	)
	if err != nil {
		return fmt.Errorf("seal installation key check: %w", err)
	}

	return store.SetInstallationKeyCheck(ctx, checkNonce, checkCiphertext)
}

// resealLegacyVPNCredentials authenticates migrated credentials under connection IDs.
//
// Storage handles an unreadable row as a recoverable lost secret, while this boundary
// keeps plaintext and installation-key operations out of the persistence package.
func resealLegacyVPNCredentials(
	ctx context.Context,
	store *storage.Store,
	installationKey []byte,
) error {
	return store.ResealLegacyVPNCredentials(
		ctx,
		func(
			connectionID string,
			legacyProfileID string,
			nonce []byte,
			ciphertext []byte,
		) ([]byte, []byte, error) {
			plaintext, err := security.DecryptSecret(
				installationKey,
				"vpn/configuration/"+legacyProfileID,
				nonce,
				ciphertext,
			)
			if err != nil {
				return nil, nil, err
			}
			defer clear(plaintext)

			return security.EncryptSecret(
				installationKey,
				"vpn/connection/"+connectionID,
				plaintext,
			)
		},
	)
}
