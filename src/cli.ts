#!/usr/bin/env node

import { Command } from 'commander';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { VtexDeploy, DeployType } from './index';

const program = new Command();
const pkg = require('../package.json');

async function promptForDeployType() {
  const question = {
    type: 'list',
    name: 'deployType',
    message: '¿Qué tipo de despliegue quieres realizar?',
    choices: [
      { name: 'Release patch stable', value: 'PATCH_STABLE' },
      { name: 'Release major stable (con migración de CMS)', value: 'MAJOR_STABLE' },
      { name: 'Deploy de custom app nueva', value: 'NEW_CUSTOM_APP' },
      { name: 'Update de custom app', value: 'UPDATE_CUSTOM_APP' },
    ]
  };

  const { deployType } = await inquirer.prompt([question]);
  return deployType as DeployType;
}

// Helper para ejecutar el deploy
async function runDeploy(deployType: DeployType, options: any) {
  try {
    console.log(chalk.blue('🚀 Iniciando proceso de deploy VTEX IO'));

    const finalOptions = {
      deployType,
      dryRun: options.dryRun || false
    };

    console.log(chalk.gray('Configuración seleccionada:'));
    console.log(chalk.gray(`• Tipo de deploy: ${deployType}`));
    if (finalOptions.dryRun) {
      console.log(chalk.gray('• Modo: DRY-RUN (no se ejecutarán comandos)'));
    }

    const deployer = new VtexDeploy(finalOptions);
    await deployer.deploy();
  } catch (error) {
    console.error(chalk.red('❌ Error durante el proceso:'), error);
    process.exit(1);
  }
}

program
  .version(pkg.version)
  .description('CLI para facilitar el deploy en VTEX IO');

program
  .command('interactive', { isDefault: true })
  .description('Menú interactivo clásico para elegir el tipo de deploy')
  .option('--dry-run', 'Mostrar comandos sin ejecutar')
  .action(async (options) => {
    try {
      const deployType = await promptForDeployType();
      await runDeploy(deployType, options);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('patch')
  .description('Despliegue de parches menores (PATCH_STABLE)')
  .option('--dry-run', 'Mostrar comandos sin ejecutar')
  .action((options) => runDeploy('PATCH_STABLE', options));

program
  .command('major')
  .description('Despliegue de versiones mayores con migración (MAJOR_STABLE)')
  .option('--dry-run', 'Mostrar comandos sin ejecutar')
  .action((options) => runDeploy('MAJOR_STABLE', options));

program
  .command('publish')
  .description('Deploy de una nueva custom app (NEW_CUSTOM_APP)')
  .option('--dry-run', 'Mostrar comandos sin ejecutar')
  .action((options) => runDeploy('NEW_CUSTOM_APP', options));

program
  .command('update')
  .description('Update de una custom app existente (UPDATE_CUSTOM_APP)')
  .option('--dry-run', 'Mostrar comandos sin ejecutar')
  .action((options) => runDeploy('UPDATE_CUSTOM_APP', options));

program.parse(process.argv);
