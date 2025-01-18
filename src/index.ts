import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import * as inquirer from 'inquirer';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

async function execCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.log(chalk.yellow('Advertencia:'), stderr);
    }
    return stdout;
  } catch (error) {
    console.error(chalk.red(`Error ejecutando comando: ${command}`));
    throw error;
  }
}

// Helper para hacer delay entre comandos si es necesario
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type DeployType = 'PATCH_STABLE' | 'NEW_CUSTOM_APP' | 'UPDATE_CUSTOM_APP' | 'MAJOR_STABLE';

export interface DeployOptions {
  deployType?: DeployType;
}

export class VtexDeploy {
  private deployType: DeployType;
  private vendor: string = '';

  constructor(options: DeployOptions = {}) {
    this.deployType = options.deployType || 'PATCH_STABLE';
  }

  private async promptForVendor(): Promise<void> {
    const { vendor } = await inquirer.prompt([{
      type: 'input',
      name: 'vendor',
      message: '¿Cuál es el vendor?',
      validate: (input) => input.length > 0 || 'El vendor es requerido'
    }]);
    this.vendor = vendor;
  }

  private async checkCustomAppDirectory(): Promise<boolean> {
    const { isInDirectory } = await inquirer.prompt([{
      type: 'confirm',
      name: 'isInDirectory',
      message: '¿Estás dentro del directorio de la custom app?',
      default: false
    }]);

    if (!isInDirectory) {
      console.log(chalk.yellow('⚠️ Por favor, posiciónate dentro del directorio de la custom app y vuelve a ejecutar el script.'));
      return false;
    }

    // Verificar si existe el manifest.json
    if (!existsSync('./manifest.json')) {
      console.log(chalk.red('❌ No se encontró el archivo manifest.json. Asegúrate de estar en el directorio correcto.'));
      return false;
    }

    return true;
  }

  private async checkVersionUpdate(): Promise<boolean> {
    const { versionUpdated } = await inquirer.prompt([{
      type: 'confirm',
      name: 'versionUpdated',
      message: '¿Has actualizado la versión en el manifest.json y subido los cambios al repositorio?',
      default: false
    }]);

    if (!versionUpdated) {
      console.log(chalk.yellow('⚠️ Debes actualizar la versión en el manifest.json y subir los cambios antes de continuar.'));
      return false;
    }

    return true;
  }

