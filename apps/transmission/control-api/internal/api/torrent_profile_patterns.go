package api

import (
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// globState identifies one pair of positions in two finite glob automata.
type globState struct {
	left  int
	right int
}

// torrentNameMatchesPattern matches one complete name using case-insensitive globs.
//
// Asterisks consume any number of runes, question marks consume exactly one rune,
// and every other rune is literal.
//
// Since: 2.0.0
func torrentNameMatchesPattern(name string, pattern string) bool {
	nameRunes := []rune(name)
	patternRunes := []rune(pattern)
	queue := []globState{{}}
	visited := map[globState]struct{}{}

	for len(queue) > 0 {
		state := queue[0]
		queue = queue[1:]
		if _, found := visited[state]; found {
			continue
		}
		visited[state] = struct{}{}
		if state.left == len(patternRunes) && state.right == len(nameRunes) {
			return true
		}
		if state.left >= len(patternRunes) {
			continue
		}
		patternRune := patternRunes[state.left]
		if patternRune == '*' {
			queue = append(queue, globState{left: state.left + 1, right: state.right})
			if state.right < len(nameRunes) {
				queue = append(queue, globState{left: state.left, right: state.right + 1})
			}

			continue
		}
		if state.right < len(nameRunes) &&
			(patternRune == '?' || strings.EqualFold(string(patternRune), string(nameRunes[state.right]))) {
			queue = append(queue, globState{left: state.left + 1, right: state.right + 1})
		}
	}

	return false
}

// torrentPatternLanguagesOverlap reports whether two supported globs share a name.
//
// The breadth-first product walk explores epsilon and consuming transitions of both
// finite automata. Memoizing position pairs makes the decision finite even for two
// asterisks and avoids constructing an example torrent name.
//
// Since: 2.0.0
func torrentPatternLanguagesOverlap(leftPattern string, rightPattern string) bool {
	leftRunes := []rune(leftPattern)
	rightRunes := []rune(rightPattern)
	queue := []globState{{}}
	visited := map[globState]struct{}{}

	for len(queue) > 0 {
		state := queue[0]
		queue = queue[1:]
		if _, found := visited[state]; found {
			continue
		}
		visited[state] = struct{}{}
		if state.left == len(leftRunes) && state.right == len(rightRunes) {
			return true
		}

		leftStar := state.left < len(leftRunes) && leftRunes[state.left] == '*'
		rightStar := state.right < len(rightRunes) && rightRunes[state.right] == '*'
		if leftStar {
			queue = append(queue, globState{left: state.left + 1, right: state.right})
		}
		if rightStar {
			queue = append(queue, globState{left: state.left, right: state.right + 1})
		}
		if state.left >= len(leftRunes) || state.right >= len(rightRunes) {
			continue
		}
		leftRune := leftRunes[state.left]
		rightRune := rightRunes[state.right]
		if !globRunesCompatible(leftRune, rightRune) {
			continue
		}
		next := globState{left: state.left + 1, right: state.right + 1}
		if leftStar {
			next.left = state.left
		}
		if rightStar {
			next.right = state.right
		}
		if next != state {
			queue = append(queue, next)
		}
	}

	return false
}

// globRunesCompatible reports whether two consuming transitions share a rune.
func globRunesCompatible(leftRune rune, rightRune rune) bool {
	if leftRune == '*' || leftRune == '?' || rightRune == '*' || rightRune == '?' {
		return true
	}

	return strings.EqualFold(string(leftRune), string(rightRune))
}

// torrentProfilesMatchingName returns every named profile matching a torrent name.
func torrentProfilesMatchingName(
	profiles []storage.TorrentProfile,
	name string,
) []storage.TorrentProfile {
	matches := []storage.TorrentProfile{}
	for _, profile := range profiles {
		if torrentProfileMatchesName(profile, name) {
			matches = append(matches, profile)
		}
	}

	return matches
}

// torrentProfileMatchesName reports whether any pattern on one profile matches.
func torrentProfileMatchesName(profile storage.TorrentProfile, name string) bool {
	for _, pattern := range profile.MatchPatterns {
		if torrentNameMatchesPattern(name, pattern) {
			return true
		}
	}

	return false
}
