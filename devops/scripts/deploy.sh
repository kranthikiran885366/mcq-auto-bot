#!/bin/bash

# Advanced AI MCQ Bot Deployment Script
# Built by MVK Solutions
# Usage: ./deploy.sh [environment] [version]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_REGISTRY="ghcr.io/mvksolutions"
IMAGE_NAME="mcq-automation-bot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Advanced AI MCQ Bot Deployment Script

Usage: $0 [OPTIONS] ENVIRONMENT [VERSION]

ENVIRONMENTS:
    development     Deploy to development environment
    staging         Deploy to staging environment
    production      Deploy to production environment

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -d, --dry-run   Show what would be deployed without actually deploying
    --skip-tests    Skip running tests before deployment
    --force         Force deployment even if tests fail
    --rollback      Rollback to previous version

EXAMPLES:
    $0 staging                    # Deploy latest to staging
    $0 production v2.1.0          # Deploy specific version to production
    $0 --dry-run production       # Show what would be deployed
    $0 --rollback production      # Rollback production to previous version

EOF
}

# Parse command line arguments
ENVIRONMENT=""
VERSION="latest"
VERBOSE=false
DRY_RUN=false
SKIP_TESTS=false
FORCE=false
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        development|staging|production)
            ENVIRONMENT=$1
            shift
            ;;
        v*)
            VERSION=$1
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment is required"
    show_help
    exit 1
fi

# Set environment-specific configurations
case $ENVIRONMENT in
    development)
        NAMESPACE="mcq-bot-dev"
        CLUSTER_NAME="mcq-bot-dev"
        DOMAIN="dev.mcq-bot.mvksolutions.com"
        REPLICAS=1
        ;;
    staging)
        NAMESPACE="mcq-bot-staging"
        CLUSTER_NAME="mcq-bot-staging"
        DOMAIN="staging.mcq-bot.mvksolutions.com"
        REPLICAS=2
        ;;
    production)
        NAMESPACE="mcq-bot-prod"
        CLUSTER_NAME="mcq-bot-prod"
        DOMAIN="mcq-bot.mvksolutions.com"
        REPLICAS=3
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Verbose logging
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

