package api

import "testing"

// TestTorrentPatternLanguagesOverlap covers the complete supported glob alphabet.
func TestTorrentPatternLanguagesOverlap(testingObject *testing.T) {
	for _, testCase := range []struct {
		name  string
		left  string
		right string
		want  bool
	}{
		{name: "identical patterns", left: "Show.S01E*", right: "Show.S01E*", want: true},
		{name: "asterisk against anything", left: "*", right: "anything", want: true},
		{name: "question marks same length", left: "S??E??", right: "S01E?2", want: true},
		{name: "question marks different lengths", left: "a?", right: "a??", want: false},
		{name: "literal mismatch", left: "movie.mkv", right: "series.mkv", want: false},
		{name: "case insensitive", left: "*.MKV", right: "Movie.mkv", want: true},
		{name: "non-overlapping suffixes", left: "*.mkv", right: "*.mp4", want: false},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			if got := torrentPatternLanguagesOverlap(testCase.left, testCase.right); got != testCase.want {
				testingObject.Fatalf(
					"torrentPatternLanguagesOverlap(%q, %q) = %t, want %t",
					testCase.left,
					testCase.right,
					got,
					testCase.want,
				)
			}
		})
	}
}
