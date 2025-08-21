#!/usr/bin/env bash
#
# setup.sh
#
# This script is meant to set up a Scaffold project with the Wizard's contracts

check_is_installed() {
  if ! which "$1" &> /dev/null; then
    echo "❌ $1 command not found."
    echo "Install $2 and try again, you can find installation guides in the README."
    exit 1
  fi
}

scaffold() {
  stellar-scaffold upgrade
}

init_git(){
  git init
  git add .
  git commit -m "openzeppelin: add wizard output" --quiet
}

build_contracts() {
  cargo build
}

install_npm_dependencies() {
  if ! npm install --silent; then
    echo "❌ Failed to set up the project."
    exit 1
  fi
}


################
##### Start ####
################

echo "⚙️ Checking dependencies requirement"
check_is_installed git "Git"
check_is_installed cargo "Rust"
check_is_installed stellar "Scaffold"
check_is_installed docker "Docker"
check_is_installed node "Node"


if ! [ -f "environments.toml" ]
then
  echo "🏗️ Building Scaffold project"

  scaffold

  build_contracts

  install_npm_dependencies

  init_git

  echo "✅ Installation complete" 
else
  echo "✅ Scaffold project already initialized."
fi