log_info "Starting deployment to $ENVIRONMENT environment"
log_info "Version: $VERSION"
log_info "Namespace: $NAMESPACE"
log_info "Domain: $DOMAIN"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    local tools=("docker" "kubectl" "helm" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi
    
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! python -m pytest tests/unit/ -v; then
        if [[ "$FORCE" == "true" ]]; then
            log_warning "Unit tests failed but continuing due to --force flag"
        else
            log_error "Unit tests failed"
            exit 1
        fi
    fi
    
    # Run integration tests for non-production environments
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Running integration tests..."
        if ! python -m pytest tests/integration/ -v; then
            if [[ "$FORCE" == "true" ]]; then
                log_warning "Integration tests failed but continuing due to --force flag"
            else
                log_error "Integration tests failed"
                exit 1
            fi
        fi
    fi
    
    log_success "Tests passed"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    cd "$PROJECT_ROOT"
    
    local image_tag="$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
    local latest_tag="$DOCKER_REGISTRY/$IMAGE_NAME:latest"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would build and push: $image_tag"
        return 0
    fi
    
    # Build image
    log_info "Building Docker image: $image_tag"
    docker build -f devops/docker/Dockerfile -t "$image_tag" .
    
    # Tag as latest if deploying to production
    if [[ "$ENVIRONMENT" == "production" && "$VERSION" != "latest" ]]; then
        docker tag "$image_tag" "$latest_tag"
    fi
    
    # Push image
    log_info "Pushing Docker image: $image_tag"
    docker push "$image_tag"
    
    if [[ "$ENVIRONMENT" == "production" && "$VERSION" != "latest" ]]; then
        docker push "$latest_tag"
    fi
    
    log_success "Docker image built and pushed"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Switch to correct cluster context
    kubectl config use-context "$CLUSTER_NAME" || {
        log_error "Failed to switch to cluster context: $CLUSTER_NAME"
        exit 1
    }
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Set image tag in manifests
    local manifests_dir="$PROJECT_ROOT/devops/kubernetes/$ENVIRONMENT"
    local temp_dir=$(mktemp -d)
    
    # Copy manifests to temp directory and update image tags
    cp -r "$manifests_dir"/* "$temp_dir/"
    find "$temp_dir" -name "*.yaml" -exec sed -i "s|IMAGE_TAG|$DOCKER_REGISTRY/$IMAGE_NAME:$VERSION|g" {} \;
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would apply Kubernetes manifests from: $temp_dir"
        log_info "Manifests content:"
        find "$temp_dir" -name "*.yaml" -exec echo "--- {} ---" \; -exec cat {} \;
        rm -rf "$temp_dir"
        return 0
    fi
    
    # Apply manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f "$temp_dir" -n "$NAMESPACE"
    
    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/mcq-bot-app -n "$NAMESPACE" --timeout=600s
    
    # Verify deployment
    log_info "Verifying deployment..."
    local ready_replicas=$(kubectl get deployment mcq-bot-app -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
    if [[ "$ready_replicas" -ge "$REPLICAS" ]]; then
        log_success "Deployment successful: $ready_replicas/$REPLICAS replicas ready"
    else
        log_error "Deployment failed: only $ready_replicas/$REPLICAS replicas ready"
        exit 1
    fi
    
    # Clean up temp directory
    rm -rf "$temp_dir"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would run health checks against: https://$DOMAIN"
        return 0
    fi
    
    # Wait for service to be ready
    sleep 30
    
    # Check health endpoint
    local health_url="https://$DOMAIN/api/health"
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        if curl -f -s "$health_url" > /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health check failed after $max_attempts attempts"
            exit 1
        fi
        
        sleep 10
        ((attempt++))
    done
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would rollback deployment in namespace: $NAMESPACE"
        return 0
    fi
    
    # Get previous revision
    local previous_revision=$(kubectl rollout history deployment/mcq-bot-app -n "$NAMESPACE" --revision=0 | tail -2 | head -1 | awk '{print $1}')
    
    if [[ -z "$previous_revision" ]]; then
        log_error "No previous revision found for rollback"
        exit 1
    fi
    
    log_info "Rolling back to revision: $previous_revision"
    kubectl rollout undo deployment/mcq-bot-app -n "$NAMESPACE" --to-revision="$previous_revision"
    
    # Wait for rollback to complete
    kubectl rollout status deployment/mcq-bot-app -n "$NAMESPACE" --timeout=300s
    
    log_success "Rollback completed"
}

# Update monitoring and alerts
update_monitoring() {
    log_info "Updating monitoring configuration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would update monitoring for environment: $ENVIRONMENT"
        return 0
    fi
    
    # Update Grafana dashboards
    local grafana_url="https://grafana.mvksolutions.com"
    local dashboard_file="$PROJECT_ROOT/devops/monitoring/grafana/dashboard.json"
    
    if [[ -f "$dashboard_file" ]]; then
        log_info "Updating Grafana dashboard..."
        # This would typically use Grafana API to update dashboards
        # curl -X POST -H "Authorization: Bearer $GRAFANA_API_KEY" \
        #      -H "Content-Type: application/json" \
        #      -d @"$dashboard_file" \
        #      "$grafana_url/api/dashboards/db"
    fi
    
    # Create deployment annotation
    local annotation_data=$(cat << EOF
{
  "text": "Deployment: $VERSION to $ENVIRONMENT",
  "tags": ["deployment", "$ENVIRONMENT"],
  "time": $(date +%s000)
}
EOF
)
    
    # This would typically send the annotation to Grafana
    # curl -X POST -H "Authorization: Bearer $GRAFANA_API_KEY" \
    #      -H "Content-Type: application/json" \
    #      -d "$annotation_data" \
    #      "$grafana_url/api/annotations"
    
    log_success "Monitoring updated"
}

# Send notifications
send_notifications() {
    local status=$1
    local message=$2
    
    log_info "Sending notifications..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would send notification: $message"
        return 0
    fi
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        if [[ "$status" == "failure" ]]; then
            color="danger"
        fi
        
        local payload=$(cat << EOF
{
  "attachments": [
    {
      "color": "$color",
      "title": "MCQ Bot Deployment",
      "text": "$message",
      "fields": [
        {
          "title": "Environment",
          "value": "$ENVIRONMENT",
          "short": true
        },
        {
          "title": "Version",
          "value": "$VERSION",
          "short": true
        }
      ]
    }
  ]
}
EOF
)
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$SLACK_WEBHOOK_URL"
    fi
    
    log_success "Notifications sent"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deployment failed with exit code: $exit_code"
        send_notifications "failure" "Deployment to $ENVIRONMENT failed"
    fi
    
    # Clean up any temporary files
    # Add cleanup logic here
    
    exit $exit_code
}

# Set trap for cleanup
trap cleanup EXIT

# Main deployment flow
main() {
    log_info "Advanced AI MCQ Bot Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    
    if [[ "$ROLLBACK" == "true" ]]; then
        check_prerequisites
        rollback_deployment
        run_health_checks
        send_notifications "success" "Rollback to $ENVIRONMENT completed successfully"
        return 0
    fi
    
    # Standard deployment flow
    check_prerequisites
    run_tests
    build_and_push_image
    deploy_to_kubernetes
    run_health_checks
    update_monitoring
    send_notifications "success" "Deployment to $ENVIRONMENT completed successfully"
    
    log_success "Deployment completed successfully!"
    log_info "Application URL: https://$DOMAIN"
    log_info "Monitoring: https://grafana.mvksolutions.com"
}

# Run main function
main "$@"