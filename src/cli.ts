#!/usr/bin/env node

import { Command } from 'commander';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { VtexDeploy, DeployType } from './index';

const program = new Command();

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

program
  .version('1.0.0')
  .description('CLI para facilitar el deploy en VTEX IO')
  .action(async () => {
    try {
      console.log(chalk.blue('🚀 Iniciando proceso de deploy VTEX IO'));

      // Obtener tipo de deploy
      const deployType = await promptForDeployType();

      const finalOptions = {
        deployType
      };

      console.log(chalk.gray('Configuración seleccionada:'));
      console.log(chalk.gray(`• Tipo de deploy: ${deployType}`));

      // Crear instancia de VtexDeploy y ejecutar el deploy
      const deployer = new VtexDeploy(finalOptions);
      await deployer.deploy();

    } catch (error) {
      console.error(chalk.red('❌ Error durante el proceso:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);
