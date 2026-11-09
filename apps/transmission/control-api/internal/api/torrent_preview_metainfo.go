package api

import (
	"errors"
	"fmt"
	"math"
)

// torrentMetainfoPreview reads the user-visible fields from one metainfo file.
//
// Name and size are parsed without materializing piece data, while the hash keeps
// using the exact bencoded info byte range required by the BitTorrent protocol.
func torrentMetainfoPreview(content []byte) (string, int64, string, error) {
	name, err := torrentMetainfoName(content)
	if err != nil {
		return "", 0, "", err
	}

	totalSize, err := torrentMetainfoSize(content)
	if err != nil {
		return "", 0, "", err
	}

	hash, err := torrentMetainfoHash(content)
	if err != nil {
		return "", 0, "", err
	}

	return name, totalSize, hash, nil
}

// torrentMetainfoSize sums single-file, multi-file, or v2 file-tree lengths.
//
// Hybrid torrents use their v1 file list once, preventing their mirrored v2 tree
// from being counted a second time.
func torrentMetainfoSize(content []byte) (int64, error) {
	infoStart, err := torrentMetainfoInfoStart(content)
	if err != nil {
		return 0, err
	}

	position := infoStart + 1
	var singleLength int64
	hasSingleLength := false
	filesStart := -1
	fileTreeStart := -1
	for position < len(content) && content[position] != 'e' {
		key, next, readError := readBencodeString(content, position)
		if readError != nil {
			return 0, fmt.Errorf("decode metainfo info key: %w", readError)
		}
		position = next
		valueStart := position
		position, readError = skipBencodeValue(content, position, 1)
		if readError != nil {
			return 0, fmt.Errorf("decode metainfo info value: %w", readError)
		}

		switch string(key) {
		case "length":
			if hasSingleLength {
				return 0, errors.New("metainfo info.length is repeated")
			}
			singleLength, _, readError = readBencodeInteger(content, valueStart)
			if readError != nil || singleLength < 0 {
				return 0, errors.New("metainfo info.length is invalid")
			}
			hasSingleLength = true
		case "files":
			filesStart = valueStart
		case "file tree":
			fileTreeStart = valueStart
		}
	}

	if hasSingleLength && filesStart >= 0 {
		return 0, errors.New("metainfo contains both single-file and multi-file lengths")
	}
	if hasSingleLength {
		return singleLength, nil
	}
	if filesStart >= 0 {
		return torrentMetainfoVersionOneSize(content, filesStart)
	}
	if fileTreeStart >= 0 {
		totalSize, fileCount, _, treeError := torrentMetainfoFileTreeSize(
			content,
			fileTreeStart,
			0,
		)
		if treeError != nil {
			return 0, treeError
		}
		if fileCount == 0 {
			return 0, errors.New("metainfo info.file tree contains no files")
		}

		return totalSize, nil
	}

	return 0, errors.New("metainfo info contains no file length")
}

// torrentMetainfoVersionOneSize sums every file dictionary's required length.
//
// File path values are skipped by the bounded scanner because preview only needs
// the aggregate bytes and never exposes names below the torrent root.
func torrentMetainfoVersionOneSize(content []byte, position int) (int64, error) {
	if position >= len(content) || content[position] != 'l' {
		return 0, errors.New("metainfo info.files is invalid")
	}

	position++
	totalSize := int64(0)
	fileCount := 0
	for position < len(content) && content[position] != 'e' {
		if content[position] != 'd' {
			return 0, errors.New("metainfo file entry is invalid")
		}
		position++
		length := int64(0)
		hasLength := false
		for position < len(content) && content[position] != 'e' {
			key, next, err := readBencodeString(content, position)
			if err != nil {
				return 0, fmt.Errorf("decode metainfo file key: %w", err)
			}
			position = next
			if string(key) == "length" {
				if hasLength {
					return 0, errors.New("metainfo file length is repeated")
				}
				length, position, err = readBencodeInteger(content, position)
				if err != nil || length < 0 {
					return 0, errors.New("metainfo file length is invalid")
				}
				hasLength = true

				continue
			}

			position, err = skipBencodeValue(content, position, 2)
			if err != nil {
				return 0, fmt.Errorf("decode metainfo file value: %w", err)
			}
		}
		if position >= len(content) || content[position] != 'e' {
			return 0, errors.New("metainfo file entry is incomplete")
		}
		if !hasLength {
			return 0, errors.New("metainfo file length is missing")
		}

		var addError error
		totalSize, addError = addTorrentPreviewSize(totalSize, length)
		if addError != nil {
			return 0, addError
		}
		fileCount++
		position++
	}
	if position >= len(content) || content[position] != 'e' || fileCount == 0 {
		return 0, errors.New("metainfo info.files is incomplete")
	}

	return totalSize, nil
}

