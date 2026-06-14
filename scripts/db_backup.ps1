$PG_BIN = "C:\Program Files\PostgreSQL\18\bin"
$DB_HOST = "127.0.0.1"
$PORT = "5433"
$USER = "postgres"
$DB = "postgres"
$BACKUP_FILE = "local_db_data/backup.sql"
$TEMP_DB = "backup_verify_temp"

Write-Host "Starting GCV Database Backup Drill..."

if (!(Test-Path -Path "local_db_data")) {
    New-Item -ItemType Directory -Force -Path "local_db_data" | Out-Null
}

Write-Host "Dumping database schema and data..."
& "$PG_BIN\pg_dump.exe" -h $DB_HOST -p $PORT -U $USER -F c -b -v -f $BACKUP_FILE $DB
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
    exit 1
}
Write-Host "Backup created successfully: $BACKUP_FILE"

Write-Host "Creating temporary verification database: $TEMP_DB..."
& "$PG_BIN\psql.exe" -h $DB_HOST -p $PORT -U $USER -d $DB -c "CREATE DATABASE $TEMP_DB;"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create temporary verification database"
    exit 1
}

Write-Host "Restoring dump file..."
& "$PG_BIN\pg_restore.exe" -h $DB_HOST -p $PORT -U $USER -d $TEMP_DB -v $BACKUP_FILE
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_restore failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Host "Querying database structure to verify presence of tables..."
$checkQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
$result = & "$PG_BIN\psql.exe" -h $DB_HOST -p $PORT -U $USER -d $TEMP_DB -t -A -c $checkQuery
Write-Host "Found $result tables restored in the temporary database."

$termConnections = "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$TEMP_DB' AND pid <> pg_backend_pid();"
& "$PG_BIN\psql.exe" -h $DB_HOST -p $PORT -U $USER -d $DB -c $termConnections | Out-Null

Write-Host "Cleaning up: Dropping temporary verification database..."
& "$PG_BIN\psql.exe" -h $DB_HOST -p $PORT -U $USER -d $DB -c "DROP DATABASE $TEMP_DB;"

if ([int]$result -eq 0) {
    Write-Error "Backup verification failed: 0 tables found in the restored database!"
    exit 1
}

Write-Host "GCV Database Backup and Recovery drill completed with 100% SUCCESS."
