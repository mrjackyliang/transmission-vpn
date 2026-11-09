// Package jsonbody normalizes values before they cross a JSON boundary.
//
// Go distinguishes nil and empty slices, but JSON clients expect every list to stay
// an array. Normalizing at the final boundary protects nested storage, runtime, RPC,
// and map values without weakening request validation.
package jsonbody

import (
	"encoding/json"
	"reflect"
)

var jsonMarshalerType = reflect.TypeOf((*json.Marshaler)(nil)).Elem()

// Normalize returns a copy of value whose nil slices are empty slices.
//
// Maps, pointers, interfaces, arrays, and exported struct fields are traversed so a
// nil list nested inside an RPC result or embedded response type cannot encode as
// null. Custom JSON marshalers retain ownership of their representation.
func Normalize(value any) any {
	if value == nil {
		return nil
	}

	return normalizeValue(reflect.ValueOf(value)).Interface()
}

// normalizeValue copies one reflected value while replacing nil slices.
func normalizeValue(value reflect.Value) reflect.Value {
	if !value.IsValid() || value.Type().Implements(jsonMarshalerType) {
		return value
	}

	switch value.Kind() {
	case reflect.Array:
		normalized := reflect.New(value.Type()).Elem()
		for index := 0; index < value.Len(); index++ {
			normalized.Index(index).Set(normalizeValue(value.Index(index)))
		}

		return normalized
	case reflect.Interface:
		if value.IsNil() {
			return value
		}
		normalized := normalizeValue(value.Elem())
		result := reflect.New(value.Type()).Elem()
		result.Set(normalized)

		return result
	case reflect.Map:
		if value.IsNil() {
			return value
		}
		normalized := reflect.MakeMapWithSize(value.Type(), value.Len())
		iterator := value.MapRange()
		for iterator.Next() {
			normalized.SetMapIndex(iterator.Key(), normalizeValue(iterator.Value()))
		}

		return normalized
	case reflect.Pointer:
		if value.IsNil() {
			if value.Type().Elem().Kind() != reflect.Slice {
				return value
			}
			normalized := reflect.New(value.Type().Elem())
			normalized.Elem().Set(reflect.MakeSlice(value.Type().Elem(), 0, 0))

			return normalized
		}
		normalized := reflect.New(value.Type().Elem())
		normalized.Elem().Set(normalizeValue(value.Elem()))

		return normalized
	case reflect.Slice:
		if value.IsNil() {
			return reflect.MakeSlice(value.Type(), 0, 0)
		}
		normalized := reflect.MakeSlice(value.Type(), value.Len(), value.Cap())
		for index := 0; index < value.Len(); index++ {
			normalized.Index(index).Set(normalizeValue(value.Index(index)))
		}

		return normalized
	case reflect.Struct:
		normalized := reflect.New(value.Type()).Elem()
		normalized.Set(value)
		for index := 0; index < value.NumField(); index++ {
			if value.Type().Field(index).PkgPath != "" {
				continue
			}
			normalized.Field(index).Set(normalizeValue(value.Field(index)))
		}

		return normalized
	default:
		return value
	}
}
