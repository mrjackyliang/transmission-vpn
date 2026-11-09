// Package capacity detects the number of VPN connections this container can run.
//
// The detector prefers container limits over host-wide figures and caches snapshots
// so frequent status requests do not repeatedly read virtual filesystem files.
package capacity

import (
	"errors"
	"fmt"
	"log/slog"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	reservedMemoryBytes     = uint64(256 * 1024 * 1024)
	connectionMemoryBytes   = uint64(160 * 1024 * 1024)
	maximumConnectionLimit  = 64
	minimumConnectionLimit  = 1
	fallbackConnectionLimit = 2
	unlimitedMemoryBoundary = uint64(1 << 60)
)

// Paths names the Linux control files used for capacity detection.
//
// Tests replace these paths with fixtures, while production uses the container's
// cgroup and proc files directly.
//
// Since: UNRELEASED
type Paths struct {
	// CgroupV2Memory is the memory.max path.
	CgroupV2Memory string
	// CgroupV1Memory is the memory.limit_in_bytes path.
	CgroupV1Memory string
	// MemoryInfo is the proc meminfo path.
	MemoryInfo string
	// CgroupV2CPU is the cpu.max path.
	CgroupV2CPU string
}

// Snapshot is one cached capacity decision and all figures exposed by the API.
//
// Source identifies the memory source because memory determines which fallback path
// was used; CPUs always prefer cpu.max before the Go runtime count.
//
// Since: UNRELEASED
type Snapshot struct {
	Limit       int     `json:"limit"`
	Used        int     `json:"used"`
	MemoryBytes uint64  `json:"memoryBytes"`
	CPUs        float64 `json:"cpus"`
	Source      string  `json:"source"`
}

// Detector reads and briefly caches container capacity figures.
//
// A mutex keeps concurrent connection-list and create requests on one consistent
// snapshot while allowing the limits to be refreshed after the cache interval.
//
// Since: UNRELEASED
type Detector struct {
	paths       Paths
	cachePeriod time.Duration
	cpuCount    func() int
	now         func() time.Time

	mutex     sync.Mutex
	cached    Snapshot
	cachedAt  time.Time
	hasCached bool
	logger    *slog.Logger
}

// DefaultPaths returns the standard cgroup and proc locations inside the image.
//
// Keeping the paths explicit makes the production order visible and lets tests use
// the same parser against small filesystem fixtures.
//
// Since: UNRELEASED
func DefaultPaths() Paths {
	return Paths{
		CgroupV2Memory: "/sys/fs/cgroup/memory.max",
		CgroupV1Memory: "/sys/fs/cgroup/memory/memory.limit_in_bytes",
		MemoryInfo:     "/proc/meminfo",
		CgroupV2CPU:    "/sys/fs/cgroup/cpu.max",
	}
}

// NewDetector constructs a capacity detector with the supplied cache interval.
//
// Non-positive intervals use one minute, matching the API's bounded refresh contract.
// Unreadable environments are reported by Current and use a conservative snapshot.
//
// Since: UNRELEASED
func NewDetector(paths Paths, cachePeriod time.Duration) *Detector {
	if cachePeriod <= 0 {
		cachePeriod = time.Minute
	}

	return &Detector{
		paths:       paths,
		cachePeriod: cachePeriod,
		cpuCount:    runtime.NumCPU,
		now:         time.Now,
		logger:      slog.Default(),
	}
}

// Current returns a cached capacity snapshot or refreshes expired figures.
//
// Used is supplied by storage at response time and is deliberately left at zero in
// the detector's cached environmental snapshot.
//
// Since: UNRELEASED
func (detector *Detector) Current() (Snapshot, error) {
	detector.mutex.Lock()
	defer detector.mutex.Unlock()

	now := detector.now()
	if detector.hasCached && now.Sub(detector.cachedAt) < detector.cachePeriod {
		return detector.cached, nil
	}

	memoryBytes, source, err := detectMemory(detector.paths)
	if err != nil {
		detector.logger.Warn("VPN connection capacity detection failed", "error", err)
		detector.cachedAt = now
		if detector.hasCached {
			return detector.cached, nil
		}

		runtimeCPUs := detector.cpuCount()
		if runtimeCPUs < 1 {
			runtimeCPUs = 1
		}
		detector.cached = Snapshot{
			Limit:  fallbackConnectionLimit,
			CPUs:   float64(runtimeCPUs),
			Source: "fallback",
		}
		detector.hasCached = true

		return detector.cached, nil
	}
	cpus, err := detectCPUs(detector.paths.CgroupV2CPU, detector.cpuCount())
	if err != nil {
		detector.logger.Warn("VPN CPU capacity detection failed; using the Go runtime count", "error", err)
		cpus = float64(detector.cpuCount())
		if cpus < 1 {
			cpus = 1
		}
	}

	detector.cached = Snapshot{
		Limit:       connectionLimit(memoryBytes, cpus),
		MemoryBytes: memoryBytes,
		CPUs:        cpus,
		Source:      source,
	}
	detector.cachedAt = now
	detector.hasCached = true

	return detector.cached, nil
}

