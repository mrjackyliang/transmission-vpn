package api

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

// torrentMoveRename is one ordered Transmission path rename.
//
// Path names the target's current relative path and Name supplies the source resume
// state's final basename for that file or directory.
type torrentMoveRename struct {
	Path string
	Name string
}

// torrentMoveRenameOperations reconstructs resume-file renames from metainfo.
//
// Transmission preserves file order across an add, so comparing each original path
// with the source's current file path reveals every renamed ancestor and file.
func torrentMoveRenameOperations(
	metainfo []byte,
	currentFiles []torrentMoveFile,
) ([]torrentMoveRename, error) {
	originalPaths, err := torrentMetainfoOriginalPaths(metainfo)
	if err != nil {
		return nil, err
	}
	if len(originalPaths) != len(currentFiles) {
		return nil, fmt.Errorf(
			"metainfo has %d files but Transmission reported %d",
			len(originalPaths),
			len(currentFiles),
		)
	}

	desiredPaths := make([][]string, len(currentFiles))
	workingPaths := make([][]string, len(originalPaths))
	for index, file := range currentFiles {
		desiredPaths[index], err = torrentMovePathComponents(file.Name)
		if err != nil {
			return nil, fmt.Errorf("read current torrent file %d: %w", index, err)
		}
		workingPaths[index] = append([]string(nil), originalPaths[index]...)
		if len(workingPaths[index]) != len(desiredPaths[index]) {
			return nil, fmt.Errorf("torrent file %d changed path depth", index)
		}
	}

	renames := []torrentMoveRename{}
	for fileIndex, desiredPath := range desiredPaths {
		for componentIndex, desiredName := range desiredPath {
			if workingPaths[fileIndex][componentIndex] == desiredName {
				continue
			}

			oldPrefix := append(
				[]string(nil),
				workingPaths[fileIndex][:componentIndex+1]...,
			)
			renames = append(renames, torrentMoveRename{
				Path: strings.Join(oldPrefix, "/"),
				Name: desiredName,
			})
			for pathIndex := range workingPaths {
				if len(workingPaths[pathIndex]) <= componentIndex ||
					!slices.Equal(
						workingPaths[pathIndex][:componentIndex+1],
						oldPrefix,
					) {
					continue
				}
				workingPaths[pathIndex][componentIndex] = desiredName
			}
		}
	}
	for index := range workingPaths {
		if !slices.Equal(workingPaths[index], desiredPaths[index]) {
			return nil, errors.New("current torrent paths contain conflicting directory renames")
		}
	}

	return renames, nil
}

// torrentMetainfoOriginalPaths reads the path list represented by info.
//
// Version-one file lists retain their declared order. Version-two file trees are
// traversed in their bencoded dictionary order, matching their canonical ordering.
func torrentMetainfoOriginalPaths(content []byte) ([][]string, error) {
	infoStart, err := torrentMetainfoInfoStart(content)
	if err != nil {
		return nil, err
	}

	position := infoStart + 1
	name := ""
	utf8Name := ""
	filesStart := -1
	fileTreeStart := -1
	for position < len(content) && content[position] != 'e' {
		key, next, readError := readBencodeString(content, position)
		if readError != nil {
			return nil, fmt.Errorf("decode metainfo info key: %w", readError)
		}
		position = next
		valueStart := position
		position, readError = skipBencodeValue(content, position, 1)
		if readError != nil {
			return nil, fmt.Errorf("decode metainfo info value: %w", readError)
		}

		switch string(key) {
		case "name", "name.utf-8":
			value, _, valueError := readBencodeString(content, valueStart)
			if valueError != nil {
				return nil, errors.New("metainfo info.name is invalid")
			}
			if string(key) == "name.utf-8" {
				utf8Name = strings.ToValidUTF8(string(value), "�")
			} else {
				name = strings.ToValidUTF8(string(value), "�")
			}
		case "files":
			filesStart = valueStart
		case "file tree":
			fileTreeStart = valueStart
		}
	}
	if name == "" {
		return nil, errors.New("metainfo info.name is missing")
	}
	if utf8Name != "" {
		name = utf8Name
	}
	root, err := torrentMovePathComponents(name)
	if err != nil || len(root) != 1 {
		return nil, errors.New("metainfo info.name is not a path component")
	}

	var relativePaths [][]string
	switch {
	case filesStart >= 0:
		relativePaths, err = torrentMetainfoVersionOneFiles(content, filesStart)
	case fileTreeStart >= 0:
		relativePaths, err = torrentMetainfoVersionTwoFiles(content, fileTreeStart)
	default:
		relativePaths = [][]string{{}}
	}
	if err != nil {
		return nil, err
	}
	if len(relativePaths) == 0 {
		return nil, errors.New("metainfo contains no files")
	}

	paths := make([][]string, len(relativePaths))
	for index, relativePath := range relativePaths {
		paths[index] = append([]string{name}, relativePath...)
	}

	return paths, nil
}

