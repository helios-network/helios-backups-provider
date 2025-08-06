# Helios Backups Server

A secure, high-performance backup server with CLI interface for serving Helios backup files and their headers.

## 🎯 What is it?

Helios CDN Server is a lightweight server that:
- ✅ Serves Helios backup files (.gz, .tar.gz)
- ✅ Generates JSON headers for each snapshot
- ✅ Limits download bandwidth
- ✅ Runs in daemon mode

## 📦 Installation

```bash
git clone https://github.com/helios-network/helios-backups-provider.git
cd helios-backups-provider

npm install
npm run build

chmod +x helios-backups
```

## 🔧 Usage

### Basic Commands

```bash
# Start the server
./helios-backups serve

# Start in daemon mode (background)
./helios-backups serve -d

# Change port (default: 3000)
./helios-backups serve -p 8080

# Limit download speed (default: 1 MB/s)
./helios-backups serve -r 5

# Stop the daemon
./helios-backups stop

# Check daemon status
./helios-backups status

# Show help
./helios-backups help
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## 📊 API Endpoints

### Download a snapshot
```
GET /snapshots/:filename
```

**Example:**
```bash
curl http://localhost:3000/snapshots/snapshot_123_2024-01-06_12-30-45.gz
```

### Get snapshot header
```
GET /snapshots/:filename.header.json
```

**Example:**
```bash
curl http://localhost:3000/snapshots/snapshot_123_2024-01-06_12-30-45.gz.header.json
```

**Response:**
```json
{
  "filename": "snapshot_123_2024-01-06_12-30-45.gz",
  "blockId": 123,
  "uploadedAt": "2024-01-06T12:30:45.000Z",
  "description": "Helios Node Backup - Block 123 - 2024-01-06 12-30-45",
  "downloadUrl": "http://localhost:3000/snapshots/snapshot_123_2024-01-06_12-30-45.gz",
  "fileSize": 1048576
}
```

### List all snapshots
```
GET /snapshots
```

**Response:**
```json
{
  "snapshots": [
    {
      "filename": "snapshot_123_2024-01-06_12-30-45.gz",
      "blockId": 123,
      "uploadedAt": "2024-01-06T12:30:45.000Z",
      "description": "Helios Node Backup - Block 123 - 2024-01-06 12-30-45",
      "downloadUrl": "http://localhost:3000/snapshots/snapshot_123_2024-01-06_12-30-45.gz",
      "headerUrl": "http://localhost:3000/snapshots/snapshot_123_2024-01-06_12-30-45.gz.header.json",
      "fileSize": 1048576
    }
  ],
  "totalCount": 1
}
```

### Health check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T00:42:24.000Z",
  "uptime": 123.456,
  "version": "1.0.0",
  "environment": "production"
}
```

### Limits
- **Allowed extensions**: .gz, .tar.gz
- **File name format**: `snapshot_<blockId>_<date>_<time>.(gz|tar.gz)`

## 🧪 Testing

```bash
# Unit tests
npm test

# Security tests
npm run security:test

# Dependency audit
npm run security:audit

# Code verification
npm run lint
```

## 🚀 Deployment

### Simple production
```bash
# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start in daemon mode
./helios-backups serve -d
```