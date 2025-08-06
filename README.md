# Helios Backups Server

A secure, high-performance backup server with CLI interface for serving Helios backup files.

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

# Start in daemon mode
./helios-backups serve -d

# Start on specific port
./helios-backups serve -p 8080

# Limit download speed to 5 MB/s
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

### Download Backup
```
GET /snapshots/:filename
```

**Parameters:**
- `filename`: Backup file name (must be .gz or .tar.gz)

**Security Headers:**
- `Content-Disposition: attachment`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store, no-cache`

### Health Check
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

## 🧪 Testing and Quality

### Run Tests
```bash
npm test
npm run test:coverage
```

### Code Verification
```bash
npm run lint
npm run lint:fix
```

### Security Audit
```bash
npm run security:audit
npm run security:check
```

## 🚀 Deployment

### Production
```bash
# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start in daemon mode
./helios-backups serve -d
```

### Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["./helios-backups", "serve"]
```

## 🔧 Configuration

### Security Limits
- **Maximum file size**: 1 GB
- **Allowed extensions**: .gz, .tar.gz
- **Rate limiting**: 20 requests per minute per IP
- **Download speed**: 1 MB/s default

### Customization
Modify `src/config/security.ts` to adjust security parameters.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Use strict TypeScript
- Add tests for new features
- Follow ESLint rules
- Document new APIs

## 🐛 Report Bugs

Please report bugs and feature requests on the [GitHub issues page](https://github.com/helios-network/helios-backups-provider/issues).