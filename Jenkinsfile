#!/usr/bin/env groovy
/**
 * MyChair monorepo CI/CD — Jenkins Declarative Pipeline
 *
 * Stages: Checkout → Env → Backend Setup → Backend Validation →
 *         Frontend Setup → Frontend Build → Frontend Validation →
 *         Archive → Optional Render Deploy
 *
 * Optional deploy (all must be set to deploy):
 *   Job param RENDER_DEPLOY=true
 *   Env / credential RENDER_DEPLOY_HOOK_URL (Deploy Hook from Render)
 *   Optional RENDER_SERVICE_NAME label
 *
 * Pipeline fails immediately on any non-optional stage error.
 */

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 60, unit: 'MINUTES')
  }

  parameters {
    booleanParam(
      name: 'RENDER_DEPLOY',
      defaultValue: false,
      description: 'If true, trigger Render deploy hook after a successful build'
    )
    string(
      name: 'RENDER_SERVICE_NAME',
      defaultValue: 'mychair-api',
      description: 'Label only — which Render service this deploy is intended for'
    )
  }

  stages {
    stage('Checkout') {
      steps {
        echo '====================================='
        echo 'STAGE: CHECKOUT'
        echo '====================================='
        checkout scm
        sh 'git rev-parse --short HEAD || true'
        echo 'Checkout completed.'
      }
    }

    stage('Display Environment') {
      steps {
        echo '====================================='
        echo 'STAGE: DISPLAY ENVIRONMENT'
        echo '====================================='
        sh '''
          set +e
          echo "NODE:    $(node -v 2>/dev/null || echo 'not found')"
          echo "NPM:     $(npm -v 2>/dev/null || echo 'not found')"
          echo "PYTHON:  $(python3 --version 2>/dev/null || echo 'not found')"
          echo "PIP:     $(python3 -m pip --version 2>/dev/null || echo 'not found')"
          echo "BRANCH:  ${BRANCH_NAME:-unknown}"
          echo "BUILD:   ${BUILD_NUMBER}"
          echo "DEPLOY:  ${RENDER_DEPLOY}"
          echo "SERVICE: ${RENDER_SERVICE_NAME}"
          set -e
        '''
        echo 'Environment display completed.'
      }
    }

    stage('Backend Setup') {
      steps {
        echo '====================================='
        echo 'BACKEND BUILD STARTED'
        echo '====================================='
        echo 'Installing dependencies...'
        sh 'chmod +x scripts/*.sh'
        sh './scripts/backend-build.sh'
        echo 'Completed.'
      }
    }

    stage('Backend Validation') {
      steps {
        echo '====================================='
        echo 'BACKEND VALIDATION'
        echo '====================================='
        sh './scripts/backend-test.sh'
        echo 'Backend validation completed.'
      }
    }

    stage('Frontend Setup') {
      steps {
        echo '====================================='
        echo 'FRONTEND SETUP'
        echo '====================================='
        dir('Frontend') {
          sh '''
            export HUSKY=0
            if [ -f package-lock.json ]; then
              npm ci
            else
              npm install
            fi
          '''
        }
        echo 'Frontend setup completed.'
      }
    }

    stage('Frontend Build') {
      steps {
        echo '====================================='
        echo 'FRONTEND BUILD'
        echo '====================================='
        dir('Frontend') {
          sh 'npm run build'
        }
        echo 'Frontend build completed.'
      }
    }

    stage('Frontend Validation') {
      steps {
        echo '====================================='
        echo 'FRONTEND VALIDATION'
        echo '====================================='
        sh './scripts/frontend-test.sh'
        echo 'Frontend validation completed.'
      }
    }

    stage('Archive Artifacts') {
      steps {
        echo '====================================='
        echo 'ARCHIVE ARTIFACTS'
        echo '====================================='
        archiveArtifacts artifacts: 'Frontend/dist/**', fingerprint: true, allowEmptyArchive: false
        echo 'Artifacts archived.'
      }
    }

    stage('Trigger Render Deployment') {
      when {
        expression { return params.RENDER_DEPLOY == true }
      }
      steps {
        echo '====================================='
        echo 'RENDER DEPLOYMENT'
        echo '====================================='
        withEnv([
          "RENDER_DEPLOY=true",
          "RENDER_SERVICE_NAME=${params.RENDER_SERVICE_NAME}"
        ]) {
          sh '''
            if [ -z "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
              echo "ERROR: RENDER_DEPLOY_HOOK_URL is not set on this Jenkins job."
              echo "Add it as a secret text credential / environment variable,"
              echo "or disable the RENDER_DEPLOY parameter."
              exit 1
            fi
            ./scripts/deploy-render.sh
          '''
        }
        echo 'Render deployment stage completed.'
      }
    }
  }

  post {
    success {
      echo '====================================='
      echo 'PIPELINE SUCCEEDED'
      echo '====================================='
    }
    failure {
      echo '====================================='
      echo 'PIPELINE FAILED — see stage logs above'
      echo '====================================='
    }
  }
}
