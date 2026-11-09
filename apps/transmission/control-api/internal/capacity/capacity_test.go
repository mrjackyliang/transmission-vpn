package capacity

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDetectorUsesCapacitySourcesInOrder(t *testing.T) {
	tests := []struct {
		name        string
		fixture     string
		runtimeCPUs int
		wantLimit   int
		wantMemory  uint64
		wantCPUs    float64
		wantSource  string
	}{
		{
			name:        "cgroup v2",
			fixture:     "cgroup-v2",
			runtimeCPUs: 16,
			wantLimit:   4,
			wantMemory:  1024 * 1024 * 1024,
			wantCPUs:    2,
			wantSource:  "cgroup-v2",
		},
		{
			name:        "cgroup v1 after unlimited v2",
			fixture:     "cgroup-v1",
			runtimeCPUs: 4,
			wantLimit:   3,
			wantMemory:  768 * 1024 * 1024,
			wantCPUs:    4,
			wantSource:  "cgroup-v1",
		},
		{
			name:        "meminfo after unlimited cgroups",
			fixture:     "meminfo",
			runtimeCPUs: 1,
			wantLimit:   1,
			wantMemory:  512 * 1024 * 1024,
			wantCPUs:    1,
			wantSource:  "meminfo",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixtureRoot := filepath.Join("testdata", test.fixture)
			detector := NewDetector(Paths{
				CgroupV2Memory: filepath.Join(fixtureRoot, "memory.max"),
				CgroupV1Memory: filepath.Join(fixtureRoot, "memory.limit_in_bytes"),
				MemoryInfo:     filepath.Join(fixtureRoot, "meminfo"),
				CgroupV2CPU:    filepath.Join(fixtureRoot, "cpu.max"),
			}, time.Minute)
			detector.cpuCount = func() int { return test.runtimeCPUs }

			snapshot, err := detector.Current()
			if err != nil {
				t.Fatalf("Current() error = %v", err)
			}
			if snapshot.Limit != test.wantLimit || snapshot.MemoryBytes != test.wantMemory ||
				snapshot.CPUs != test.wantCPUs || snapshot.Source != test.wantSource {
				t.Fatalf("Current() = %+v", snapshot)
			}
		})
	}
}

func TestDetectorCachesForTheConfiguredPeriod(t *testing.T) {
	directory := t.TempDir()
	memoryPath := filepath.Join(directory, "memory.max")
	cpuPath := filepath.Join(directory, "cpu.max")
	if err := os.WriteFile(memoryPath, []byte("1073741824\n"), 0o600); err != nil {
		t.Fatalf("write memory fixture: %v", err)
	}
	if err := os.WriteFile(cpuPath, []byte("200000 100000\n"), 0o600); err != nil {
		t.Fatalf("write CPU fixture: %v", err)
	}

	now := time.Unix(100, 0)
	detector := NewDetector(Paths{
		CgroupV2Memory: memoryPath,
		CgroupV1Memory: filepath.Join(directory, "missing-v1"),
		MemoryInfo:     filepath.Join(directory, "missing-meminfo"),
		CgroupV2CPU:    cpuPath,
	}, time.Minute)
	detector.now = func() time.Time { return now }

	first, err := detector.Current()
	if err != nil {
		t.Fatalf("first Current() error = %v", err)
	}
	if err := os.WriteFile(memoryPath, []byte("2147483648\n"), 0o600); err != nil {
		t.Fatalf("replace memory fixture: %v", err)
	}

	now = now.Add(59 * time.Second)
	cached, err := detector.Current()
	if err != nil {
		t.Fatalf("cached Current() error = %v", err)
	}
	if cached != first {
		t.Fatalf("cached Current() = %+v, want %+v", cached, first)
	}

	now = now.Add(2 * time.Second)
	refreshed, err := detector.Current()
	if err != nil {
		t.Fatalf("refreshed Current() error = %v", err)
	}
	if refreshed.MemoryBytes == first.MemoryBytes || refreshed == first {
		t.Fatalf("refreshed Current() = %+v, first = %+v", refreshed, first)
	}
}