// torrentMetainfoInfoStart finds the one top-level info dictionary.
//
// The scanner shares the bounded bencode primitives used by info-hash extraction and
// never decodes unrelated piece payloads into memory.
func torrentMetainfoInfoStart(content []byte) (int, error) {
	if len(content) == 0 || content[0] != 'd' {
		return -1, errors.New("metainfo must contain a bencoded dictionary")
	}

	position := 1
	infoStart := -1
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return -1, fmt.Errorf("decode metainfo key: %w", err)
		}
		position = next
		valueStart := position
		position, err = skipBencodeValue(content, position, 0)
		if err != nil {
			return -1, fmt.Errorf("decode metainfo value: %w", err)
		}
		if string(key) == "info" {
			if infoStart >= 0 {
				return -1, errors.New("metainfo contains more than one info dictionary")
			}
			infoStart = valueStart
		}
	}
	if infoStart < 0 || infoStart >= len(content) || content[infoStart] != 'd' {
		return -1, errors.New("metainfo does not contain an info dictionary")
	}

	return infoStart, nil
}

// torrentMetainfoVersionOneFiles reads every info.files path list.
//
// The optional UTF-8 path wins when present, matching the display names Transmission
// uses when it imports older metainfo with both legacy and UTF-8 fields.
func torrentMetainfoVersionOneFiles(content []byte, listStart int) ([][]string, error) {
	if listStart >= len(content) || content[listStart] != 'l' {
		return nil, errors.New("metainfo info.files is invalid")
	}

	paths := [][]string{}
	position := listStart + 1
	for position < len(content) && content[position] != 'e' {
		if content[position] != 'd' {
			return nil, errors.New("metainfo file entry is invalid")
		}
		entryEnd, err := skipBencodeValue(content, position, 2)
		if err != nil {
			return nil, fmt.Errorf("decode metainfo file entry: %w", err)
		}

		entryPosition := position + 1
		var path []string
		var utf8Path []string
		for entryPosition < len(content) && content[entryPosition] != 'e' {
			key, next, keyError := readBencodeString(content, entryPosition)
			if keyError != nil {
				return nil, fmt.Errorf("decode metainfo file key: %w", keyError)
			}
			entryPosition = next
			valueStart := entryPosition
			entryPosition, keyError = skipBencodeValue(content, entryPosition, 3)
			if keyError != nil {
				return nil, fmt.Errorf("decode metainfo file value: %w", keyError)
			}
			if string(key) != "path" && string(key) != "path.utf-8" {
				continue
			}
			components, componentError := readBencodePathList(content, valueStart)
			if componentError != nil {
				return nil, componentError
			}
			if string(key) == "path.utf-8" {
				utf8Path = components
			} else {
				path = components
			}
		}
		if len(utf8Path) > 0 {
			path = utf8Path
		}
		if len(path) == 0 {
			return nil, errors.New("metainfo file path is missing")
		}
		paths = append(paths, path)
		position = entryEnd
	}
	if position >= len(content) || content[position] != 'e' {
		return nil, errors.New("metainfo info.files is incomplete")
	}

	return paths, nil
}

