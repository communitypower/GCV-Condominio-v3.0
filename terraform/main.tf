terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- VARIABLES ---

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "The GCP region to deploy resources in"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "The deployment environment name (e.g. staging, production)"
}

variable "container_image" {
  type        = string
  default     = "gcr.io/cloudrun/hello"
  description = "The docker image to deploy to Cloud Run"
}

# --- ARTIFACT REGISTRY ---

resource "google_artifact_registry_repository" "gcv_repo" {
  location      = var.region
  repository_id = "gcv-condominio-repo-${var.environment}"
  description   = "Docker container registry for GCV Condominio (${var.environment})"
  format        = "DOCKER"

  docker_config {
    immutable_tags = false
  }
}

# --- CLOUD STORAGE ---

resource "google_storage_bucket" "gcv_attachments" {
  name                        = "gcv-condominio-attachments-${var.project_id}-${var.environment}"
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# --- SECRET MANAGER ---

resource "google_secret_manager_secret" "database_url" {
  secret_id = "gcv-database-url-${var.environment}"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "session_secret" {
  secret_id = "gcv-session-secret-${var.environment}"

  replication {
    auto {}
  }
}

# --- CLOUD SQL (POSTGRESQL) ---

resource "google_sql_database_instance" "gcv_db_instance" {
  name             = "gcv-postgres-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-f1-micro" # Lean sizing for cost-efficiency
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # Daily maintenance window
      point_in_time_recovery_enabled = true    # Enables Write-Ahead Logging (WAL) for PITR
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled = true
      # Enforce SSL/TLS connections
      require_ssl = true
    }
  }

  deletion_protection = var.environment == "production" ? true : false
}

resource "google_sql_database" "gcv_db" {
  name     = "gcv_db"
  instance = google_sql_database_instance.gcv_db_instance.name
}

resource "google_sql_user" "gcv_db_user" {
  name     = "gcv_admin"
  instance = google_sql_database_instance.gcv_db_instance.name
  password = var.environment == "production" ? null : "local_dev_pass" # In production, set via secret/managed injection
}

# --- IAM FOR SERVICE ACCOUNTS ---

# Default Service Account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "gcv-cloudrun-sa-${var.environment}"
  display_name = "GCV Cloud Run Service Account for ${var.environment}"
}

# Grant Cloud Run SA read access to database URL secret
resource "google_secret_manager_secret_iam_member" "db_url_access" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Cloud Run SA read access to session secret
resource "google_secret_manager_secret_iam_member" "session_secret_access" {
  secret_id = google_secret_manager_secret.session_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Cloud Run SA Cloud SQL Client role to connect to PostgreSQL
resource "google_project_iam_member" "cloudrun_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Cloud Run SA storage admin for attachments bucket
resource "google_storage_bucket_iam_member" "storage_access" {
  bucket = google_storage_bucket.gcv_attachments.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# --- CLOUD RUN SERVICE ---

resource "google_cloud_run_v2_service" "gcv_app" {
  name     = "gcv-app-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 0 # Scale-to-zero for lean cost during idle hours
      max_instance_count = 5 # Prevent run-away costs
    }

    containers {
      image = var.container_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "ATTACHMENTS_BUCKET"
        value = google_storage_bucket.gcv_attachments.name
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_secret_manager_secret_iam_member.db_url_access,
    google_secret_manager_secret_iam_member.session_secret_access,
    google_project_iam_member.cloudrun_sql_client,
    google_storage_bucket_iam_member.storage_access
  ]
}

# Make Cloud Run Service publicly accessible
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.gcv_app.name
  location = google_cloud_run_v2_service.gcv_app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- CLOUD MONITORING & ALERTS ---

# CPU Spike Alert
resource "google_monitoring_alert_policy" "cpu_spike" {
  display_name = "GCV Cloud Run CPU Spike Alert (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "CPU utilization is above 85% for 5 minutes"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.gcv_app.name}\" AND metric.type=\"run.googleapis.com/container/cpu/utilizations\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }
}

# HTTP 5xx Server Error Alert
resource "google_monitoring_alert_policy" "http_5xx_errors" {
  display_name = "GCV Cloud Run 5xx Error Alert (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "HTTP 5xx error rate exceeds 5% of traffic"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.gcv_app.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "180s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5.0
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
}

# SQL Connection Spike Alert
resource "google_monitoring_alert_policy" "sql_connections" {
  display_name = "GCV SQL Connection Spike Alert (${var.environment})"
  combiner     = "OR"
  conditions {
    display_name = "Cloud SQL active connections exceed 80% capacity"
    condition_threshold {
      filter          = "resource.type=\"cloud_sql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.gcv_db_instance.name}\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 80.0
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }
}
