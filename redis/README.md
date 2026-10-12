# Redis service

The default WSL deployment uses the official `redis:7.4-alpine` container.
Configuration flags (`--appendonly yes`, maxmemory 128mb, LRU evictions) are in `run-wslc.ps1`.
Persistence uses the named `cro-weather-redis-data` WSLC volume mounted at `/data`.
Redis port 6379 is private to `cro-weather-net`: no host port is published.

```powershell
wslc exec cro-weather-redis redis-cli ping
wslc container logs cro-weather-redis
```

This single-instance design is for an article/demo workload; redundant Redis and monitored backups are required for high-availability deployments.
