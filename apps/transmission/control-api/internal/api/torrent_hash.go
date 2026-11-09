package api

import (
	"bytes"
	"crypto/sha1"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

const (
	maximumBencodeDepth        = 128
	maximumBencodeStringLength = 128 * 1024 * 1024
)

// torrentSourceHash extracts a known v1 info hash before Transmission sees an add.
func torrentSourceHash(filename string, metainfo []byte) (string, bool, error) {
	if len(metainfo) > 0 {
		hash, err := torrentMetainfoHash(metainfo)

		return hash, err == nil, err
	}
	if filename == "" {
		return "", false, nil
	}

	parsedURL, err := url.Parse(filename)
	if err != nil || !strings.EqualFold(parsedURL.Scheme, "magnet") {
		return "", false, nil
	}
	for _, exactTopic := range parsedURL.Query()["xt"] {
		const prefix = "urn:btih:"
		if !strings.HasPrefix(strings.ToLower(exactTopic), prefix) {
			continue
		}

		encodedHash := exactTopic[len(prefix):]
		switch len(encodedHash) {
		case 40:
			decoded, decodeError := hex.DecodeString(encodedHash)
			if decodeError != nil || len(decoded) != sha1.Size {
				return "", false, errors.New("magnet xt contains an invalid BitTorrent info hash")
			}

			return hex.EncodeToString(decoded), true, nil
		case 32:
			decoded, decodeError := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(
				strings.ToUpper(encodedHash),
			)
			if decodeError != nil || len(decoded) != sha1.Size {
				return "", false, errors.New("magnet xt contains an invalid BitTorrent info hash")
			}

			return hex.EncodeToString(decoded), true, nil
		default:
			return "", false, errors.New("magnet xt contains an invalid BitTorrent info hash")
		}
	}

	return "", false, nil
}

// torrentMetainfoHash hashes the exact bencoded info dictionary byte range.
func torrentMetainfoHash(content []byte) (string, error) {
	if len(content) == 0 || content[0] != 'd' {
		return "", errors.New("metainfo must contain a bencoded dictionary")
	}

	position := 1
	infoStart := -1
	infoEnd := -1
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return "", fmt.Errorf("decode metainfo key: %w", err)
		}
		position = next
		valueStart := position
		position, err = skipBencodeValue(content, position, 0)
		if err != nil {
			return "", fmt.Errorf("decode metainfo value: %w", err)
		}
		if string(key) == "info" {
			if infoStart >= 0 {
				return "", errors.New("metainfo contains more than one info dictionary")
			}
			infoStart = valueStart
			infoEnd = position
		}
	}
	if position >= len(content) || content[position] != 'e' {
		return "", errors.New("metainfo dictionary is incomplete")
	}
	if infoStart < 0 || infoEnd <= infoStart || content[infoStart] != 'd' {
		return "", errors.New("metainfo does not contain an info dictionary")
	}

	digest := sha1.Sum(content[infoStart:infoEnd])

	return hex.EncodeToString(digest[:]), nil
}

// torrentMetainfoName reads info.name without decoding unrelated metainfo values.
func torrentMetainfoName(content []byte) (string, error) {
	if len(content) == 0 || content[0] != 'd' {
		return "", errors.New("metainfo must contain a bencoded dictionary")
	}

	position := 1
	infoStart := -1
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return "", fmt.Errorf("decode metainfo key: %w", err)
		}
		position = next
		valueStart := position
		position, err = skipBencodeValue(content, position, 0)
		if err != nil {
			return "", fmt.Errorf("decode metainfo value: %w", err)
		}
		if string(key) == "info" {
			if infoStart >= 0 {
				return "", errors.New("metainfo contains more than one info dictionary")
			}
			infoStart = valueStart
		}
	}
	if infoStart < 0 || infoStart >= len(content) || content[infoStart] != 'd' {
		return "", errors.New("metainfo does not contain an info dictionary")
	}

	position = infoStart + 1
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return "", fmt.Errorf("decode metainfo info key: %w", err)
		}
		position = next
		if string(key) == "name" {
			name, _, nameError := readBencodeString(content, position)
			if nameError != nil || len(name) == 0 {
				return "", errors.New("metainfo info.name is invalid")
			}

			return strings.ToValidUTF8(string(name), "�"), nil
		}
		position, err = skipBencodeValue(content, position, 1)
		if err != nil {
			return "", fmt.Errorf("decode metainfo info value: %w", err)
		}
	}

	return "", errors.New("metainfo info.name is missing")
}

