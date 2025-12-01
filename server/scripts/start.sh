#!/bin/bash
cd /home/aledlie/tcad-scraper/server
exec doppler run -- npx tsx src/index.ts
