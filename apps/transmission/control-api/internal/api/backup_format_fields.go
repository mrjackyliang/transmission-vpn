package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"
	"time"
)

var (
	backupRawMessageType = reflect.TypeFor[json.RawMessage]()
	backupTimeType       = reflect.TypeFor[time.Time]()
)

// validateBackupRequiredFields enforces struct-tag presence before Go zero values
// can make a missing or null JSON scalar indistinguishable from a valid false or zero.
func validateBackupRequiredFields(rawDocument json.RawMessage) error {
	decoder := json.NewDecoder(bytes.NewReader(rawDocument))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("decode export fields: %w", err)
	}
	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return errors.New("export contains more than one JSON value")
	}

	return validateBackupJSONValue(value, reflect.TypeFor[backupDocument](), "export")
}

func validateBackupJSONValue(value any, expectedType reflect.Type, path string) error {
	for expectedType.Kind() == reflect.Pointer {
		expectedType = expectedType.Elem()
	}
	if expectedType == backupRawMessageType || expectedType == backupTimeType {
		return nil
	}

	switch expectedType.Kind() {
	case reflect.Struct:
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("%s must be an object", path)
		}
		for index := range expectedType.NumField() {
			field := expectedType.Field(index)
			if !field.IsExported() {
				continue
			}
			tag := field.Tag.Get("json")
			if tag == "-" {
				continue
			}
			parts := strings.Split(tag, ",")
			fieldName := parts[0]
			if fieldName == "" {
				fieldName = field.Name
			}
			optional := slicesContain(parts[1:], "omitempty")
			fieldValue, found := object[fieldName]
			if !found {
				if optional {
					continue
				}

				return fmt.Errorf("%s.%s is required", path, fieldName)
			}
			fieldPath := path + "." + fieldName
			if fieldValue == nil {
				if field.Type == backupRawMessageType || (!optional && field.Type.Kind() == reflect.Pointer) {
					continue
				}

				return fmt.Errorf("%s cannot be null", fieldPath)
			}
			if err := validateBackupJSONValue(fieldValue, field.Type, fieldPath); err != nil {
				return err
			}
		}

		return nil
	case reflect.Slice, reflect.Array:
		array, ok := value.([]any)
		if !ok {
			return fmt.Errorf("%s must be an array", path)
		}
		for index, item := range array {
			if item == nil && expectedType.Elem().Kind() != reflect.Pointer {
				return fmt.Errorf("%s[%d] cannot be null", path, index)
			}
			if item != nil {
				if err := validateBackupJSONValue(
					item,
					expectedType.Elem(),
					fmt.Sprintf("%s[%d]", path, index),
				); err != nil {
					return err
				}
			}
		}

		return nil
	case reflect.Map:
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("%s must be an object", path)
		}
		for key, item := range object {
			if item == nil && expectedType.Elem().Kind() != reflect.Pointer {
				return fmt.Errorf("%s.%s cannot be null", path, key)
			}
			if item != nil {
				if err := validateBackupJSONValue(
					item,
					expectedType.Elem(),
					path+"."+key,
				); err != nil {
					return err
				}
			}
		}

		return nil
	default:
		if value == nil {
			return fmt.Errorf("%s cannot be null", path)
		}

		return nil
	}
}

func slicesContain(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}

	return false
}