// readBencodePathList reads one non-empty list of safe path components.
//
// Resume renames never change hierarchy depth, so rejecting separators and traversal
// here prevents malformed metainfo from becoming a rename request.
func readBencodePathList(content []byte, listStart int) ([]string, error) {
	if listStart >= len(content) || content[listStart] != 'l' {
		return nil, errors.New("metainfo file path is invalid")
	}

	components := []string{}
	position := listStart + 1
	for position < len(content) && content[position] != 'e' {
		component, next, err := readBencodeString(content, position)
		if err != nil {
			return nil, errors.New("metainfo file path is invalid")
		}
		value := strings.ToValidUTF8(string(component), "�")
		if _, err := torrentMovePathComponents(value); err != nil || strings.Contains(value, "/") {
			return nil, errors.New("metainfo file path has an invalid component")
		}
		components = append(components, value)
		position = next
	}
	if position >= len(content) || len(components) == 0 {
		return nil, errors.New("metainfo file path is incomplete")
	}

	return components, nil
}

// torrentMetainfoVersionTwoFiles traverses an info.file tree.
//
// A zero-length dictionary key marks a file at the current prefix. Other keys are
// path components whose dictionary values continue the canonical tree.
func torrentMetainfoVersionTwoFiles(content []byte, treeStart int) ([][]string, error) {
	paths := [][]string{}
	if err := walkTorrentMetainfoFileTree(content, treeStart, nil, &paths); err != nil {
		return nil, err
	}

	return paths, nil
}

// walkTorrentMetainfoFileTree collects version-two file leaves recursively.
//
// Bencode's depth limit bounds recursion, while the shared value skipper validates
// each file-properties dictionary without retaining its hashes or lengths.
func walkTorrentMetainfoFileTree(
	content []byte,
	treeStart int,
	prefix []string,
	paths *[][]string,
) error {
	if treeStart >= len(content) || content[treeStart] != 'd' {
		return errors.New("metainfo info.file tree is invalid")
	}

	position := treeStart + 1
	for position < len(content) && content[position] != 'e' {
		key, next, err := readBencodeString(content, position)
		if err != nil {
			return fmt.Errorf("decode metainfo file tree key: %w", err)
		}
		position = next
		valueStart := position
		position, err = skipBencodeValue(content, position, len(prefix)+2)
		if err != nil {
			return fmt.Errorf("decode metainfo file tree value: %w", err)
		}
		if len(key) == 0 {
			if len(prefix) == 0 || content[valueStart] != 'd' {
				return errors.New("metainfo file tree leaf is invalid")
			}
			*paths = append(*paths, append([]string(nil), prefix...))

			continue
		}

		component := strings.ToValidUTF8(string(key), "�")
		if _, err := torrentMovePathComponents(component); err != nil ||
			strings.Contains(component, "/") {
			return errors.New("metainfo file tree has an invalid component")
		}
		childPrefix := append(append([]string(nil), prefix...), component)
		if err := walkTorrentMetainfoFileTree(
			content,
			valueStart,
			childPrefix,
			paths,
		); err != nil {
			return err
		}
	}
	if position >= len(content) {
		return errors.New("metainfo info.file tree is incomplete")
	}

	return nil
}

// torrentMovePathComponents validates one Transmission relative file name.
//
// File names are slash-separated regardless of the API host platform. Empty,
// traversal, or absolute components can never be valid rename inputs.
func torrentMovePathComponents(value string) ([]string, error) {
	if value == "" || strings.HasPrefix(value, "/") || strings.HasSuffix(value, "/") {
		return nil, errors.New("torrent path is invalid")
	}

	components := strings.Split(value, "/")
	for _, component := range components {
		if component == "" || component == "." || component == ".." {
			return nil, errors.New("torrent path is invalid")
		}
	}

	return components, nil
}