func TestDetectorFallsBackToMemTotalWithoutMemAvailable(t *testing.T) {
	directory := t.TempDir()
	meminfoPath := filepath.Join(directory, "meminfo")
	if err := os.WriteFile(meminfoPath, []byte("MemTotal: 1048576 kB\n"), 0o600); err != nil {
		t.Fatalf("write meminfo fixture: %v", err)
	}
	detector := NewDetector(Paths{
		CgroupV2Memory: filepath.Join(directory, "missing-v2"),
		CgroupV1Memory: filepath.Join(directory, "missing-v1"),
		MemoryInfo:     meminfoPath,
		CgroupV2CPU:    filepath.Join(directory, "missing-cpu"),
	}, time.Minute)
	detector.cpuCount = func() int { return 2 }

	snapshot, err := detector.Current()
	if err != nil {
		t.Fatalf("Current() error = %v", err)
	}
	if snapshot.MemoryBytes != 1024*1024*1024 || snapshot.Source != "meminfo" || snapshot.Limit != 4 {
		t.Fatalf("Current() = %+v", snapshot)
	}
}

func TestDetectorUsesConservativeFallbackAndKeepsLastGoodSnapshot(t *testing.T) {
	directory := t.TempDir()
	memoryPath := filepath.Join(directory, "memory.max")
	if err := os.WriteFile(memoryPath, []byte("1073741824\n"), 0o600); err != nil {
		t.Fatalf("write memory fixture: %v", err)
	}
	now := time.Unix(100, 0)
	detector := NewDetector(Paths{
		CgroupV2Memory: memoryPath,
		CgroupV1Memory: filepath.Join(directory, "missing-v1"),
		MemoryInfo:     filepath.Join(directory, "missing-meminfo"),
		CgroupV2CPU:    filepath.Join(directory, "missing-cpu"),
	}, time.Minute)
	detector.cpuCount = func() int { return 3 }
	detector.now = func() time.Time { return now }

	first, err := detector.Current()
	if err != nil {
		t.Fatalf("first Current() error = %v", err)
	}
	if err := os.Remove(memoryPath); err != nil {
		t.Fatalf("remove memory fixture: %v", err)
	}
	now = now.Add(time.Minute)
	refreshed, err := detector.Current()
	if err != nil {
		t.Fatalf("failed refresh error = %v", err)
	}
	if refreshed != first {
		t.Fatalf("failed refresh = %+v, want last good %+v", refreshed, first)
	}

	fresh := NewDetector(Paths{
		CgroupV2Memory: filepath.Join(directory, "missing-v2"),
		CgroupV1Memory: filepath.Join(directory, "missing-v1"),
		MemoryInfo:     filepath.Join(directory, "missing-meminfo"),
		CgroupV2CPU:    filepath.Join(directory, "missing-cpu"),
	}, time.Minute)
	fresh.cpuCount = func() int { return 3 }
	fallback, err := fresh.Current()
	if err != nil {
		t.Fatalf("fallback Current() error = %v", err)
	}
	if fallback.Limit != 2 || fallback.CPUs != 3 || fallback.Source != "fallback" {
		t.Fatalf("fallback Current() = %+v", fallback)
	}
}

func TestDetectorUsesRuntimeCPUsWhenCPUControlIsMalformed(t *testing.T) {
	directory := t.TempDir()
	memoryPath := filepath.Join(directory, "memory.max")
	cpuPath := filepath.Join(directory, "cpu.max")
	if err := os.WriteFile(memoryPath, []byte("1073741824\n"), 0o600); err != nil {
		t.Fatalf("write memory fixture: %v", err)
	}
	if err := os.WriteFile(cpuPath, []byte("not-a-limit\n"), 0o600); err != nil {
		t.Fatalf("write CPU fixture: %v", err)
	}
	detector := NewDetector(Paths{
		CgroupV2Memory: memoryPath,
		CgroupV1Memory: filepath.Join(directory, "missing-v1"),
		MemoryInfo:     filepath.Join(directory, "missing-meminfo"),
		CgroupV2CPU:    cpuPath,
	}, time.Minute)
	detector.cpuCount = func() int { return 5 }

	snapshot, err := detector.Current()
	if err != nil {
		t.Fatalf("Current() error = %v", err)
	}
	if snapshot.CPUs != 5 || snapshot.Source != "cgroup-v2" {
		t.Fatalf("Current() = %+v", snapshot)
	}
}

func TestConnectionLimitClampsAtBothBounds(t *testing.T) {
	if got := connectionLimit(128*1024*1024, 0.25); got != 1 {
		t.Fatalf("small connectionLimit() = %d, want 1", got)
	}
	if got := connectionLimit(128*1024*1024*1024, 128); got != 64 {
		t.Fatalf("large connectionLimit() = %d, want 64", got)
	}
}