// skipBencodeValue validates and advances over one bounded bencoded value.
func skipBencodeValue(content []byte, position int, depth int) (int, error) {
	if position >= len(content) {
		return position, errors.New("bencoded value is missing")
	}
	if depth > maximumBencodeDepth {
		return position, errors.New("bencoded value is nested too deeply")
	}

	switch content[position] {
	case 'i':
		_, next, err := readBencodeInteger(content, position)

		return next, err
	case 'l':
		position++
		for position < len(content) && content[position] != 'e' {
			var err error
			position, err = skipBencodeValue(content, position, depth+1)
			if err != nil {
				return position, err
			}
		}
		if position >= len(content) {
			return position, errors.New("bencoded list is incomplete")
		}

		return position + 1, nil
	case 'd':
		position++
		for position < len(content) && content[position] != 'e' {
			_, next, err := readBencodeString(content, position)
			if err != nil {
				return position, err
			}
			position, err = skipBencodeValue(content, next, depth+1)
			if err != nil {
				return position, err
			}
		}
		if position >= len(content) {
			return position, errors.New("bencoded dictionary is incomplete")
		}

		return position + 1, nil
	default:
		_, next, err := readBencodeString(content, position)

		return next, err
	}
}

// readBencodeInteger returns one canonical signed integer and its next position.
//
// Preview size parsing and the general value scanner share this validation so
// malformed lengths cannot be interpreted differently by adjacent workflows.
func readBencodeInteger(content []byte, position int) (int64, int, error) {
	if position < 0 || position >= len(content) || content[position] != 'i' {
		return 0, position, errors.New("bencoded integer is invalid")
	}

	end := bytes.IndexByte(content[position+1:], 'e')
	if end < 0 {
		return 0, position, errors.New("bencoded integer is incomplete")
	}
	integerText := string(content[position+1 : position+1+end])
	if integerText == "" || integerText == "-0" ||
		(strings.HasPrefix(integerText, "0") && len(integerText) > 1) ||
		strings.HasPrefix(integerText, "-0") {
		return 0, position, errors.New("bencoded integer is invalid")
	}

	value, err := strconv.ParseInt(integerText, 10, 64)
	if err != nil {
		return 0, position, errors.New("bencoded integer is invalid")
	}

	return value, position + end + 2, nil
}

// readBencodeString returns one length-prefixed byte string without copying it.
func readBencodeString(content []byte, position int) ([]byte, int, error) {
	if position < 0 || position >= len(content) {
		return nil, position, errors.New("bencoded string length is invalid")
	}

	colonOffset := bytes.IndexByte(content[position:], ':')
	if colonOffset <= 0 {
		return nil, position, errors.New("bencoded string length is invalid")
	}
	lengthBytes := content[position : position+colonOffset]
	for _, character := range lengthBytes {
		if character < '0' || character > '9' {
			return nil, position, errors.New("bencoded string length is invalid")
		}
	}
	length, err := strconv.ParseUint(string(lengthBytes), 10, 64)
	if err != nil || length >= maximumBencodeStringLength {
		return nil, position, errors.New("bencoded string length is invalid")
	}
	start := position + colonOffset + 1
	if length > uint64(len(content)-start) {
		return nil, position, errors.New("bencoded string is incomplete")
	}
	end := start + int(length)

	return content[start:end], end, nil
}
