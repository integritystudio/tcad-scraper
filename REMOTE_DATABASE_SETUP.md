# Remote Database Setup via Tailscale

**Date**: November 9, 2025
**Status**: Configuration Complete - Awaiting Connection String

---

## ✅ Completed Steps

### 1. Local PostgreSQL Disabled
- ✅ Stopped local PostgreSQL Docker container
- ✅ Container: `tcad-postgres` is now stopped
- ✅ Local database is no longer accessible

### 2. Documentation Updated
- ✅ Updated `docs/CLAUDE.md` with remote database configuration
- ✅ All command examples updated for Tailscale remote connection
- ✅ Added Tailscale requirements and troubleshooting sections
- ✅ Updated document version to 1.2

### 3. Configuration Prepared
- ✅ All references to `localhost:5432` updated in documentation
- ✅ Added Tailscale connectivity checks to all database operations
- ✅ Working directory paths updated for macOS

---

## ⏳ Next Steps (Required)

### Step 1: Provide Database Connection String

You need to provide the remote database connection string in this format:

```bash
postgresql://[USERNAME]:[PASSWORD]@[TAILSCALE-HOSTNAME]:5432/tcad_scraper
```

**Example**:
```bash
postgresql://tcad_user:mypassword123@my-server.tail1234.ts.net:5432/tcad_scraper
```

### Step 2: Update Doppler Configuration

Once you have the connection string, update Doppler:

```bash
doppler secrets set DATABASE_URL "postgresql://[user]:[password]@[tailscale-host]:5432/tcad_scraper"
```

### Step 3: Verify Tailscale Connection

```bash
# Check Tailscale status
tailscale status

# Verify remote server is reachable
ping [tailscale-hostname]
```

### Step 4: Test Database Connection

```bash
# Test with psql
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Test with Prisma
cd server
doppler run -- npx prisma db execute --stdin <<< "SELECT 1 as test;"
```

### Step 5: Restart Services

```bash
# Kill existing server processes (they're still running with old DATABASE_URL)
# Press Ctrl+C in their terminal windows or:
pkill -f "npm run dev"
pkill -f "tsx"

# Restart backend server
cd server
doppler run -- npm run dev

# Restart frontend (in another terminal)
npm run dev
```

---

## 🔍 Verification Checklist

After completing the setup, verify:

- [ ] Tailscale is connected: `tailscale status`
- [ ] Remote host is reachable: `ping [tailscale-hostname]`
- [ ] DATABASE_URL is set in Doppler
- [ ] Database connection works with psql
- [ ] Prisma can connect to database
- [ ] Backend server starts without errors
- [ ] Frontend can load properties from remote database
- [ ] Local PostgreSQL remains stopped

---

## 📋 Configuration Summary

### Before (Local Database)
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper"
```
- Database: Local Docker container
- Access: No VPN required
- Data: Local test data only

### After (Remote Database via Tailscale)
```bash
DATABASE_URL="postgresql://[user]:[password]@[tailscale-host]:5432/tcad_scraper"
```
- Database: Remote production server
- Access: Requires Tailscale VPN
- Data: Production data from remote server

---

## ⚠️ Important Notes

1. **All database operations now require Tailscale to be connected**
2. **Local PostgreSQL is permanently disabled** (container stopped)
3. **Connection will fail if Tailscale is not running**
4. **Doppler must have the correct DATABASE_URL** for the remote server
5. **Backend and frontend servers need restart** after DATABASE_URL update

---

## 🐛 Troubleshooting

### Can't connect to database
```bash
# 1. Check Tailscale
tailscale status

# 2. Verify hostname resolves
ping [tailscale-hostname]

# 3. Check DATABASE_URL
doppler secrets get DATABASE_URL --plain

# 4. Test connection
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT 1;"
```

### Application shows "No properties found"
- Frontend needs restart after DATABASE_URL change
- Backend needs restart after DATABASE_URL change
- Verify backend can connect: Check server logs for connection errors

### "Connection refused" errors
- Tailscale not connected: Run `tailscale up`
- Wrong hostname in DATABASE_URL
- Remote server firewall blocking connection
- Remote PostgreSQL not running

---

## 📚 Reference

See `docs/CLAUDE.md` for complete documentation of:
- Database configuration
- Connection requirements
- Tailscale setup
- All command examples updated for remote database
- Troubleshooting guide

---

## 🔗 Files Modified

1. **docs/CLAUDE.md** - Complete documentation update
   - Database configuration section rewritten
   - All command examples updated
   - Tailscale requirements added
   - Troubleshooting expanded

2. **Docker containers** - Local PostgreSQL stopped
   - Container: `tcad-postgres` (stopped)
   - Will not auto-start on `docker-compose up`

---

**Status**: Ready for connection string and testing
**Next Action**: Provide DATABASE_URL connection string for Doppler configuration