// torrentMetainfoFileTreeSize recursively sums version-two file-tree leaves.
//
// Dictionary depth remains bounded by the shared bencode limit, and every leaf
// must carry exactly one non-negative length.
func torrentMetainfoFileTreeSize(
	content []byte,
	position int,
	depth int,
) (int64, int, int, error) {
	if depth > maximumBencodeDepth || position >= len(content) || content[position] != 'd' {
		return 0, 0, position, errors.New("metainfo info.file tree is invalid")
	}

	position++
	totalSize := int64(0)
	fileCount := 0
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return 0, 0, position, fmt.Errorf("decode metainfo file tree key: %w", err)
		}
		position = next
		if string(key) == "" {
			length, nextPosition, leafError := torrentMetainfoFileTreeLeafLength(
				content,
				position,
				depth+1,
			)
			if leafError != nil {
				return 0, 0, position, leafError
			}

			totalSize, err = addTorrentPreviewSize(totalSize, length)
			if err != nil {
				return 0, 0, position, err
			}
			fileCount++
			position = nextPosition

			continue
		}

		childSize, childCount, nextPosition, childError := torrentMetainfoFileTreeSize(
			content,
			position,
			depth+1,
		)
		if childError != nil {
			return 0, 0, position, childError
		}

		totalSize, err = addTorrentPreviewSize(totalSize, childSize)
		if err != nil {
			return 0, 0, position, err
		}
		fileCount += childCount
		position = nextPosition
	}
	if position >= len(content) || content[position] != 'e' {
		return 0, 0, position, errors.New("metainfo info.file tree is incomplete")
	}

	return totalSize, fileCount, position + 1, nil
}

// torrentMetainfoFileTreeLeafLength reads one v2 leaf's length attribute.
//
// Other standardized leaf attributes are skipped without allocating their values,
// preserving parser behavior for piece roots and padding metadata.
func torrentMetainfoFileTreeLeafLength(
	content []byte,
	position int,
	depth int,
) (int64, int, error) {
	if depth > maximumBencodeDepth || position >= len(content) || content[position] != 'd' {
		return 0, position, errors.New("metainfo file tree leaf is invalid")
	}

	position++
	length := int64(0)
	hasLength := false
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return 0, position, fmt.Errorf("decode metainfo file tree leaf key: %w", err)
		}
		position = next
		if string(key) == "length" {
			if hasLength {
				return 0, position, errors.New("metainfo file tree length is repeated")
			}
			length, position, err = readBencodeInteger(content, position)
			if err != nil || length < 0 {
				return 0, position, errors.New("metainfo file tree length is invalid")
			}
			hasLength = true

			continue
		}

		position, err = skipBencodeValue(content, position, depth+1)
		if err != nil {
			return 0, position, fmt.Errorf("decode metainfo file tree leaf value: %w", err)
		}
	}
	if position >= len(content) || content[position] != 'e' || !hasLength {
		return 0, position, errors.New("metainfo file tree length is missing")
	}

	return length, position + 1, nil
}

// addTorrentPreviewSize adds one validated length without signed overflow.
//
// The API serializes byte counts as int64, so malformed aggregate sizes above that
// range are rejected instead of wrapping into a plausible preview.
func addTorrentPreviewSize(totalSize int64, length int64) (int64, error) {
	if length < 0 || totalSize > math.MaxInt64-length {
		return 0, errors.New("metainfo total size is invalid")
	}

	return totalSize + length, nil
}
