pipeline {
    agent any

    environment {
        ENV_FILE_PATH = "C:\\ProgramData\\Jenkins\\.jenkins\\jenkinsEnv\\spend-track\\API"
    }

    options {
        buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '5', daysToKeepStr: '', numToKeepStr: '5')
    }


    stages {
        stage('Checkout') {
            steps {
                echo "📦 Cloning Spend Track Business Council API repository..."
                checkout scmGit(
                    branches: [[name: '*/master']], 
                    extensions: [], 
                    userRemoteConfigs: [[
                        credentialsId: 'Wasim-Jenkins-Credentials', 
                        url: 'https://github.com/NartechSolution/spend-backend.git'
                    ]]
                )
            }
        }

        stage('Setup Environment File') {
            steps {
                echo "📁 Copying .env file to the backend root..."
                bat "copy \"${ENV_FILE_PATH}\" \"%WORKSPACE%\\.env\""
            }
        }

        stage('Stop PM2 Process (if running)') {
            steps {
                script {
                    echo "🛑 Stopping PM2 process if running..."
                    def processStatus = bat(script: 'pm2 list', returnStdout: true).trim()
                    if (processStatus.contains('spendtrack-api')) {
                        bat 'pm2 stop spendtrack-api || exit 0'
                        echo "PM2 process 'spendtrack-api' stopped."
                    } else {
                        echo "PM2 process 'spendtrack-api' not running."
                    }
                }
            }
        }

        stage('Install & Build Backend') {
            steps {
                echo "📦 Installing dependencies..."
                bat 'npm install'

                echo "🔨 Generating Prisma files..."
                bat 'npm run prisma:generate'
            }
        }

        stage('Manage PM2 Process') {
            steps {
                script {
                    echo "🔁 Ensuring PM2 process for Spend Track API is running..."

                    def processStatus = bat(script: 'pm2 list', returnStdout: true).trim()
                    if (processStatus.contains('spendtrack-api')) {
                        echo "PM2 process 'spendtrack-api' found. Restarting..."
                        bat 'pm2 restart spendtrack-api || exit 0'
                    } else {
                        echo "PM2 process 'spendtrack-api' not found. Starting..."
                        bat 'pm2 start src/server.mjs --name spendtrack-api'
                    }

                    echo "💾 Saving PM2 configuration..."
                    bat 'pm2 save'
                }
            }
        }
    }
}
