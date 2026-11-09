package api

import (
	"errors"
	"fmt"
)

const (
	maximumImportBencodeDepth  = 64
	maximumImportBencodeValues = 1_000_000
	maximumImportBencodeItems  = 100_000
)

// boundedBencodeParser decodes one untrusted Transmission resume or metainfo file.
//
// File-size limits are enforced before this parser runs. The additional structural
// limits prevent a small input from expanding into an unbounded object graph.
type boundedBencodeParser struct {
	content             []byte
	maximumStringLength int
	position            int
	values              int
}

// parseBoundedBencode decodes exactly one canonical bencoded value.
func parseBoundedBencode(content []byte, maximumStringLength int) (any, error) {
	if len(content) == 0 {
		return nil, errors.New("bencoded input is empty")
	}
	parser := boundedBencodeParser{
		content:             content,
		maximumStringLength: maximumStringLength,
	}
	value, err := parser.parseValue(0)
	if err != nil {
		return nil, err
	}
	if parser.position != len(content) {
		return nil, errors.New("bencoded input contains trailing data")
	}

	return value, nil
}

// parseValue decodes one value while accounting for nesting and collection size.
func (parser *boundedBencodeParser) parseValue(depth int) (any, error) {
	if depth > maximumImportBencodeDepth {
		return nil, errors.New("bencoded value is nested too deeply")
	}
	if parser.values >= maximumImportBencodeValues {
		return nil, errors.New("bencoded input contains too many values")
	}
	if parser.position >= len(parser.content) {
		return nil, errors.New("bencoded value is missing")
	}
	parser.values++

	switch parser.content[parser.position] {
	case 'i':
		value, next, err := readBencodeInteger(parser.content, parser.position)
		if err != nil {
			return nil, err
		}
		parser.position = next

		return value, nil
	case 'l':
		parser.position++
		values := []any{}
		for parser.position < len(parser.content) && parser.content[parser.position] != 'e' {
			if len(values) >= maximumImportBencodeItems {
				return nil, errors.New("bencoded list contains too many values")
			}
			value, err := parser.parseValue(depth + 1)
			if err != nil {
				return nil, err
			}
			values = append(values, value)
		}
		if parser.position >= len(parser.content) {
			return nil, errors.New("bencoded list is incomplete")
		}
		parser.position++

		return values, nil
	case 'd':
		parser.position++
		values := map[string]any{}
		for parser.position < len(parser.content) && parser.content[parser.position] != 'e' {
			if len(values) >= maximumImportBencodeItems {
				return nil, errors.New("bencoded dictionary contains too many values")
			}
			keyBytes, next, err := parser.readString()
			if err != nil {
				return nil, fmt.Errorf("decode bencoded dictionary key: %w", err)
			}
			key := string(keyBytes)
			if _, found := values[key]; found {
				return nil, errors.New("bencoded dictionary contains a duplicate key")
			}
			parser.position = next
			value, err := parser.parseValue(depth + 1)
			if err != nil {
				return nil, err
			}
			values[key] = value
		}
		if parser.position >= len(parser.content) {
			return nil, errors.New("bencoded dictionary is incomplete")
		}
		parser.position++

		return values, nil
	default:
		value, next, err := parser.readString()
		if err != nil {
			return nil, err
		}
		parser.position = next

		return value, nil
	}
}

// readString applies the import-specific byte-string limit after canonical parsing.
func (parser *boundedBencodeParser) readString() ([]byte, int, error) {
	value, next, err := readBencodeString(parser.content, parser.position)
	if err != nil {
		return nil, parser.position, err
	}
	if len(value) > parser.maximumStringLength {
		return nil, parser.position, errors.New("bencoded string is too large")
	}

	return value, next, nil
}

// bencodeDictionary returns a dictionary or an empty false result.
func bencodeDictionary(value any) (map[string]any, bool) {
	dictionary, ok := value.(map[string]any)

	return dictionary, ok
}

// bencodeIntegerValue reads an integer dictionary field.
func bencodeIntegerValue(dictionary map[string]any, keys ...string) (int64, bool) {
	for _, key := range keys {
		value, found := dictionary[key]
		if !found {
			continue
		}
		integer, ok := value.(int64)
		if ok {
			return integer, true
		}
	}

	return 0, false
}

// bencodeStringValue reads a byte-string dictionary field as valid UTF-8.
func bencodeStringValue(dictionary map[string]any, keys ...string) (string, bool) {
	for _, key := range keys {
		value, found := dictionary[key]
		if !found {
			continue
		}
		bytesValue, ok := value.([]byte)
		if ok {
			return string(bytesValue), true
		}
	}

	return "", false
}