func detectMemory(paths Paths) (uint64, string, error) {
	var sourceErrors []error
	if value, limited, err := readMemoryLimit(paths.CgroupV2Memory, true); err == nil && limited {
		return value, "cgroup-v2", nil
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		sourceErrors = append(sourceErrors, fmt.Errorf("read cgroup v2 memory limit: %w", err))
	}

	if value, limited, err := readMemoryLimit(paths.CgroupV1Memory, false); err == nil && limited {
		return value, "cgroup-v1", nil
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		sourceErrors = append(sourceErrors, fmt.Errorf("read cgroup v1 memory limit: %w", err))
	}

	content, err := os.ReadFile(paths.MemoryInfo)
	if err != nil {
		sourceErrors = append(sourceErrors, fmt.Errorf("read memory information: %w", err))

		return 0, "", errors.Join(sourceErrors...)
	}
	values := make(map[string]string, 2)
	for _, line := range strings.Split(string(content), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && (fields[0] == "MemAvailable:" || fields[0] == "MemTotal:") {
			values[fields[0]] = fields[1]
		}
	}
	for _, key := range []string{"MemAvailable:", "MemTotal:"} {
		value, found := values[key]
		if !found {
			continue
		}
		kilobytes, parseError := strconv.ParseUint(value, 10, 64)
		if parseError != nil || kilobytes > math.MaxUint64/1024 {
			sourceErrors = append(sourceErrors, fmt.Errorf("%s is invalid", strings.TrimSuffix(key, ":")))

			continue
		}

		return kilobytes * 1024, "meminfo", nil
	}

	sourceErrors = append(sourceErrors, errors.New("MemAvailable and MemTotal are missing"))

	return 0, "", errors.Join(sourceErrors...)
}

func readMemoryLimit(path string, allowMaximum bool) (uint64, bool, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, false, err
	}

	value := strings.TrimSpace(string(content))
	if allowMaximum && value == "max" {
		return 0, false, nil
	}

	bytes, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, false, errors.New("memory limit is invalid")
	}
	if bytes >= unlimitedMemoryBoundary {
		return 0, false, nil
	}

	return bytes, true, nil
}

func detectCPUs(path string, runtimeCPUs int) (float64, error) {
	content, err := os.ReadFile(path)
	if err == nil {
		fields := strings.Fields(string(content))
		if len(fields) != 2 {
			return 0, errors.New("cgroup v2 CPU limit is invalid")
		}
		if fields[0] != "max" {
			quota, quotaError := strconv.ParseUint(fields[0], 10, 64)
			period, periodError := strconv.ParseUint(fields[1], 10, 64)
			if quotaError != nil || periodError != nil || quota == 0 || period == 0 {
				return 0, errors.New("cgroup v2 CPU limit is invalid")
			}

			return float64(quota) / float64(period), nil
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return 0, fmt.Errorf("read cgroup v2 CPU limit: %w", err)
	}

	if runtimeCPUs < 1 {
		runtimeCPUs = 1
	}

	return float64(runtimeCPUs), nil
}

func connectionLimit(memoryBytes uint64, cpus float64) int {
	memoryLimit := uint64(0)
	if memoryBytes > reservedMemoryBytes {
		memoryLimit = (memoryBytes - reservedMemoryBytes) / connectionMemoryBytes
	}
	cpuLimit := math.Floor(2 * cpus)
	if memoryLimit < minimumConnectionLimit || cpuLimit < minimumConnectionLimit {
		return minimumConnectionLimit
	}
	if memoryLimit > maximumConnectionLimit {
		memoryLimit = maximumConnectionLimit
	}
	if cpuLimit > maximumConnectionLimit {
		cpuLimit = maximumConnectionLimit
	}

	return min(int(memoryLimit), int(cpuLimit))
}