  private async promptForMigrationContinuation(): Promise<boolean> {
    const { continueDeploy } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueDeploy',
      message: '¿Desea continuar con la promoción del workspace de production a master?',
      default: false
    }]);

    return continueDeploy;
  }

  private async executePatchStable(): Promise<void> {
    try {
      await this.promptForVendor();
      const spinner = ora('Ejecutando patch stable...').start();
      try {
        console.log(chalk.gray(`Ejecutando login para vendor: ${this.vendor}`));

        spinner.text = `Iniciando sesión en VTEX - (vtex login ${this.vendor})...`;
        await execCommand(`vtex login ${this.vendor}`);

        spinner.text = 'Cambiando a workspace production - (vtex use production --production)...';
        await execCommand('vtex use production --production');

        spinner.text = 'Ejecutando release patch stable - (vtex release patch stable)...';
        await execCommand('vtex release patch stable');

        spinner.text = 'Ejecutando deploy force - (vtex deploy --force)...';
        await execCommand('vtex deploy --force');

        spinner.text = 'Actualizando workspace de producción - (vtex update)...';
        await execCommand('vtex update');

        // Pausamos el spinner mientras se hace la verificación
        spinner.stop();

        // Mostramos el link de producción
        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Por favor, verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        // Preguntamos al usuario si desea continuar
        const { continuar } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continuar',
            message: '¿Los cambios están correctos y deseas continuar con el proceso?',
            default: false,
          },
        ]);

        if (!continuar) {
          spinner.fail('Proceso cancelado por el usuario');
          return;
        }

        // Reiniciamos el spinner para continuar con el proceso
        spinner.start();

        spinner.text = 'Cambiando a workspace master - (vtex use master)...';
        await execCommand('vtex use master');

        spinner.text = 'Actualizando workspace master...';
        await execCommand('vtex update');

        spinner.succeed('✅ Patch stable completado exitosamente');
      } catch (error) {
        spinner.fail('❌ Error durante el patch stable');
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error en patch stable:'), error);
      throw error;
    }
  }

  private async executeNewCustomApp(): Promise<void> {
    try {
      // Primero hacemos todas las verificaciones sin spinner
      console.log(chalk.blue('🔍 Verificando custom app...'));

      // Verificar directorio
      if (!await this.checkCustomAppDirectory()) {
        console.log(chalk.red('❌ Verificación fallida: directorio incorrecto'));
        return;
      }

      // Pedir vendor
      await this.promptForVendor();

      // Ahora sí iniciamos el spinner para los comandos
      const spinner = ora('Iniciando deploy de nueva custom app...').start();

      try {
        // Ejecutar comandos uno por uno con feedback
        spinner.text = 'Iniciando sesión en VTEX...';
        await execCommand(`vtex login ${this.vendor}`);

        spinner.text = 'Cambiando a workspace production...';
        await execCommand('vtex use production --production');

        spinner.text = 'Publicando app...';
        await execCommand('vtex publish');

        spinner.text = 'Ejecutando deploy force...';
        await execCommand('vtex deploy --force');

        spinner.text = 'Actualizando workspace productivo...';
        await execCommand('vtex update');

        spinner.text = 'Cambiando a workspace master...';
        await execCommand('vtex use master');

        spinner.text = 'Actualizando workspace master...';
        await execCommand('vtex update');

        spinner.succeed('✅ Deploy de nueva custom app completado exitosamente');
      } catch (error) {
        spinner.fail('Error durante el deploy de nueva custom app');
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error en new custom app:'), error);
      throw error;
    }
  }

  private async executeUpdateCustomApp(): Promise<void> {
    try {
      // Primero hacemos todas las verificaciones sin spinner
      console.log(chalk.blue('🔍 Verificando custom app...'));

      // Verificar directorio y versión
      if (!await this.checkCustomAppDirectory() || !await this.checkVersionUpdate()) {
        console.log(chalk.red('❌ Verificación fallida: directorio incorrecto'));
        return;
      }

      await this.promptForVendor();

      const spinner = ora('Iniciando update de custom app...').start();

      try {
        // Ejecutar comandos uno por uno con feedback
        spinner.text = 'Iniciando sesión en VTEX...';
        await execCommand(`vtex login ${this.vendor}`);

        spinner.text = 'Cambiando a workspace production...';
        await execCommand('vtex use production --production');

        spinner.text = 'Publicando update...';
        await execCommand('vtex publish');

        spinner.text = 'Ejecutando deploy force...';
        await execCommand('vtex deploy --force');

        spinner.text = 'Actualizando workpsace productivo...';
        await execCommand('vtex update');

        spinner.text = 'Cambiando a workspace master...';
        await execCommand('vtex use master');

        spinner.text = 'Actualizando workspace master...';
        await execCommand('vtex update');

        spinner.succeed('✅ Update de la custom app completada exitosamente');
      } catch (error) {
        spinner.fail('Error durante la actualización de la custom app');
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error en new custom app:'), error);
      throw error;
    }
  }

  private async executeMajorStable(): Promise<void> {
    try {
      await this.promptForVendor();
      const spinner = ora('Ejecutando major stable...').start();

      try {
        // Primera parte: release major

        spinner.text = `Iniciando sesión en VTEX - (vtex login ${this.vendor})...`;
        await execCommand(`vtex login ${this.vendor}`);

        spinner.text = 'Cambiando a workspace production - (vtex use production --production)...';
        await execCommand('vtex use production --production');

        spinner.text = 'Ejecutando release major stable - (vtex release major stable)...';
        await execCommand('vtex release major stable');

        spinner.text = 'Instalando GraphQL IDE - (vtex install vtex.admin-graphql-ide@3.x)...';
        await execCommand('vtex install vtex.admin-graphql-ide@3.x');

        // Pausamos el spinner para mostrar las instrucciones
        spinner.stop();

        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.blue('\n🔄 Proceso de migración requerido'));
        console.log(chalk.yellow('\nPor favor, sigue estos pasos en el admin de GraphQL:'));
        console.log(chalk.white(`
          1. Accede a: vtex browse admin/graphql-ide
          2. Selecciona vtex.pages-graphql@2.x
          3. Ejecuta la siguiente mutation (ajusta el vendor y versiones):
          mutation {
            updateThemeIds(from:"${this.vendor}.store@3.x", to:"${this.vendor}.store@4.x")
          }

          4. Verifica que la respuesta sea:
          {
            "data": {
              "updateThemeIds": true
            }
          }`));

        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        // Esperar confirmación del usuario
        const { shouldContinue } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldContinue',
            message: '¿La migración se completó correctamente y deseas continuar con el proceso?',
            default: false,
          },
        ]);

        if (shouldContinue) {
          // Reiniciamos el spinner para la última parte
          spinner.start('Ejecutando promoción...');
          await execCommand('vtex promote');
          spinner.succeed('✅ Major stable y migración completados exitosamente');
        } else {
          spinner.info('Proceso interrumpido por el usuario');
        }
      } catch (error) {
        spinner.fail('❌ Error durante el major stable');
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error en patch stable:'), error);
      throw error;
    }
  }

  async deploy(): Promise<void> {
    try {
      // Ejecutar el tipo de deploy correspondiente
      switch (this.deployType) {
        case 'PATCH_STABLE':
          await this.executePatchStable();
          break;
        case 'NEW_CUSTOM_APP':
          await this.executeNewCustomApp();
          break;
        case 'UPDATE_CUSTOM_APP':
          await this.executeUpdateCustomApp();
          break;
        case 'MAJOR_STABLE':
          await this.executeMajorStable();
          break;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error durante el proceso:'), error);
      throw error;
    }
  }
}

export const createDeploy = (options?: DeployOptions) => {
  return new VtexDeploy(options);
};
